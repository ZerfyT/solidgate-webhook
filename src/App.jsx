import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./App.css";
import { DEFAULT_SETTINGS } from "./constants";
import SettingsModal from "./components/settings-modal";
import { HelpModal } from "./components/help-modal";
import { TerminalLog } from "./components/terminal-log";
import { TunnelControl } from "./components/tunnel-control";
import { useSettings } from "./hooks/use-settings";
import { useLogStream } from "./hooks/use-log-stream";
import { useToast } from "./components/ui/toast";

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
  const [showHelp, setShowHelp] = useState(false);
  const [availableWebhooks, setAvailableWebhooks] = useState([]);
  const [fetchingWebhooks, setFetchingWebhooks] = useState(false);

  // High-performance batched log stream
  const { logs, appendLog, clearLogs } = useLogStream();
  const { addToast } = useToast();

  // Keyboard shortcuts: Ctrl+, (Settings), Ctrl+H / Shift+? (Help)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";

      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
      } else if (e.key === "?" && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchWebhooks = useCallback(
    async (silent = false) => {
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
        if (parsed.data && Array.isArray(parsed.data)) {
          setAvailableWebhooks(parsed.data);
          // If stored selectedWebhookId was deleted on Solidgate, reset to default CREATE_NEW
          if (
            settings.selectedWebhookId !== DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID &&
            !parsed.data.some((wh) => wh.id === settings.selectedWebhookId)
          ) {
            updateSetting("selectedWebhookId", DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID);
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
    },
    [settings.publicKey, settings.secretKey, settings.selectedWebhookId, updateSetting, addToast],
  );

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
        fetchWebhooks(true);
      } else {
        if (isMounted) setSolidgateConnected(false);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, [settings.publicKey, settings.secretKey, fetchWebhooks]);

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
        if (
          settings.selectedWebhookId !== DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID &&
          !parsed.data.some((wh) => wh.id === settings.selectedWebhookId)
        ) {
          updateSetting("selectedWebhookId", DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID);
        }
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
  }, [saveSettings, settings.publicKey, settings.secretKey, settings.selectedWebhookId, updateSetting, addToast]);

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
          const payload = { url: completeUrl, status: "active" };
          const resStr = await invoke("update_solidgate_webhook", {
            publicKey: settings.publicKey,
            secretKey: settings.secretKey,
            webhookId: settings.selectedWebhookId,
            payloadJson: JSON.stringify(payload),
          });

          const parsed = JSON.parse(resStr);

          if (parsed.error) {
            addToast(`Failed to update webhook endpoint: error:${parsed.error.code} - ${parsed.error.message}`, "error");
            console.error("Failed to update webhook endpoint:", parsed.error);
            // Reset to default CREATE_NEW so user is not stuck on an invalid ID
            updateSetting("selectedWebhookId", DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID);
          } else {
            setActiveWebhookId(settings.selectedWebhookId);
            appendLog({
              type: "webhook",
              content: `Solidgate API: Successfully updated webhook [ID: ${settings.selectedWebhookId}] to ${completeUrl}`,
            });
          }
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
  }, [localPort, settings, updateSetting, clearLogs, appendLog, addToast]);

  const handleStopTunnel = useCallback(async () => {
    setLoading(true);
    try {
      await invoke("stop_local_tunnel");
      setWebhookUrl("");
      appendLog({ type: "system", content: "Tunnel process stopped." });
      addToast("Tunnel stopped.", "info");

      if (settings.publicKey && settings.secretKey && activeWebhookId) {
        const idToDelete = activeWebhookId;
        setActiveWebhookId(null);

        // Always reset target webhook setting to default ("CREATE_NEW") in settings & localStorage
        updateSetting("selectedWebhookId", DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID);

        // Remove deleted webhook from available list in state
        setAvailableWebhooks((prev) => prev.filter((wh) => wh.id !== idToDelete));

        appendLog({
          type: "system",
          content: `Deleting temporary endpoint ${idToDelete} from Solidgate...`,
        });
        try {
          await invoke("delete_solidgate_webhook", {
            publicKey: settings.publicKey,
            secretKey: settings.secretKey,
            webhookId: idToDelete,
          });
          appendLog({
            type: "webhook",
            content: `Solidgate API: Webhook ${idToDelete} successfully deleted.`,
          });
        } catch (delErr) {
          console.error(`Failed to delete webhook ${idToDelete} on Solidgate:`, delErr);
          appendLog({
            type: "error",
            content: `Failed to delete webhook ${idToDelete} on Solidgate: ${delErr}`,
          });
        }
      }
    } catch (err) {
      console.error("Failed to stop tunnel:", err);
      appendLog({ type: "error", content: `Failed to stop tunnel: ${err}` });
      addToast(`Failed to stop tunnel: ${err}`, "error");
    } finally {
      setLoading(false);
    }
  }, [settings.publicKey, settings.secretKey, activeWebhookId, updateSetting, appendLog, addToast]);

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
                {`v${__APP_VERSION__}`}
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

          {/* Help Modal Button */}
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 transition-all cursor-pointer shadow-sm flex items-center justify-center group"
            title="Help & Info (Shift+? or ⌘H)"
            aria-label="Open help and documentation"
          >
            <svg
              className="w-4 h-4 group-hover:scale-110 transition-transform duration-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          {/* Settings Modal Button */}
          <button
            onClick={() => {
              setShowSettings(true);
              fetchWebhooks(true);
            }}
            className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 transition-all cursor-pointer shadow-sm flex items-center justify-center group"
            title="Settings (⌘,)"
            aria-label="Open settings"
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
        {/* Decomposed & Validated Control Card */}
        <TunnelControl
          webhookUrl={webhookUrl}
          localPort={localPort}
          setLocalPort={setLocalPort}
          loading={loading}
          copied={copied}
          activeWebhookId={activeWebhookId}
          settings={settings}
          onStartTunnel={handleStartTunnel}
          onStopTunnel={handleStopTunnel}
          onCopyUrl={copyToClipboard}
          onOpenUrl={handleOpenUrl}
        />

        {/* High-Performance Terminal Console */}
        <TerminalLog
          logs={logs}
          onClearLogs={clearLogs}
          onCopyLogs={handleCopyLogs}
        />
      </main>

      {/* Settings Modal (Accessible with Focus Trap) */}
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

      {/* Help & Info Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

export default App;
