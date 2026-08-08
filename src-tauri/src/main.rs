// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod server;
mod solidgate;
mod tunnel;

use std::sync::{Arc, Mutex};
use tauri::Manager;
use tunnel::TunnelState;

fn main() {
    let tunnel_state = TunnelState(Arc::new(Mutex::new(None)));

    tauri::Builder::default()
        .manage(tunnel_state)
        .setup(|app| {
            let app_handle = app.handle().clone();
            let local_port = "8000".to_string();

            // Spin up the local Axum server once globally
            tauri::async_runtime::spawn(async move {
                server::run_server(app_handle, local_port).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tunnel::start_local_tunnel,
            tunnel::stop_local_tunnel,
            tunnel::check_tunnelmole,
            tunnel::install_tunnelmole,
            solidgate::get_solidgate_webhooks,
            solidgate::create_solidgate_webhook,
            solidgate::update_solidgate_webhook
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
