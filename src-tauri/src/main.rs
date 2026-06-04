// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use axum::{extract::State, routing::post, Router};
use regex::Regex;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac, KeyInit};
use sha2::Sha512;
use reqwest::Client;

type HmacSha512 = Hmac<Sha512>;

fn generate_signature(public_key: &str, secret_key: &str, request_body: &str) -> String {
    let payload = format!("{}{}{}", public_key, request_body, public_key);
    let mut mac = HmacSha512::new_from_slice(secret_key.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(payload.as_bytes());
    let result = mac.finalize();
    let hex_str = hex::encode(result.into_bytes());
    general_purpose::STANDARD.encode(hex_str)
}

fn main() {
    let tunnel_state = TunnelState(Arc::new(Mutex::new(None)));

    tauri::Builder::default()
        .manage(tunnel_state)
        .setup(|app| {
            let app_handle = app.handle().clone();
            let local_port = "8000";

            // Spin up the local Axum server once globally
            let axum_app = Router::new()
                .route("/webhook", post(handle_webhook))
                .with_state(app_handle);

            tauri::async_runtime::spawn(async move {
                let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", local_port))
                    .await
                    .unwrap();
                println!("Axum server started on port {}", local_port);
                axum::serve(listener, axum_app).await.unwrap();
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_local_tunnel,
            stop_local_tunnel,
            get_solidgate_webhooks,
            create_solidgate_webhook,
            update_solidgate_webhook
        ])
        // Lifecycle Hook: Crucial for Ubuntu so 'tmole' processes don't become zombies
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let arc = window.state::<TunnelState>().0.clone();
                if let Ok(mut guard) = arc.lock() {
                    if let Some(mut child) = guard.take() {
                        println!("Stopping background Tunnelmole process cleanly...");
                        let _ = child.kill();
                    }
                };
            };
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// A global reference to keep track of the active tunnel process so we can terminate it later
struct TunnelState(Arc<Mutex<Option<Child>>>);

async fn handle_webhook(State(app): State<AppHandle>, body: String) -> &'static str {
    println!("Received Solidgate Webhook: {}", body);
    let _ = app.emit("webhook-received", &body);
    "OK"
}

#[tauri::command]
async fn get_solidgate_webhooks(
    public_key: String,
    secret_key: String,
) -> Result<String, String> {
    let url = "https://api.solidgate.com/api/v1/webhooks/endpoints";
    let body = ""; 
    let signature = generate_signature(&public_key, &secret_key, body);

    let client = Client::new();
    let res = client
        .get(url)
        .header("merchant", public_key)
        .header("signature", signature)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
async fn create_solidgate_webhook(
    public_key: String,
    secret_key: String,
    payload_json: String,
) -> Result<String, String> {
    let url = "https://api.solidgate.com/api/v1/webhooks/endpoints";
    let signature = generate_signature(&public_key, &secret_key, &payload_json);

    let client = Client::new();
    let res = client
        .post(url)
        .header("content-type", "application/json")
        .header("merchant", public_key)
        .header("signature", signature)
        .body(payload_json)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
async fn update_solidgate_webhook(
    public_key: String,
    secret_key: String,
    webhook_id: String,
    payload_json: String,
) -> Result<String, String> {
    let url = format!("https://api.solidgate.com/api/v1/webhooks/endpoints/{}", webhook_id);
    let signature = generate_signature(&public_key, &secret_key, &payload_json);

    let client = Client::new();
    let res = client
        .patch(&url)
        .header("content-type", "application/json")
        .header("merchant", public_key)
        .header("signature", signature)
        .body(payload_json)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
async fn start_local_tunnel(
    app: AppHandle,
    state: tauri::State<'_, TunnelState>,
    local_port: String,
) -> Result<String, String> {
    // Spawn Tunnelmole CLI as a child process
    let mut child = Command::new("tmole")
        .arg(local_port)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to launch Tunnelmole: {}. Ensure 'tmole' is in your system PATH.",
                e
            )
        })?;

    // Pull out the stdout stream to scan it for the URL
    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to open Tunnelmole stdout pipe")?;
    let mut reader = BufReader::new(stdout);

    // Pattern to catch Tunnelmole's generated public HTTPS link
    let url_regex = Regex::new(r"https://[a-zA-Z0-9-]+\.tunnelmole\.net").unwrap();
    let mut generated_url = String::new();

    // Store the child handle globally so we can kill it when the app shuts down
    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(child);
    }

    // Parse lines until the URL is found
    let mut line_str = String::new();
    while reader.read_line(&mut line_str).unwrap_or(0) > 0 {
        let trimmed = line_str.trim();
        println!("[Tunnelmole Log]: {}", trimmed); // Helpful for local debugging
        if !trimmed.is_empty() {
            let _ = app.emit("tunnel-log", trimmed.to_string());
        }
        if let Some(mat) = url_regex.find(trimmed) {
            generated_url = mat.as_str().to_string();
            line_str.clear();
            break; // Found it! Stop blocking and return the URL
        }
        line_str.clear();
    }

    if generated_url.is_empty() {
        return Err("Tunnelmole started but failed to return a valid public URL.".to_string());
    }

    // Stream remaining logs
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut line_str = String::new();
        while reader.read_line(&mut line_str).unwrap_or(0) > 0 {
            let trimmed = line_str.trim();
            if !trimmed.is_empty() {
                let _ = app_clone.emit("tunnel-log", trimmed.to_string());
            }
            line_str.clear();
        }
    });

    // Return the raw webhook URL string back to the UI
    Ok(generated_url)
}

#[tauri::command]
async fn stop_local_tunnel(state: tauri::State<'_, TunnelState>) -> Result<(), String> {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            println!("Stopping background Tunnelmole process cleanly...");
            let _ = child.kill();
        }
    }
    Ok(())
}
