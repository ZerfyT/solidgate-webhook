import { useState, useCallback } from "react";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../constants";

// Custom hook to manage settings with stable callbacks
export function useSettings() {
  const [settings, setSettings] = useState(() => ({
    publicKey:
      localStorage.getItem(STORAGE_KEYS.SG_PUBLIC_KEY) ||
      DEFAULT_SETTINGS.SG_PUBLIC_KEY,
    secretKey:
      localStorage.getItem(STORAGE_KEYS.SG_SECRET_KEY) ||
      DEFAULT_SETTINGS.SG_SECRET_KEY,
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

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      saveSettings(updated);
      return updated;
    });
  }, []);

  const saveSettings = useCallback((overrideSettings) => {
    const target = overrideSettings || settings;
    localStorage.setItem(STORAGE_KEYS.SG_PUBLIC_KEY, target.publicKey || "");
    localStorage.setItem(STORAGE_KEYS.SG_SECRET_KEY, target.secretKey || "");
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
  }, [settings]);

  const clearAllCache = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    setSettings({
      publicKey: DEFAULT_SETTINGS.SG_PUBLIC_KEY,
      secretKey: DEFAULT_SETTINGS.SG_SECRET_KEY,
      webhookSuffix: DEFAULT_SETTINGS.SG_WEBHOOK_SUFFIX,
      eventTypes: DEFAULT_SETTINGS.SG_EVENT_TYPES,
      selectedWebhookId: DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID,
    });
  }, []);

  return { settings, updateSetting, saveSettings, clearAllCache };
}
