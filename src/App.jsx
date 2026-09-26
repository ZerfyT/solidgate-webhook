import { useState, useEffect, useCallback, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./App.css";
import { STORAGE_KEYS, DEFAULT_SETTINGS } from "./constants";
import SettingsModal from "./components/settings-modal";
import { TerminalLog } from "./components/terminal-log";
import { useSettings } from "./hooks/use-settings";
import { useLogStream } from "./hooks/use-log-stream";
import { useToast } from "./components/ui/toast";

const COMMON_PORTS = ["8000", "3000", "5000", "8080", "4242"];

function App() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [localPort, setLocalPort] = useState(
    DEFAULT_SETTINGS.DEFAULT_LOCAL_PORT,
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeWebhookId, setActiveWebhookId] = useState(null);

  const [tmoleInstalled, setTmoleInstalled] = useState(false);
  const [solidgateConnected, setSolidgateConnected] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Settings State
  const { settings, updateSetting, saveSettings, clearAllCache } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [availableWebhooks, setAvailableWebhooks] = useState([]);
  const [fetchingWebhooks, setFetchingWebhooks] = useState(false);

  // High-performance batched log stream
  const { logs, appendLog, clearLogs } = useLogStream();
  const { addToast } = useToast();

  // Keyboard shortcut: Ctrl+, or Cmd+, to toggle Settings
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Check Tunnelmole and Solidgate status on mount and when keys change
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const isInstalled = await invoke("check_tunnelmole");
        if (isMounted) setTmoleInstalled(isInstalled);
      } catch {
        if (isMounted) setTmoleInstalled(false);
      }

      if (settings.publicKey && settings.secretKey) {
        try {
          const response = await invoke("get_solidgate_webhooks", {
            publicKey: settings.publicKey,
            secretKey: settings.secretKey,
          });
          const parsed = JSON.parse(response);
          if (isMounted) {
            if (parsed.error || (!parsed.data && !Array.isArray(parsed.data))) {
              setSolidgateConnected(false);
            } else {
              setSolidgateConnected(true);
            }
          }
        } catch {
          if (isMounted) setSolidgateConnected(false);
        }
      } else {
        if (isMounted) setSolidgateConnected(false);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, [settings.publicKey, settings.secretKey]);

  const handleSaveSettings = useCallback(async () => {
    setSavingSettings(true);
    try {
      saveSettings();

      if (!settings.publicKey || !settings.secretKey) {
        setSolidgateConnected(false);
        addToast("Settings saved (Standalone mode)", "info");
        return;
      }

      const response = await invoke("get_solidgate_webhooks", {
        publicKey: settings.publicKey,
        secretKey: settings.secretKey,
      });
      const parsed = JSON.parse(response);

      if (parsed.error || (!parsed.data && !Array.isArray(parsed.data))) {
        setSolidgateConnected(false);
        addToast("Settings saved, but Solidgate API verification failed.", "error");
      } else {
        setAvailableWebhooks(parsed.data);
        setSolidgateConnected(true);
        addToast("Settings saved & Solidgate connected!", "success");
      }
    } catch (err) {
      console.error("Validation failed:", err);
      setSolidgateConnected(false);
      addToast(`Error saving settings: ${err}`, "error");
    } finally {
      setSavingSettings(false);
      setShowSettings(false);
    }
  }, [saveSettings, settings.publicKey, settings.secretKey, addToast]);

  const fetchWebhooks = useCallback(async (silent = false) => {
    if (!settings.publicKey || !settings.secretKey) {
      if (!silent) {
        addToast("Please enter Public and Secret keys to fetch webhooks.", "info");
      }
      setSolidgateConnected(false);
      return;
    }
    setFetchingWebhooks(true);
    try {
      const response = await invoke("get_solidgate_webhooks", {
        publicKey: settings.publicKey,
        secretKey: settings.secretKey,
      });
      const parsed = JSON.parse(response);
      if (parsed.data) {
        setAvailableWebhooks(parsed.data);

        const tunnelWebhook = parsed.data.find(
          (wh) => wh.url && wh.url.includes(".tunnelmole.net"),
        );
        if (tunnelWebhook) {
          updateSetting("selectedWebhookId", tunnelWebhook.id);
        } else if (parsed.data.length === 0) {
          updateSetting(
            "selectedWebhookId",
            DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID,
          );
        } else if (
          settings.selectedWebhookId ===
          DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID &&
          !localStorage.getItem(STORAGE_KEYS.SG_SELECTED_WEBHOOK_ID)
        ) {
          updateSetting("selectedWebhookId", parsed.data[0].id);
        }
        if (!silent) {
          addToast(`Loaded ${parsed.data.length} webhooks from Solidgate`, "success");
        }
      }
      setSolidgateConnected(true);
    } catch (err) {
      console.error("Failed to fetch webhooks:", err);
      if (!silent) {
        addToast(`Failed to fetch webhooks: ${err}`, "error");
      }
      setSolidgateConnected(false);
    } finally {
      setFetchingWebhooks(false);
    }
  }, [
    settings.publicKey,
    settings.secretKey,
    settings.selectedWebhookId,
    updateSetting,
    addToast,
  ]);

  const handleStartTunnel = useCallback(async () => {
    if (!localPort) return;
    setLoading(true);
    clearLogs();
    try {
      const baseUrl = await invoke("start_local_tunnel", { localPort });
      const completeUrl = `${baseUrl}${settings.webhookSuffix || DEFAULT_SETTINGS.SG_WEBHOOK_SUFFIX}`;
      setWebhookUrl(completeUrl);
      setCopied(false);
      addToast("Tunnel started successfully!", "success");

      appendLog({
        type: "system",
        content: `Tunnel active at ${completeUrl} (forwarding to localhost:${localPort})`,
      });

      // Auto-Sync with Solidgate if keys are configured
      if (settings.publicKey && settings.secretKey) {
        appendLog({
          type: "system",
          content: "Syncing endpoint with Solidgate API...",
        });

        if (
          settings.selectedWebhookId === DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID
        ) {
          const payload = {
            url: completeUrl,
            event_types: settings.eventTypes
              ? settings.eventTypes
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
              : [],
            name: "Local Tunnel Webhook",
            status: "active",
          };
          const resStr = await invoke("create_solidgate_webhook", {
            publicKey: settings.publicKey,
            secretKey: settings.secretKey,
            payloadJson: JSON.stringify(payload),
          });

          try {
            const parsed = JSON.parse(resStr);
            const newId = parsed?.data?.id || parsed?.id;
            if (newId) {
              setActiveWebhookId(newId);
              appendLog({
                type: "webhook",
                content: `Solidgate API: Successfully Created new Webhook endpoint [ID: ${newId}]`,
              });
            }
          } catch (e) {
            console.error("Failed to parse create webhook response:", e);
          }
        } else {
          const payload = { url: completeUrl };
          await invoke("update_solidgate_webhook", {
            publicKey: settings.publicKey,
            secretKey: settings.secretKey,
            webhookId: settings.selectedWebhookId,
            payloadJson: JSON.stringify(payload),
          });
          setActiveWebhookId(settings.selectedWebhookId);
          appendLog({
            type: "webhook",
            content: `Solidgate API: Successfully updated webhook [ID: ${settings.selectedWebhookId}] to ${completeUrl}`,
          });
        }
      } else {
        appendLog({
          type: "system",
          content: "Standalone Mode: Solidgate API credentials not configured in settings.",
        });
      }
    } catch (err) {
      console.error("Tunnel initialization failed:", err);
      appendLog({
        type: "error",
        content: `Tunnel Error: ${err}`,
      });
      addToast(`Error starting tunnel: ${err}`, "error");
    } finally {
      setLoading(false);
    }
  }, [localPort, settings, clearLogs, appendLog, addToast]);

  const handleStopTunnel = useCallback(async () => {
    setLoading(true);
    try {
      await invoke("stop_local_tunnel");
      setWebhookUrl("");
      appendLog({ type: "system", content: "Tunnel process stopped." });
      addToast("Tunnel stopped.", "info");

      if (settings.publicKey && settings.secretKey && activeWebhookId) {
        appendLog({
          type: "system",
          content: `Deleting temporary endpoint ${activeWebhookId} from Solidgate...`,
        });
        await invoke("delete_solidgate_webhook", {
          publicKey: settings.publicKey,
          secretKey: settings.secretKey,
          webhookId: activeWebhookId,
        });
        appendLog({
          type: "webhook",
          content: `Solidgate API: Webhook ${activeWebhookId} successfully deleted.`,
        });
        setActiveWebhookId(null);
      }
    } catch (err) {
      console.error("Failed to stop tunnel:", err);
      appendLog({ type: "error", content: `Failed to stop tunnel: ${err}` });
      addToast(`Failed to stop tunnel: ${err}`, "error");
    } finally {
      setLoading(false);
    }
  }, [settings.publicKey, settings.secretKey, activeWebhookId, appendLog, addToast]);

  const copyToClipboard = useCallback(() => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      addToast("Webhook URL copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [webhookUrl, addToast]);

  const handleOpenUrl = useCallback(async () => {
    if (!webhookUrl) return;
    try {
      await openUrl(webhookUrl);
    } catch (err) {
      console.warn("Failed to open URL with custom protocol, opening in new tab.", err);
      window.open(webhookUrl, "_blank");
    }
  }, [webhookUrl]);

  const handleCopyLogs = useCallback((logsToCopy) => {
    if (!logsToCopy || logsToCopy.length === 0) return;
    const text = logsToCopy
      .map(
        (l) =>
          `[${l.timestamp || "LOG"}] [${(l.type || "INFO").toUpperCase()}] ${l.content}`,
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    addToast(`${logsToCopy.length} logs copied to clipboard!`, "success");
  }, [addToast]);

  const handleClearCache = useCallback(() => {
    clearAllCache();
    addToast("All settings cache cleared.", "info");
    setShowSettings(false);
  }, [clearAllCache, addToast]);

  return (
    <div className="min-h-screen w-full bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(30,58,138,0.25),rgba(2,6,23,0.95))] text-slate-100 flex flex-col items-center font-sans antialiased relative px-4 selection:bg-blue-500/30">
      {/* Top Navbar */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4 mt-1 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight leading-none">
                Solidgate Webhook Tunnel
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v0.2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-none">
              Localhost exposure & instant API synchronization
            </p>
          </div>
        </div>

        {/* Status Indicators & Settings trigger */}
        <div className="flex items-center gap-2.5">
          {/* Solidgate Status */}
          <button
            onClick={() => {
              setShowSettings(true);
              fetchWebhooks(true);
            }}
            className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/80 hover:bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60 transition-all cursor-pointer shadow-sm"
            title="Click to configure Solidgate credentials"
          >
            <div
              className={`w-2 h-2 rounded-full transition-all ${solidgateConnected
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse"
                : "bg-slate-500"
                }`}
            />
            <span className="font-medium text-[11px]">
              Solidgate: {solidgateConnected ? "Connected" : "Offline"}
            </span>
          </button>

          {/* Tunnelmole Status */}
          <div
            className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-700/60 shadow-sm"
            title={
              tmoleInstalled
                ? "Tunnelmole binary detected in PATH"
                : "Tunnelmole binary not found. Run: curl -O https://tunnelmole.com/sh/install.sh && sudo bash install.sh"
            }
          >
            <div
              className={`w-2 h-2 rounded-full ${tmoleInstalled
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse"
                : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]"
                }`}
            />
            <span className="font-medium text-[11px]">
              Tunnelmole: {tmoleInstalled ? "Ready" : "Missing"}
            </span>
          </div>

          {/* Settings Modal Button */}
          <button
            onClick={() => {
              setShowSettings(true);
              fetchWebhooks(true);
            }}
            className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 transition-all cursor-pointer shadow-sm flex items-center justify-center group"
            title="Settings (⌘,)"
          >
            <svg
              className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-5xl flex flex-col flex-1 items-center mt-4">
        {/* Control Card */}
        <div className="w-full glass-panel rounded-2xl p-5 md:p-6 shadow-xl transition-all">
          {!webhookUrl ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Port Input Area */}
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="portInput"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-400 select-none whitespace-nowrap"
                  >
                    Local Port:
                  </label>
                  <div className="relative">
                    <input
                      id="portInput"
                      type="number"
                      value={localPort}
                      onChange={(e) => setLocalPort(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !loading && localPort) {
                          handleStartTunnel();
                        }
                      }}
                      placeholder="8000"
                      disabled={loading}
                      className="w-32 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white font-mono text-sm focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition-all"
                    />
                  </div>

                  {/* Preset quick port buttons */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    {COMMON_PORTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLocalPort(p)}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${localPort === p
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                          : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700"
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start Button */}
                <button
                  onClick={handleStartTunnel}
                  disabled={loading || !localPort}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 transition-all shadow-[0_0_20px_-3px_rgba(59,130,246,0.4)] hover:shadow-[0_0_25px_-2px_rgba(59,130,246,0.6)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 self-stretch md:self-auto"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Starting Tunnel...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Start Tunnel & Sync</span>
                    </>
                  )}
                </button>
              </div>

              {/* Endpoint preview path */}
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                <span className="text-slate-500 font-mono">Target route:</span>
                <span className="font-mono text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                  http://localhost:{localPort || "..."}{settings.webhookSuffix || DEFAULT_SETTINGS.SG_WEBHOOK_SUFFIX}
                </span>
                <span className="text-slate-500 text-[11px]">
                  (Synced with Solidgate when keys are present)
                </span>
              </div>
            </div>
          ) : (
            /* Active Tunnel Live State */
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE TUNNEL
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Port {localPort}
                    </span>
                    {activeWebhookId && (
                      <span className="text-[11px] text-blue-300 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        Solidgate ID: {activeWebhookId}
                      </span>
                    )}
                  </div>

                  {/* URL Box */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 min-w-0 flex items-center bg-slate-950/80 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]">
                      <span className="text-emerald-400 font-mono text-sm sm:text-base font-medium truncate select-all">
                        {webhookUrl}
                      </span>
                    </div>

                    {/* Copy Button */}
                    <button
                      onClick={copyToClipboard}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${copied
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)]"
                        : "bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white"
                        }`}
                      title={copied ? "Copied!" : "Copy Webhook URL"}
                    >
                      {copied ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>

                    {/* Open External Browser Link */}
                    <button
                      onClick={handleOpenUrl}
                      className="p-2.5 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
                      title="Open in external browser"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Stop Button */}
                <button
                  onClick={handleStopTunnel}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 active:scale-98 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 self-stretch md:self-auto shrink-0"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Stopping & cleaning...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
                      <span>Stop Tunnel</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* High-Performance Terminal Console */}
        <TerminalLog
          logs={logs}
          onClearLogs={clearLogs}
          onCopyLogs={handleCopyLogs}
        />
      </main>

      {/* Settings Modal (Isolated & Memoized) */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          settings={settings}
          updateSetting={updateSetting}
          availableWebhooks={availableWebhooks}
          fetchingWebhooks={fetchingWebhooks}
          fetchWebhooks={fetchWebhooks}
          savingSettings={savingSettings}
          onClearCache={handleClearCache}
        />
      )}
    </div>
  );
}

export default App;
