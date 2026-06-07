import { useState } from "react";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../constants";

// Custom hook to manage settings
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

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEYS.SG_PUBLIC_KEY, settings.publicKey);
    localStorage.setItem(STORAGE_KEYS.SG_SECRET_KEY, settings.secretKey);
    localStorage.setItem(
      STORAGE_KEYS.SG_WEBHOOK_SUFFIX,
      settings.webhookSuffix,
    );
    localStorage.setItem(STORAGE_KEYS.SG_EVENT_TYPES, settings.eventTypes);
    localStorage.setItem(
      STORAGE_KEYS.SG_SELECTED_WEBHOOK_ID,
      settings.selectedWebhookId,
    );
  };

  return { settings, updateSetting, saveSettings };
}
