use regex::Regex;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, LazyLock, Mutex};
use tauri::{AppHandle, Emitter};

use crate::server::ServerState;

static URL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"https://[a-zA-Z0-9-]+\.tunnelmole\.net").expect("Valid regex")
});

// A global reference to keep track of the active tunnel process so we can terminate it later
pub struct TunnelState(pub Arc<Mutex<Option<Child>>>);

impl TunnelState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

#[tauri::command]
pub async fn start_local_tunnel(
    app: AppHandle,
    state: tauri::State<'_, TunnelState>,
    server_state: tauri::State<'_, ServerState>,
    local_port: String,
) -> Result<String, String> {
    // If the port changed, start/bind the embedded server for this port
    let server_arc = server_state.0.clone();
    let app_handle_for_server = app.clone();
    let port_for_server = local_port.clone();
    tauri::async_runtime::spawn(async move {
        crate::server::start_server(app_handle_for_server, server_arc, port_for_server).await;
    });

    // Spawn Tunnelmole CLI as a child process
    let mut child = Command::new("tmole")
        .arg(&local_port)
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

    // Store the child handle globally so we can kill it when stopped or shut down
    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(child);
    }

    let mut generated_url = String::new();

    // Parse lines until the URL is found
    let mut line_str = String::new();
    while reader.read_line(&mut line_str).unwrap_or(0) > 0 {
        let trimmed = line_str.trim();
        println!("[Tunnelmole Log]: {}", trimmed);
        if !trimmed.is_empty() {
            let _ = app.emit("tunnel-log", trimmed.to_string());
        }
        if let Some(mat) = URL_REGEX.find(trimmed) {
            generated_url = mat.as_str().to_string();
            line_str.clear();
            break;
        }
        line_str.clear();
    }

    if generated_url.is_empty() {
        return Err("Tunnelmole started but failed to return a valid public URL.".to_string());
    }

    // Stream remaining logs using Tokio blocking pool (staying in runtime thread model)
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut line_str = String::new();
        while reader.read_line(&mut line_str).unwrap_or(0) > 0 {
            let trimmed = line_str.trim();
            if !trimmed.is_empty() {
                let _ = app_clone.emit("tunnel-log", trimmed.to_string());
            }
            line_str.clear();
        }
    });

    Ok(generated_url)
}

#[tauri::command]
pub async fn stop_local_tunnel(state: tauri::State<'_, TunnelState>) -> Result<(), String> {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            println!("Stopping background Tunnelmole process cleanly...");
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn check_tunnelmole() -> bool {
    Command::new("tmole")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
}
