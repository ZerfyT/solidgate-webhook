import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

function App() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [localPort, setLocalPort] = useState('8000');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [copied, setCopied] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [sgPublicKey, setSgPublicKey] = useState(localStorage.getItem('sgPublicKey') || '');
  const [sgSecretKey, setSgSecretKey] = useState(localStorage.getItem('sgSecretKey') || '');
  const [sgWebhookSuffix, setSgWebhookSuffix] = useState(localStorage.getItem('sgWebhookSuffix') || '/webhook-solidgate');
  const [sgEventTypes, setSgEventTypes] = useState(localStorage.getItem('sgEventTypes') || 'card_gate.order.updated, card_gate.chargeback.received, card_gate.fraud_alert.received');
  const [sgSelectedWebhookId, setSgSelectedWebhookId] = useState(localStorage.getItem('sgSelectedWebhookId') || 'CREATE_NEW');
  const [availableWebhooks, setAvailableWebhooks] = useState([]);
  const [fetchingWebhooks, setFetchingWebhooks] = useState(false);

  const logsEndRef = useRef(null);

  useEffect(() => {
    // Listen for Tunnelmole logs
    const unlistenTunnel = listen('tunnel-log', (event) => {
      setLogs((prev) => [...prev, { id: Date.now() + Math.random(), type: 'tunnel', content: event.payload }]);
    });

    // Listen for Webhook hits
    const unlistenWebhook = listen('webhook-received', (event) => {
      setLogs((prev) => [...prev, { id: Date.now() + Math.random(), type: 'webhook', content: `[Webhook Received]: ${event.payload}` }]);
    });

    return () => {
      unlistenTunnel.then((f) => f());
      unlistenWebhook.then((f) => f());
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const saveSettings = () => {
    localStorage.setItem('sgPublicKey', sgPublicKey);
    localStorage.setItem('sgSecretKey', sgSecretKey);
    localStorage.setItem('sgWebhookSuffix', sgWebhookSuffix);
    localStorage.setItem('sgEventTypes', sgEventTypes);
    localStorage.setItem('sgSelectedWebhookId', sgSelectedWebhookId);
    setShowSettings(false);
  };

  const fetchWebhooks = async () => {
    if (!sgPublicKey || !sgSecretKey) {
      alert("Please enter Public and Secret keys to fetch webhooks.");
      return;
    }
    setFetchingWebhooks(true);
    try {
      const response = await invoke('get_solidgate_webhooks', {
        publicKey: sgPublicKey,
        secretKey: sgSecretKey,
      });
      const parsed = JSON.parse(response);
      if (parsed.data) {
        setAvailableWebhooks(parsed.data);
        if (parsed.data.length === 0) {
          setSgSelectedWebhookId('CREATE_NEW');
        } else if (sgSelectedWebhookId === 'CREATE_NEW' && !localStorage.getItem('sgSelectedWebhookId')) {
          setSgSelectedWebhookId(parsed.data[0].id);
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
      const baseUrl = await invoke('start_local_tunnel', { localPort });
      const completeUrl = `${baseUrl}${sgWebhookSuffix}`;
      setWebhookUrl(completeUrl);
      setLogs((prev) => [...prev, { id: Date.now(), type: 'system', content: `Tunnel started at ${completeUrl} targeting local port ${localPort}` }]);
      setCopied(false);

      // Auto-Sync with Solidgate if keys are configured
      if (sgPublicKey && sgSecretKey) {
        setLogs((prev) => [...prev, { id: Date.now() + 1, type: 'system', content: `Syncing webhook endpoint with Solidgate API...` }]);

        if (sgSelectedWebhookId === 'CREATE_NEW') {
          const payload = {
            url: completeUrl,
            event_types: sgEventTypes.split(',').map(s => s.trim()).filter(s => s),
            name: "Local Tunnel Webhook",
            status: "active"
          };
          await invoke('create_solidgate_webhook', {
            publicKey: sgPublicKey,
            secretKey: sgSecretKey,
            payloadJson: JSON.stringify(payload)
          });
          setLogs((prev) => [...prev, { id: Date.now() + 2, type: 'webhook', content: `Solidgate API: Successfully Created new Webhook!` }]);
        } else {
          const payload = { url: completeUrl };
          await invoke('update_solidgate_webhook', {
            publicKey: sgPublicKey,
            secretKey: sgSecretKey,
            webhookId: sgSelectedWebhookId,
            payloadJson: JSON.stringify(payload)
          });
          setLogs((prev) => [...prev, { id: Date.now() + 2, type: 'webhook', content: `Solidgate API: Successfully Updated Webhook ID ${sgSelectedWebhookId}!` }]);
        }
      } else {
        setLogs((prev) => [...prev, { id: Date.now() + 1, type: 'system', content: `Skipped Solidgate Sync: API Keys not configured in settings.` }]);
      }

    } catch (err) {
      console.error("Tunnel initialization failed:", err);
      setLogs((prev) => [...prev, { id: Date.now(), type: 'error', content: `Error: ${err}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleStopTunnel = async () => {
    setLoading(true);
    try {
      await invoke('stop_local_tunnel');
      setWebhookUrl('');
      setLogs((prev) => [...prev, { id: Date.now(), type: 'system', content: 'Tunnel stopped.' }]);
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
        onClick={() => { setShowSettings(true); fetchWebhooks(); }}
        className="absolute top-4 right-4 bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all border border-white/10"
        title="Settings"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-white/10 rounded-xl p-6 w-full max-w-lg flex flex-col gap-4 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Solidgate API Settings</h2>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Public Key</label>
              <input type="text" value={sgPublicKey} onChange={e => setSgPublicKey(e.target.value)} className="p-2 rounded bg-slate-900 border border-white/10 text-white" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Secret Key</label>
              <input type="password" value={sgSecretKey} onChange={e => setSgSecretKey(e.target.value)} className="p-2 rounded bg-slate-900 border border-white/10 text-white" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Webhook Suffix</label>
              <input type="text" value={sgWebhookSuffix} onChange={e => setSgWebhookSuffix(e.target.value)} className="p-2 rounded bg-slate-900 border border-white/10 text-white" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-400">Default Event Types (Comma separated)</label>
              <textarea value={sgEventTypes} onChange={e => setSgEventTypes(e.target.value)} className="p-2 rounded bg-slate-900 border border-white/10 text-white h-20 text-sm" />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-end mb-1">
                <label className="text-sm text-slate-400">Target Webhook to Update</label>
                <button onClick={fetchWebhooks} disabled={fetchingWebhooks} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-500/30">
                  {fetchingWebhooks ? 'Fetching...' : 'Refresh List'}
                </button>
              </div>
              <select
                value={sgSelectedWebhookId}
                onChange={e => setSgSelectedWebhookId(e.target.value)}
                className="p-2 rounded bg-slate-900 border border-white/10 text-white w-full"
              >
                <option value="CREATE_NEW">+ Create New Webhook</option>
                {availableWebhooks.map(wh => (
                  <option key={wh.id} value={wh.id}>
                    {wh.id} ({wh.url.split('://')[1]?.substring(0, 25)}...)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 rounded text-slate-300 hover:bg-white/10">Cancel</button>
              <button onClick={saveSettings} className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-400 font-semibold">Save Settings</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-3xl p-4 sm:p-8 flex flex-col gap-8 min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">Solidgate Tunnel</h1>
          <p className="text-slate-400 text-base">Secure localhost exposure for webhooks</p>
        </div>

        <div className="bg-slate-800/70 backdrop-blur-md border border-white/10 rounded-xl p-8 flex justify-center items-center shadow-[0_10px_15px_-3px_rgba(0,0,0,0.3)]">
          {!webhookUrl ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 w-full justify-center">
              <div className="flex flex-col gap-2">
                <label htmlFor="portInput" className="text-sm text-slate-400 font-medium">Local Port:</label>
                <input
                  id="portInput"
                  type="number"
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  placeholder="e.g. 8000"
                  disabled={loading}
                  className="p-3 text-base rounded-lg border border-white/20 bg-slate-900/50 text-white w-full sm:w-32 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button
                className={`px-8 py-3 text-base font-semibold rounded-lg cursor-pointer transition-all inline-flex items-center justify-center h-[46px] bg-blue-500 text-white shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:bg-blue-400 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none ${loading ? 'opacity-70 cursor-not-allowed transform-none' : ''}`}
                onClick={handleStartTunnel}
                disabled={loading || !localPort}
              >
                {loading ? 'Starting...' : 'Start Tunnel & Sync'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 w-full">
              <div className="flex flex-col items-center gap-2 w-full">
                <span className="text-sm text-slate-400 uppercase tracking-wider">Live URL (Port {localPort}):</span>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  <a href={webhookUrl} target="_blank" rel="noreferrer" className="text-emerald-500 text-lg sm:text-xl font-semibold no-underline bg-emerald-500/10 px-4 py-2 rounded-md border border-emerald-500/20 hover:bg-emerald-500/20 transition-all break-all text-center w-full sm:w-auto">
                    {webhookUrl}
                  </a>
                  <button
                    className={`bg-white/10 border rounded-md p-2 cursor-pointer flex items-center justify-center transition-all ${copied ? 'text-emerald-500 border-emerald-500 bg-emerald-500/10' : 'text-white border-white/10 hover:bg-white/20'}`}
                    onClick={copyToClipboard}
                    title="Copy URL"
                  >
                    {copied ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                className={`px-8 py-3 text-base font-semibold rounded-lg cursor-pointer transition-all inline-flex items-center justify-center h-[46px] bg-red-500 text-white shadow-[0_4px_14px_0_rgba(239,68,68,0.39)] hover:bg-red-400 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none ${loading ? 'opacity-70 cursor-not-allowed transform-none' : ''}`}
                onClick={handleStopTunnel}
                disabled={loading}
              >
                Stop Tunnel
              </button>
            </div>
          )}
        </div>

        <div className="flex-grow bg-[#020617] rounded-xl border border-white/10 flex flex-col overflow-hidden shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] mb-8">
          <div className="bg-slate-800 px-4 py-3 flex items-center border-b border-white/5">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
              <span className="w-3 h-3 rounded-full bg-[#27c93f]"></span>
            </div>
            <span className="mx-auto text-slate-400 text-sm font-mono">Terminal Logs</span>
          </div>
          <div className="p-4 overflow-y-auto h-[calc(100vh-200px)] flex-grow font-mono text-sm leading-relaxed terminal-body">
            {logs.length === 0 ? (
              <div className="text-slate-400 italic text-center mt-8">No logs yet. Start the tunnel to see activity.</div>
            ) : (
              logs.map((log) => {
                let colorClass = "text-slate-200";
                if (log.type === "webhook") colorClass = "text-emerald-500 font-bold";
                else if (log.type === "system") colorClass = "text-blue-500 italic";
                else if (log.type === "error") colorClass = "text-red-500";

                return (
                  <div key={log.id} className={`mb-1 break-all ${colorClass}`}>
                    <span className="text-slate-500 mr-2">[{new Date(log.id).toLocaleTimeString()}]</span> {log.content}
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
