use axum::{
    body::Bytes,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, Mutex};

pub struct ServerState(pub Arc<Mutex<Option<oneshot::Sender<()>>>>);

impl ServerState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

pub async fn start_server(
    app_handle: AppHandle,
    server_state: Arc<Mutex<Option<oneshot::Sender<()>>>>,
    local_port: String,
) {
    // Stop any existing embedded server instance
    let mut guard = server_state.lock().await;
    if let Some(shutdown_tx) = guard.take() {
        let _ = shutdown_tx.send(());
    }

    let addr = format!("0.0.0.0:{}", local_port);
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!(
                "Embedded webhook server could not bind to {}: {} (an external local service may already be running on this port)",
                addr, e
            );
            return;
        }
    };

    println!("Embedded webhook server listening on http://{}", addr);

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    *guard = Some(shutdown_tx);
    drop(guard);

    let axum_app = Router::new()
        .route("/", get(handle_health).post(handle_webhook))
        .route("/{*path}", get(handle_health).post(handle_webhook))
        .with_state(app_handle);

    let server = axum::serve(listener, axum_app).with_graceful_shutdown(async move {
        let _ = shutdown_rx.await;
    });

    if let Err(e) = server.await {
        eprintln!("Embedded server stopped with error: {}", e);
    }
}

async fn handle_health() -> &'static str {
    "Solidgate Webhook Tunnel Server is running"
}

async fn handle_webhook(State(app): State<AppHandle>, body: Bytes) -> impl IntoResponse {
    let body_str = String::from_utf8_lossy(&body).to_string();
    println!("Received Webhook: {}", body_str);
    let _ = app.emit("webhook-received", &body_str);
    (StatusCode::OK, "OK")
}
