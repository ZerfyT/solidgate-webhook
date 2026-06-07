use axum::{extract::State, routing::post, Router};
use tauri::{AppHandle, Emitter};

pub async fn run_server(app_handle: AppHandle, local_port: String) {
    let axum_app = Router::new()
        .route("/webhook", post(handle_webhook))
        .with_state(app_handle);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", local_port))
        .await
        .unwrap();
    println!("Axum server started on port {}", local_port);
    axum::serve(listener, axum_app).await.unwrap();
}

async fn handle_webhook(State(app): State<AppHandle>, body: String) -> &'static str {
    println!("Received Solidgate Webhook: {}", body);
    let _ = app.emit("webhook-received", &body);
    "OK"
}
