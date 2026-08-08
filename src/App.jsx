import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import { STORAGE_KEYS, DEFAULT_SETTINGS } from "./constants";
import SettingsModal from "./components/settings-modal";
import { TerminalLog } from "./components/terminal-log";
import InstallModal from "./components/install-modal";
import { useSettings } from "./hooks/use-settings";

function App() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [localPort, setLocalPort] = useState(
    DEFAULT_SETTINGS.DEFAULT_LOCAL_PORT,
  );
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);

  // Settings State
  const { settings, updateSetting, saveSettings } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [availableWebhooks, setAvailableWebhooks] = useState([]);
  const [fetchingWebhooks, setFetchingWebhooks] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const logsEndRef = useRef(null);

  useEffect(() => {
    // Listen for Tunnelmole logs
    const unlistenTunnel = listen("tunnel-log", (event) => {
      setLogs((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          type: "tunnel",
          content: event.payload,
        },
      ]);
    });

    // Listen for Webhook hits
    const unlistenWebhook = listen("webhook-received", (event) => {
      setLogs((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          type: "webhook",
          content: `[Webhook Received]: ${event.payload}`,
        },
      ]);
    });

    return () => {
      unlistenTunnel.then((f) => f());
      unlistenWebhook.then((f) => f());
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSaveSettings = () => {
    saveSettings();
    setShowSettings(false);
  };

  const fetchWebhooks = async () => {
    if (!settings.publicKey || !settings.secretKey) {
      alert("Please enter Public and Secret keys to fetch webhooks.");
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
        if (parsed.data.length === 0) {
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
      }
    } catch (err) {
      console.error("Failed to fetch webhooks:", err);
      alert(`Error fetching webhooks: ${err}`);
    } finally {
      setFetchingWebhooks(false);
    }
  };

  const handleStartTunnel = async () => {
    if (!localPort) return;
    setLoading(true);
    setLogs([]); // Clear logs on start
    try {
      const isInstalled = await invoke("check_tunnelmole");
      if (!isInstalled) {
        setLoading(false);
        setShowInstallModal(true);
        return;
      }

      const baseUrl = await invoke("start_local_tunnel", { localPort });
      const completeUrl = `${baseUrl}${settings.webhookSuffix}`;
      setWebhookUrl(completeUrl);
      setLogs((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: "system",
          content: `Tunnel started at ${completeUrl} targeting local port ${localPort}`,
        },
      ]);
      setCopied(false);

      // Auto-Sync with Solidgate if keys are configured
      if (settings.publicKey && settings.secretKey) {
        setLogs((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            type: "system",
            content: `Syncing webhook endpoint with Solidgate API...`,
          },
        ]);

        if (
          settings.selectedWebhookId === DEFAULT_SETTINGS.SG_SELECTED_WEBHOOK_ID
        ) {
          const payload = {
            url: completeUrl,
            event_types: settings.eventTypes
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            name: "Local Tunnel Webhook",
            status: "active",
          };
          await invoke("create_solidgate_webhook", {
            publicKey: settings.publicKey,
            secretKey: settings.secretKey,
            payloadJson: JSON.stringify(payload),
          });
          setLogs((prev) => [
            ...prev,
            {
              id: Date.now() + 2,
              type: "webhook",
              content: `Solidgate API: Successfully Created new Webhook!`,
            },
          ]);
        } else {
          const payload = { url: completeUrl };
          await invoke("update_solidgate_webhook", {
            publicKey: settings.publicKey,
            secretKey: settings.secretKey,
            webhookId: settings.selectedWebhookId,
            payloadJson: JSON.stringify(payload),
          });
          setLogs((prev) => [
            ...prev,
            {
              id: Date.now() + 2,
              type: "webhook",
              content: `Solidgate API: Successfully Updated Webhook ID ${settings.selectedWebhookId}!`,
            },
          ]);
        }
      } else {
        setLogs((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            type: "system",
            content: `Skipped Solidgate Sync: API Keys not configured in settings.`,
          },
        ]);
      }
    } catch (err) {
      console.error("Tunnel initialization failed:", err);
      setLogs((prev) => [
        ...prev,
        { id: Date.now(), type: "error", content: `Error: ${err}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallTunnelmole = async () => {
    setShowInstallModal(false);
    setLoading(true);
    setLogs([
      {
        id: Date.now(),
        type: "system",
        content: "Starting Tunnelmole installation...",
      },
    ]);

    try {
      await invoke("install_tunnelmole");
      setLogs((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: "system",
          content: "Installation complete. Starting tunnel automatically...",
        },
      ]);
      // Wait a moment then automatically start tunnel
      setTimeout(() => {
        handleStartTunnel();
      }, 500);
    } catch (err) {
      console.error("Installation failed:", err);
      setLogs((prev) => [
        ...prev,
        { id: Date.now(), type: "error", content: `Installation Error: ${err}` },
      ]);
      setLoading(false);
    }
  };

  const handleStopTunnel = async () => {
    setLoading(true);
    try {
      await invoke("stop_local_tunnel");
      setWebhookUrl("");
      setLogs((prev) => [
        ...prev,
        { id: Date.now(), type: "system", content: "Tunnel stopped." },
      ]);
    } catch (err) {
      console.error("Failed to stop tunnel:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 bg-[radial-gradient(circle_at_top_right,_#1e293b,_#0f172a)] text-slate-50 flex justify-center font-sans relative">
      {/* Settings Button */}
      <button
        onClick={() => {
          setShowSettings(true);
          fetchWebhooks();
        }}
        className="absolute top-4 right-4 bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all border border-white/10 cursor-pointer"
        title="Settings"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          settings={settings}
          updateSetting={updateSetting}
          availableWebhooks={availableWebhooks}
          fetchingWebhooks={fetchingWebhooks}
          fetchWebhooks={fetchWebhooks}
        />
      )}

      <div className="w-full max-w-4xl p-2 flex flex-col gap-4 min-h-screen">
        <div className="text-center mt-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent py-1">
            Solidgate Tunnel
          </h1>
          <p className="text-slate-400 text-base mt-2">
            Secure localhost exposure for webhooks
          </p>
        </div>

        <div className="bg-slate-800/70 backdrop-blur-md border border-white/10 rounded-xl p-6 flex justify-center items-center shadow-[0_10px_15px_-3px_rgba(0,0,0,0.3)] mt-2">
          {!webhookUrl ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full justify-center">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label
                  htmlFor="portInput"
                  className="text-sm text-slate-400 font-medium whitespace-nowrap"
                >
                  Local Port:
                </label>
                <input
                  id="portInput"
                  type="number"
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  placeholder="e.g. 8000"
                  disabled={loading}
                  className="p-3 text-base rounded-lg border border-white/20 bg-slate-900/50 text-white w-full sm:w-32 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
              <button
                className={`px-8 py-3 text-base font-semibold rounded-lg cursor-pointer transition-all inline-flex items-center justify-center bg-blue-600 text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:bg-blue-500 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none ${loading ? "opacity-70 cursor-not-allowed transform-none" : ""}`}
                onClick={handleStartTunnel}
                disabled={loading || !localPort}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Starting...
                  </span>
                ) : (
                  "Start Tunnel & Sync"
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 w-full">
              <div className="flex flex-col items-center gap-3 w-full">
                <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
                  Live URL (Port {localPort})
                </span>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <a
                    href={webhookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 text-lg sm:text-xl font-mono no-underline bg-emerald-500/10 px-5 py-3 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all break-all text-center w-full sm:w-auto shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]"
                  >
                    {webhookUrl}
                  </a>
                  <button
                    className={`bg-white/5 border rounded-lg p-3 cursor-pointer flex items-center justify-center transition-all ${copied ? "text-emerald-400 border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_10px_-2px_rgba(16,185,129,0.2)]" : "text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"}`}
                    onClick={copyToClipboard}
                    title="Copy URL"
                  >
                    {copied ? (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        ></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                className={`px-8 py-3 text-base font-semibold rounded-lg cursor-pointer transition-all inline-flex items-center justify-center bg-slate-800 text-red-400 border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none mt-2 ${loading ? "opacity-70 cursor-not-allowed transform-none" : ""}`}
                onClick={handleStopTunnel}
                disabled={loading}
              >
                Stop Tunnel
              </button>
            </div>
          )}
        </div>

      {/* Install Modal */}
      {showInstallModal && (
        <InstallModal
          onCancel={() => setShowInstallModal(false)}
          onInstall={handleInstallTunnelmole}
        />
      )}

        {/* Logs Section */}
        <TerminalLog logs={logs} logsEndRef={logsEndRef} />
      </div>
    </div>
  );
}

export default App;
