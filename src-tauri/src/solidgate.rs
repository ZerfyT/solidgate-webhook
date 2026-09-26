use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, KeyInit, Mac};
use reqwest::Client;
use sha2::Sha512;

type HmacSha512 = Hmac<Sha512>;

const BASE_ENDPOINT_URL: &str = "https://api.solidgate.com/api/v1/webhooks/endpoints";

fn generate_signature(public_key: &str, secret_key: &str, request_body: &str) -> String {
    let payload = format!("{}{}{}", public_key, request_body, public_key);
    let mut mac =
        HmacSha512::new_from_slice(secret_key.as_bytes()).expect("HMAC can take key of any size");
    mac.update(payload.as_bytes());
    let result = mac.finalize();
    let hex_str = hex::encode(result.into_bytes());
    general_purpose::STANDARD.encode(hex_str)
}

#[tauri::command]
pub async fn get_solidgate_webhooks(
    public_key: String,
    secret_key: String,
) -> Result<String, String> {
    let url = BASE_ENDPOINT_URL;
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
pub async fn create_solidgate_webhook(
    public_key: String,
    secret_key: String,
    payload_json: String,
) -> Result<String, String> {
    let url = BASE_ENDPOINT_URL;
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
pub async fn update_solidgate_webhook(
    public_key: String,
    secret_key: String,
    webhook_id: String,
    payload_json: String,
) -> Result<String, String> {
    let url = format!("{}/{}", BASE_ENDPOINT_URL, webhook_id);
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
pub async fn delete_solidgate_webhook(
    public_key: String,
    secret_key: String,
    webhook_id: String,
) -> Result<String, String> {
    let url = format!("{}/{}", BASE_ENDPOINT_URL, webhook_id);
    let body = "";
    let signature = generate_signature(&public_key, &secret_key, body);

    let client = Client::new();
    let res = client
        .delete(&url)
        .header("merchant", public_key)
        .header("signature", signature)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}
