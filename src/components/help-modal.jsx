import { memo, useState, useEffect, useRef } from "react";

function HelpModalComponent({ onClose }) {
  const [activeTab, setActiveTab] = useState("overview");
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Focus management & accessible keyboard trap
  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    const timer = setTimeout(() => {
      if (modalRef.current) {
        const closeBtn = modalRef.current.querySelector("button");
        closeBtn?.focus();
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Tab") {
        if (!modalRef.current) return;
        const focusable = modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-slate-900/95 border border-slate-700/70 rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
              </svg>
            </div>
            <div>
              <h2 id="help-modal-title" className="text-lg font-bold text-white tracking-tight">
                Help & Information Guide
              </h2>
              <p className="text-xs text-slate-400">
                Architecture, setup, webhook lifecycle, and Tunnelmole limitations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
            title="Close (Esc)"
            aria-label="Close help modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/20 text-xs overflow-x-auto custom-scrollbar">
          {[
            { id: "overview", label: "Overview & Workflow" },
            { id: "limitations", label: "Tunnelmole & Rate Limits" },
            { id: "solidgate", label: "Solidgate Sync & Security" },
            { id: "troubleshooting", label: "Troubleshooting & FAQ" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400 font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-5 text-sm text-slate-300">
          {activeTab === "overview" && (
            <div className="flex flex-col gap-4">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  What is Solidgate Webhook Tunnel?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Solidgate Webhook Tunnel is a developer utility designed to test and debug Solidgate payment webhooks locally. It bridges the gap between Solidgate's cloud API servers and your local development machine without requiring public server deployment or manual URL updating.
                </p>
              </div>

              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  How The Data Flows
                </h4>
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 text-xs font-mono">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center flex-1">
                    <span className="text-blue-400 font-semibold block">1. Solidgate API</span>
                    <span className="text-slate-500 text-[11px]">Dispatches webhook</span>
                  </div>
                  <span className="text-slate-600 text-center self-center">→</span>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center flex-1">
                    <span className="text-emerald-400 font-semibold block">2. Tunnelmole URL</span>
                    <span className="text-slate-500 text-[11px]">https://xxx.tunnelmole.net</span>
                  </div>
                  <span className="text-slate-600 text-center self-center">→</span>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-center flex-1">
                    <span className="text-indigo-400 font-semibold block">3. Local Port</span>
                    <span className="text-slate-500 text-[11px]">localhost:8000 (Your App)</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-col gap-2 text-xs">
                <h4 className="font-semibold text-slate-200">Two Operating Modes</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                  <li>
                    <strong className="text-slate-300">Synchronized Mode (Recommended):</strong> When Solidgate API keys are configured, starting a tunnel automatically registers the live URL with Solidgate, and stopping the tunnel automatically deletes the endpoint.
                  </li>
                  <li>
                    <strong className="text-slate-300">Standalone Tunnel Mode:</strong> Leave API credentials blank in Settings. The app operates as a fast, high-performance general localhost exposure proxy.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "limitations" && (
            <div className="flex flex-col gap-4">
              {/* Important Alert on 10 Tunnels/Hour limit */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-200 text-xs flex flex-col gap-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-300 uppercase tracking-wide">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Tunnelmole Anonymous Rate Limit (10 Tunnels/Hour)</span>
                </div>
                <p className="leading-relaxed">
                  Tunnelmole’s free tier allows up to <strong>10 tunnel creations per hour</strong> for unauthenticated sessions. If you start and stop the tunnel more than 10 times in an hour, Tunnelmole's server will reject new connection attempts.
                </p>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex flex-col gap-3 text-xs">
                <h4 className="font-semibold text-white">How This App Handles Rate Limits</h4>
                <p className="text-slate-400 leading-relaxed">
                  Our Rust backend automatically inspects Tunnelmole output. When a rate limit warning is detected, it automatically clears the local anonymous session cache (<code className="text-blue-300">~/.tmole.sh/local-storage/clientId</code>) and immediately retries with a fresh session so your work is not interrupted.
                </p>

                <h4 className="font-semibold text-white pt-2 border-t border-slate-800">
                  Upgrading to Unlimited Tunnels & Custom Subdomains
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  If you have a Tunnelmole subscription, you can set your API key in your system terminal:
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-emerald-400 text-xs">
                  tmole --set-api-key &lt;YOUR_TUNNELMOLE_API_KEY&gt;
                </div>
                <p className="text-slate-500 text-[11px]">
                  Setting an API key eliminates hourly limits and allows reserving persistent subdomains (e.g. <code className="text-slate-400">myapi.tunnelmole.net</code>).
                </p>
              </div>

              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-xs flex flex-col gap-2">
                <h4 className="font-semibold text-white">Tunnelmole Installation</h4>
                <p className="text-slate-400">
                  Ensure the Tunnelmole binary is installed in your system PATH:
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-blue-300 text-xs">
                  curl -O https://tunnelmole.com/sh/install.sh &amp;&amp; sudo bash install.sh
                </div>
              </div>
            </div>
          )}

          {activeTab === "solidgate" && (
            <div className="flex flex-col gap-4 text-xs">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Native OS Keyring Security
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Your Solidgate Merchant Secret Key (<code className="text-slate-300">sk_...</code>) is <strong>never stored in plaintext browser localStorage</strong>. Instead, it is saved directly into your operating system's native secure credential manager:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
                  <li><strong>macOS:</strong> Apple Keychain</li>
                  <li><strong>Windows:</strong> Windows Credential Manager</li>
                  <li><strong>Linux:</strong> FreeDesktop Secret Service API (via zbus) with owner-only (0600) permission fallback</li>
                </ul>
              </div>

              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-col gap-2.5">
                <h4 className="font-semibold text-white">Target Endpoint Options</h4>
                <div className="flex flex-col gap-2 text-slate-400">
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-semibold text-blue-300 block mb-0.5">
                      + Create New Webhook Endpoint (Disposable)
                    </span>
                    <span>
                      Registers a dedicated test endpoint in Solidgate. When you click "Stop Tunnel", the endpoint is automatically deleted from Solidgate, leaving zero leftover test endpoints in your dashboard.
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="font-semibold text-indigo-300 block mb-0.5">
                      Target Existing Endpoint
                    </span>
                    <span>
                      Overwrites an existing webhook endpoint in Solidgate with your live tunnel URL. On stop, settings automatically revert to default to avoid targeting stale IDs.
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
                <h4 className="font-semibold text-white">Solidgate Signature Verification</h4>
                <p className="text-slate-400 leading-relaxed">
                  Solidgate API requests are signed using <strong className="text-slate-300">HMAC-SHA512</strong> based on your public and secret keys:
                </p>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400">
                  Signature = Base64(Hex(HMAC-SHA512(Key: SecretKey, Data: PublicKey + Body + PublicKey)))
                </div>
              </div>
            </div>
          )}

          {activeTab === "troubleshooting" && (
            <div className="flex flex-col gap-3 text-xs">
              <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
                <h4 className="font-semibold text-white">Port already in use error?</h4>
                <p className="text-slate-400">
                  You can change the Local Port in the input field to any available port between 1 and 65535 (e.g. 3000, 5000, 8080). If your own server is already running on port 8000, Tunnelmole will automatically forward traffic to your running server without crashing.
                </p>
              </div>

              <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
                <h4 className="font-semibold text-white">Where do I see incoming webhooks?</h4>
                <p className="text-slate-400">
                  Incoming webhook deliveries will display in the Terminal Logs at the bottom of the window with the green <code className="text-emerald-400">[WEBHOOK]</code> badge. You can use the search bar or the "Webhooks" filter tab to isolate webhook payloads.
                </p>
              </div>

              <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
                <h4 className="font-semibold text-white">Keyboard Shortcuts</h4>
                <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-[11px]">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Open Settings:</span>
                    <span className="text-blue-300">⌘, / Ctrl+,</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Open Help:</span>
                    <span className="text-blue-300">? / Ctrl+H</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Save in Modal:</span>
                    <span className="text-blue-300">⌘+Enter</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Close Modal:</span>
                    <span className="text-blue-300">Esc</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <span className="text-xs text-slate-500 font-mono">
            Solidgate Webhook Tunnel v{__APP_VERSION__}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold cursor-pointer transition-all shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)]"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}

export const HelpModal = memo(HelpModalComponent);
