use regex::Regex;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

// A global reference to keep track of the active tunnel process so we can terminate it later
pub struct TunnelState(pub Arc<Mutex<Option<Child>>>);

#[tauri::command]
pub async fn start_local_tunnel(
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
pub async fn stop_local_tunnel(state: tauri::State<'_, TunnelState>) -> Result<(), String> {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            println!("Stopping background Tunnelmole process cleanly...");
            let _ = child.kill();
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
