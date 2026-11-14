use regex::Regex;
use std::io::{BufRead, BufReader};
use std::path::Path;
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

fn reset_tmole_anonymous_session() {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok();
    if let Some(h) = home {
        let client_id_path = Path::new(&h).join(".tmole.sh/local-storage/clientId");
        if client_id_path.exists() {
            println!("Resetting Tunnelmole anonymous client session...");
            let _ = std::fs::remove_file(client_id_path);
        }
    }
}

fn spawn_tmole(local_port: &str) -> Result<Child, String> {
    Command::new("tmole")
        .arg(local_port)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to launch Tunnelmole: {}. Ensure 'tmole' is in your system PATH.",
                e
            )
        })
}

fn drain_stderr(app: AppHandle, stderr: std::process::ChildStderr) {
    tauri::async_runtime::spawn_blocking(move || {
        let mut err_reader = BufReader::new(stderr);
        let mut err_line = String::new();
        while err_reader.read_line(&mut err_line).unwrap_or(0) > 0 {
            let trimmed = err_line.trim();
            if !trimmed.is_empty() {
                eprintln!("[Tunnelmole Stderr]: {}", trimmed);
                let _ = app.emit("tunnel-log", format!("[ERROR] {}", trimmed));
            }
            err_line.clear();
        }
    });
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

    // Attempt 1: Launch Tunnelmole
    let mut child = match spawn_tmole(&local_port) {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit("tunnel-log", format!("[ERROR] {}", e));
            return Err(e);
        }
    };

    // Drain stderr concurrently to prevent pipe buffer deadlocks and print all errors
    if let Some(stderr) = child.stderr.take() {
        drain_stderr(app.clone(), stderr);
    }

    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            let err_msg = "[ERROR] Failed to open Tunnelmole stdout pipe.".to_string();
            let _ = app.emit("tunnel-log", &err_msg);
            return Err(err_msg);
        }
    };
    let mut reader = BufReader::new(stdout);

    let mut generated_url = String::new();
    let mut collected_output = Vec::new();
    let mut line_str = String::new();

    while reader.read_line(&mut line_str).unwrap_or(0) > 0 {
        let trimmed = line_str.trim();
        println!("[Tunnelmole Log]: {}", trimmed);
        if !trimmed.is_empty() {
            let _ = app.emit("tunnel-log", trimmed.to_string());
            collected_output.push(trimmed.to_string());
        }
        if let Some(mat) = URL_REGEX.find(trimmed) {
            generated_url = mat.as_str().to_string();
            line_str.clear();
            break;
        }
        line_str.clear();
    }

    // Auto-recovery: If rate limited (10 tunnels/hr for anonymous), reset session and retry once
    let is_rate_limited = collected_output
        .iter()
        .any(|l| l.contains("limited to 10 tunnels per hour"));

    if generated_url.is_empty() && is_rate_limited {
        let _ = child.kill();
        let _ = child.wait();

        let _ = app.emit(
            "tunnel-log",
            "[ERROR] Tunnelmole rate limit: Anonymous users are limited to 10 tunnels per hour."
                .to_string(),
        );
        let _ = app.emit(
            "tunnel-log",
            "[SYSTEM] Automatically refreshing anonymous session and retrying...".to_string(),
        );
        reset_tmole_anonymous_session();

        // Attempt 2: Retry with fresh anonymous session
        let mut retry_child = match spawn_tmole(&local_port) {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("tunnel-log", format!("[ERROR] Retry failed: {}", e));
                return Err(e);
            }
        };

        if let Some(stderr) = retry_child.stderr.take() {
            drain_stderr(app.clone(), stderr);
        }

        let retry_stdout = match retry_child.stdout.take() {
            Some(s) => s,
            None => {
                let err_msg = "[ERROR] Failed to open Tunnelmole stdout pipe on retry.".to_string();
                let _ = app.emit("tunnel-log", &err_msg);
                return Err(err_msg);
            }
        };
        let mut retry_reader = BufReader::new(retry_stdout);

        while retry_reader.read_line(&mut line_str).unwrap_or(0) > 0 {
            let trimmed = line_str.trim();
            println!("[Tunnelmole Log]: {}", trimmed);
            if !trimmed.is_empty() {
                let _ = app.emit("tunnel-log", trimmed.to_string());
                collected_output.push(trimmed.to_string());
            }
            if let Some(mat) = URL_REGEX.find(trimmed) {
                generated_url = mat.as_str().to_string();
                line_str.clear();
                break;
            }
            line_str.clear();
        }

        if !generated_url.is_empty() {
            if let Ok(mut guard) = state.0.lock() {
                *guard = Some(retry_child);
            }
            let app_clone = app.clone();
            let state_clone = state.0.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let mut line_str = String::new();
                while retry_reader.read_line(&mut line_str).unwrap_or(0) > 0 {
                    let trimmed = line_str.trim();
                    if !trimmed.is_empty() {
                        let _ = app_clone.emit("tunnel-log", trimmed.to_string());
                    }
                    line_str.clear();
                }
                // Check if process terminated unexpectedly
                if let Ok(mut guard) = state_clone.lock() {
                    if let Some(ref mut c) = *guard {
                        if let Ok(Some(status)) = c.try_wait() {
                            if !status.success() {
                                let _ = app_clone.emit(
                                    "tunnel-log",
                                    format!("[ERROR] Tunnelmole process terminated with code: {}", status),
                                );
                            }
                        }
                    }
                }
            });
            return Ok(generated_url);
        }
    }

    if generated_url.is_empty() {
        let error_msg = if !collected_output.is_empty() {
            collected_output.join("\n")
        } else {
            "Tunnelmole started but returned no output or public URL.".to_string()
        };
        let formatted_err = format!("[ERROR] Tunnelmole failed: {}", error_msg);
        let _ = app.emit("tunnel-log", &formatted_err);
        return Err(formatted_err);
    }

    // Store the child handle globally so we can kill it when stopped or shut down
    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(child);
    }

    // Stream remaining logs using Tokio blocking pool
    let app_clone = app.clone();
    let state_clone = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut line_str = String::new();
        while reader.read_line(&mut line_str).unwrap_or(0) > 0 {
            let trimmed = line_str.trim();
            if !trimmed.is_empty() {
                let _ = app_clone.emit("tunnel-log", trimmed.to_string());
            }
            line_str.clear();
        }
        // Check if process terminated unexpectedly
        if let Ok(mut guard) = state_clone.lock() {
            if let Some(ref mut c) = *guard {
                if let Ok(Some(status)) = c.try_wait() {
                    if !status.success() {
                        let _ = app_clone.emit(
                            "tunnel-log",
                            format!("[ERROR] Tunnelmole process terminated with code: {}", status),
                        );
                    }
                }
            }
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
