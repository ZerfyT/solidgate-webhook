import { memo, useMemo } from "react";
import { COMMON_PORTS, DEFAULT_SETTINGS } from "../constants";

function TunnelControlComponent({
  webhookUrl,
  localPort,
  setLocalPort,
  loading,
  copied,
  activeWebhookId,
  settings,
  onStartTunnel,
  onStopTunnel,
  onCopyUrl,
  onOpenUrl,
}) {
  // Validate port input: must be an integer between 1 and 65535
  const portValidation = useMemo(() => {
    if (!localPort || localPort.trim() === "") {
      return { isValid: false, message: "Port is required" };
    }
    const num = Number(localPort);
    if (!Number.isInteger(num) || num < 1 || num > 65535) {
      return { isValid: false, message: "Port must be 1 – 65535" };
    }
    return { isValid: true, message: null };
  }, [localPort]);

  return (
    <div className="w-full glass-panel rounded-2xl p-5 md:p-6 shadow-xl transition-all">
      {!webhookUrl ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Port Input Area */}
            <div className="flex flex-col gap-1">
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
                    min="1"
                    max="65535"
                    value={localPort}
                    onChange={(e) => setLocalPort(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !loading && portValidation.isValid) {
                        onStartTunnel();
                      }
                    }}
                    placeholder="8000"
                    disabled={loading}
                    className={`w-32 px-3.5 py-2 rounded-xl bg-slate-950/80 border font-mono text-sm focus:outline-none transition-all ${
                      !portValidation.isValid
                        ? "border-rose-500/80 text-rose-300 focus:ring-1 focus:ring-rose-500/50"
                        : "border-slate-700/80 text-white focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50"
                    }`}
                  />
                </div>

                {/* Preset quick port buttons */}
                <div className="hidden sm:flex items-center gap-1.5">
                  {COMMON_PORTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setLocalPort(p)}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                        localPort === p
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                          : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {!portValidation.isValid && (
                <span className="text-[11px] text-rose-400 font-medium pl-22">
                  {portValidation.message}
                </span>
              )}
            </div>

            {/* Start Button */}
            <button
              onClick={onStartTunnel}
              disabled={loading || !portValidation.isValid}
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
              (Synced with Solidgate when credentials are set)
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
                  onClick={onCopyUrl}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                    copied
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
                  onClick={onOpenUrl}
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
              onClick={onStopTunnel}
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
  );
}

export const TunnelControl = memo(TunnelControlComponent);
