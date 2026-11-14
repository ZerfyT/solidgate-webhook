import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../constants";

// Custom hook to manage settings with OS Keyring secure storage for secret keys
export function useSettings() {
  const [settings, setSettings] = useState(() => ({
    publicKey:
      localStorage.getItem(STORAGE_KEYS.SG_PUBLIC_KEY) ||
      DEFAULT_SETTINGS.SG_PUBLIC_KEY,
    secretKey: DEFAULT_SETTINGS.SG_SECRET_KEY, // Loaded asynchronously from OS Keyring
    webhookSuffix:
      localStorage.getItem(STORAGE_KEYS.SG_WEBHOOK_SUFFIX) ||
      DEFAULT_SETTINGS.SG_WEBHOOK_SUFFIX,
    eventTypes:
      localStorage.getItem(STORAGE_KEYS.SG_EVENT_TYPES) ||
      DEFAULT_SETTINGS.SG_EVENT_TYPES,
    selectedWebhookId:
      localStorage.getItem(STORAGE_KEYS.SG_SELECTED_WEBHOOK_ID) ||
      DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID,
  }));

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load secret key securely from OS Keyring on mount & migrate legacy localStorage key if present
  useEffect(() => {
    let isMounted = true;

    const loadSecureSecret = async () => {
      try {
        const secureKey = await invoke("get_secret_key");
        const legacyKey = localStorage.getItem(STORAGE_KEYS.SG_SECRET_KEY);

        if (legacyKey) {
          // Immediately purge plaintext key from localStorage
          localStorage.removeItem(STORAGE_KEYS.SG_SECRET_KEY);

          if (!secureKey && legacyKey) {
            await invoke("save_secret_key", { secretKey: legacyKey });
            if (isMounted) {
              setSettings((prev) => ({ ...prev, secretKey: legacyKey }));
            }
            return;
          }
        }

        if (secureKey && isMounted) {
          setSettings((prev) => ({ ...prev, secretKey: secureKey }));
        }
      } catch (err) {
        console.warn("Failed to load secure secret key from keyring:", err);
      }
    };

    loadSecureSecret();

    return () => {
      isMounted = false;
    };
  }, []);

  const saveSettings = useCallback((overrideSettings) => {
    const target = overrideSettings || settingsRef.current;
    localStorage.setItem(STORAGE_KEYS.SG_PUBLIC_KEY, target.publicKey || "");

    // NEVER store secretKey in localStorage
    localStorage.removeItem(STORAGE_KEYS.SG_SECRET_KEY);

    // Securely persist to OS Keyring / native credential manager via Rust
    invoke("save_secret_key", { secretKey: target.secretKey || "" }).catch((e) => {
      console.error("Failed to save secret key to secure storage:", e);
    });

    localStorage.setItem(
      STORAGE_KEYS.SG_WEBHOOK_SUFFIX,
      target.webhookSuffix || DEFAULT_SETTINGS.SG_WEBHOOK_SUFFIX,
    );
    localStorage.setItem(
      STORAGE_KEYS.SG_EVENT_TYPES,
      target.eventTypes || DEFAULT_SETTINGS.SG_EVENT_TYPES,
    );
    localStorage.setItem(
      STORAGE_KEYS.SG_SELECTED_WEBHOOK_ID,
      target.selectedWebhookId || DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID,
    );
  }, []);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      settingsRef.current = updated;
      saveSettings(updated);
      return updated;
    });
  }, [saveSettings]);

  const clearAllCache = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });

    // Delete secret key from secure OS Keyring
    invoke("delete_secret_key").catch((e) => {
      console.warn("Failed to delete secret key from secure storage:", e);
    });

    const defaultVals = {
      publicKey: DEFAULT_SETTINGS.SG_PUBLIC_KEY,
      secretKey: DEFAULT_SETTINGS.SG_SECRET_KEY,
      webhookSuffix: DEFAULT_SETTINGS.SG_WEBHOOK_SUFFIX,
      eventTypes: DEFAULT_SETTINGS.SG_EVENT_TYPES,
      selectedWebhookId: DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID,
    };
    settingsRef.current = defaultVals;
    setSettings(defaultVals);
  }, []);

  return { settings, updateSetting, saveSettings, clearAllCache };
}
