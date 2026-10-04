import { memo, useState, useEffect, useCallback, useMemo } from "react";
import TextInput from "./ui/text-input.jsx";
import { WEBHOOK_EVENTS } from "../constants.js";

function SettingsModalComponent({
  onClose,
  onSave,
  settings,
  updateSetting,
  availableWebhooks = [],
  fetchingWebhooks = false,
  fetchWebhooks,
  savingSettings = false,
  onClearCache,
}) {
  const [confirmClearCache, setConfirmClearCache] = useState(false);

  // Close on Escape, Save on Ctrl/Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        onSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onSave]);

  // Parse currently active events
  const activeEventsSet = useMemo(() => {
    if (!settings.eventTypes) return new Set();
    return new Set(
      settings.eventTypes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }, [settings.eventTypes]);

  // Toggle event tag
  const toggleEventTag = useCallback(
    (eventName) => {
      const current = settings.eventTypes
        ? settings.eventTypes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        : [];

      let updated;
      if (current.includes(eventName)) {
        updated = current.filter((e) => e !== eventName);
      } else {
        updated = [...current, eventName];
      }
      updateSetting("eventTypes", updated.join(", "));
    },
    [settings.eventTypes, updateSetting],
  );

  const handleClearCacheClick = () => {
    if (!confirmClearCache) {
      setConfirmClearCache(true);
      setTimeout(() => setConfirmClearCache(false), 5000);
    } else {
      if (onClearCache) {
        onClearCache();
      } else {
        localStorage.clear();
        window.location.reload();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-700/70 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Solidgate API Settings
              </h2>
              <p className="text-xs text-slate-400">
                Configure your API credentials and webhook dispatch options
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
            title="Close (Esc)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-5">
          {/* API Credentials Card */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Solidgate Credentials
              </span>
              <span className="text-[11px] text-slate-500">
                Optional: Leave blank for standalone tunnel
              </span>
            </div>

            <TextInput
              id="sgPublicKey"
              label="Public Key"
              value={settings.publicKey}
              onChange={(e) => updateSetting("publicKey", e.target.value)}
              inputType="text"
              placeholder="pk_..."
              helperText="Your Solidgate Merchant Public API Key"
            />

            <TextInput
              id="sgSecretKey"
              label="Secret Key"
              value={settings.secretKey}
              onChange={(e) => updateSetting("secretKey", e.target.value)}
              inputType="password"
              placeholder="sk_..."
              helperText="Your Solidgate Merchant Secret Key (kept securely in local storage)"
            />
          </div>

          {/* Webhook Configuration Card */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-4">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Webhook Configuration
            </span>

            <TextInput
              id="sgWebhookSuffix"
              label="Webhook Path Suffix"
              value={settings.webhookSuffix}
              onChange={(e) => updateSetting("webhookSuffix", e.target.value)}
              inputType="text"
              placeholder="/webhook-solidgate"
              helperText="Appended to the Tunnelmole live domain (e.g. https://xxx.tunnelmole.net/webhook-solidgate)"
            />

            {/* Target Webhook Selection */}
            <div className="flex flex-col gap-2 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center">
                <label htmlFor="sgSelectedWebhook" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Target Endpoint in Solidgate
                </label>
                <button
                  type="button"
                  onClick={() => fetchWebhooks(false)}
                  disabled={fetchingWebhooks}
                  className="text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {fetchingWebhooks ? (
                    <>
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh List
                    </>
                  )}
                </button>
              </div>

              <div className="relative mt-1">
                <select
                  id="sgSelectedWebhook"
                  value={settings.selectedWebhookId}
                  onChange={(e) => updateSetting("selectedWebhookId", e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700/80 text-white text-sm font-mono appearance-none cursor-pointer focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 pr-10"
                >
                  <option value="CREATE_NEW" className="font-semibold text-blue-400">
                    + Create New Webhook Endpoint (Auto-deletes on stop)
                  </option>
                  {availableWebhooks.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.id} &bull; {wh.url}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Choose <strong className="text-slate-300">Create New Webhook</strong> for disposable local testing, or select an existing endpoint to overwrite its URL with your active tunnel.
              </p>
            </div>

            {/* Event Types with clickable quick chips */}
            <div className="flex flex-col gap-2">
              <TextInput
                id="sgEventTypes"
                label="Event Types (Comma separated)"
                value={settings.eventTypes}
                onChange={(e) => updateSetting("eventTypes", e.target.value)}
                inputType="text"
                placeholder="card_gate.order.updated, payment.success"
                inputClassName="h-20"
                isTextArea={true}
                helperText="Events Solidgate will deliver to this endpoint"
              />

              <div className="flex flex-col gap-1.5 mt-1">
                <span className="text-[11px] font-semibold text-slate-400 select-none">
                  Quick-toggle Solidgate events:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {WEBHOOK_EVENTS.map((event) => {
                    const isSelected = activeEventsSet.has(event);
                    return (
                      <button
                        key={event}
                        type="button"
                        onClick={() => toggleEventTag(event)}
                        className={`text-[11px] font-mono px-2 py-1 rounded-md border transition-all cursor-pointer ${isSelected
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-300 font-medium"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                          }`}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {event}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={handleClearCacheClick}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${confirmClearCache
              ? "bg-rose-600 text-white border-rose-500"
              : "text-rose-400/90 border-transparent hover:border-rose-500/30 hover:bg-rose-500/10"
              }`}
          >
            {confirmClearCache ? "Click again to confirm clear" : "Clear Local Storage"}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={savingSettings}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-sm font-semibold cursor-pointer transition-all shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savingSettings ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Validating & Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsModalComponent);
