pub mod server;
pub mod solidgate;
pub mod tunnel;

use reqwest::Client;
use std::time::Duration;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let tunnel_state = tunnel::TunnelState::new();
    let server_state = server::ServerState::new();
    let http_client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| Client::new());

    let server_state_arc = server_state.0.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(tunnel_state)
        .manage(server_state)
        .manage(http_client)
        .setup(move |app| {
            let app_handle = app.handle().clone();
            // Start the embedded server on default port 8000
            tauri::async_runtime::spawn(async move {
                server::start_server(app_handle, server_state_arc, "8000".to_string()).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tunnel::start_local_tunnel,
            tunnel::stop_local_tunnel,
            tunnel::check_tunnelmole,
            solidgate::get_solidgate_webhooks,
            solidgate::create_solidgate_webhook,
            solidgate::update_solidgate_webhook,
            solidgate::delete_solidgate_webhook
        ])
        // Lifecycle Hook: Clean up background processes on close or destroy
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                let arc = window.state::<tunnel::TunnelState>().0.clone();
                if let Ok(mut guard) = arc.lock() {
                    if let Some(mut child) = guard.take() {
                        println!("Stopping background Tunnelmole process cleanly...");
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                };
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
