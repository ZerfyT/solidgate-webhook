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

  const handleStartTunnel = async () => {
    if (!localPort) return;
    setLoading(true);
    setLogs([]); // Clear logs on start
    try {
      const completeUrl = await invoke('start_local_tunnel', { localPort });
      setWebhookUrl(completeUrl);
      setLogs((prev) => [...prev, { id: Date.now(), type: 'system', content: `Tunnel started at ${completeUrl} targeting local port ${localPort}` }]);
      setCopied(false);
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
    <div className="min-h-screen w-full bg-slate-900 bg-[radial-gradient(circle_at_top_right,_#1e293b,_#0f172a)] text-slate-50 flex justify-center font-sans">
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
                {loading ? 'Starting...' : 'Start Tunnel'}
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
          <div className="p-4 overflow-y-auto flex-grow font-mono text-sm leading-relaxed terminal-body">
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
