use keyring::Entry;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const KEYRING_SERVICE: &str = "solidgate-webhook";
const KEYRING_USER: &str = "solidgate_secret_key";
const FALLBACK_FILE_NAME: &str = ".solidgate_sk";

fn get_fallback_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|p| p.join(FALLBACK_FILE_NAME))
}

#[tauri::command]
pub fn save_secret_key(app: AppHandle, secret_key: String) -> Result<(), String> {
    if secret_key.trim().is_empty() {
        return delete_secret_key(app);
    }

    // 1. Try OS Keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
    let keyring_result = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| e.to_string())
        .and_then(|entry| entry.set_password(&secret_key).map_err(|e| e.to_string()));

    if keyring_result.is_ok() {
        // If saved to keyring, clean up any fallback file
        if let Some(path) = get_fallback_path(&app) {
            let _ = fs::remove_file(path);
        }
        return Ok(());
    }

    // 2. Fallback for environments without an active Secret Service daemon
    if let Some(path) = get_fallback_path(&app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        #[cfg(unix)]
        {
            use std::io::Write;
            use std::os::unix::fs::OpenOptionsExt;
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .mode(0o600) // Owner-only read/write permissions
                .open(&path)
                .map_err(|e| e.to_string())?;
            file.write_all(secret_key.as_bytes())
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
        #[cfg(not(unix))]
        {
            fs::write(&path, secret_key.as_bytes()).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }

    Err("Failed to save secret key to secure storage".to_string())
}

#[tauri::command]
pub fn get_secret_key(app: AppHandle) -> Result<String, String> {
    // 1. Try OS Keyring
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        if let Ok(password) = entry.get_password() {
            if !password.is_empty() {
                return Ok(password);
            }
        }
    }

    // 2. Try Fallback file
    if let Some(path) = get_fallback_path(&app) {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                return Ok(content.trim().to_string());
            }
        }
    }

    Ok(String::new())
}

#[tauri::command]
pub fn delete_secret_key(app: AppHandle) -> Result<(), String> {
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        let _ = entry.delete_credential();
    }

    if let Some(path) = get_fallback_path(&app) {
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }

    Ok(())
}
