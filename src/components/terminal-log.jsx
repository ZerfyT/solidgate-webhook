import { memo, useState, useMemo, useRef, useEffect, useCallback } from "react";

// Memoized individual log line for extreme performance
const LogItem = memo(function LogItem({ log }) {
  const badgeConfig = useMemo(() => {
    switch (log.type) {
      case "webhook":
        return {
          label: "WEBHOOK",
          badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          textColor: "text-emerald-300 font-medium",
        };
      case "system":
        return {
          label: "SYSTEM",
          badgeBg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
          textColor: "text-blue-200/90",
        };
      case "error":
        return {
          label: "ERROR",
          badgeBg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
          textColor: "text-rose-300 font-medium",
        };
      case "tunnel":
      default:
        return {
          label: "TUNNEL",
          badgeBg: "bg-slate-700/50 text-slate-300 border-slate-600/40",
          textColor: "text-slate-300",
        };
    }
  }, [log.type]);

  return (
    <div className="group flex items-start gap-2.5 py-1 px-2.5 rounded-md hover:bg-slate-800/40 transition-colors font-mono text-[13px] leading-relaxed break-all">
      <span className="text-slate-500 select-none shrink-0 text-xs mt-0.5">
        [{log.timestamp || new Date(typeof log.id === "number" ? log.id : Date.now()).toLocaleTimeString()}]
      </span>
      <span
        className={`px-1.5 py-0.2 shrink-0 text-[10px] font-semibold tracking-wider rounded border select-none ${badgeConfig.badgeBg}`}
      >
        {badgeConfig.label}
      </span>
      <span className={`flex-1 ${badgeConfig.textColor} selection:bg-blue-500/30`}>
        {log.content}
      </span>
    </div>
  );
});

function TerminalLogComponent({ logs = [], onClearLogs, onCopyLogs }) {
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const containerRef = useRef(null);

  // Compute counts efficiently
  const counts = useMemo(() => {
    let webhook = 0;
    let tunnel = 0;
    let system = 0;
    let error = 0;

    for (let i = 0; i < logs.length; i++) {
      const t = logs[i].type;
      if (t === "webhook") webhook++;
      else if (t === "tunnel") tunnel++;
      else if (t === "system") system++;
      else if (t === "error") error++;
    }

    return { all: logs.length, webhook, tunnel, system, error };
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let list = logs;
    if (filterType !== "all") {
      list = list.filter((l) => l.type === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((l) => l.content && l.content.toLowerCase().includes(q));
    }
    return list;
  }, [logs, filterType, searchQuery]);

  // High-performance direct scrolling (bypasses layout thrashing smooth scroll)
  const scrollToBottom = useCallback((instant = false) => {
    if (containerRef.current) {
      if (instant) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      } else {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
      setIsAtBottom(true);
    }
  }, []);

  // Handle scroll events to detect if user manually scrolled up
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceToBottom < 30;
    setIsAtBottom(nearBottom);
  }, []);

  // Auto-scroll when new logs arrive, only if autoScroll is enabled AND user hasn't scrolled up
  useEffect(() => {
    if (autoScroll && isAtBottom && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isAtBottom]);

  const handleCopyAll = () => {
    if (onCopyLogs) {
      onCopyLogs(filteredLogs);
    } else {
      const text = filteredLogs
        .map((l) => `[${l.timestamp || "LOG"}] [${l.type.toUpperCase()}] ${l.content}`)
        .join("\n");
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-slate-950/85 backdrop-blur-xl rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden mt-3 mb-6 transition-all">
      {/* Terminal macOS Header Bar */}
      <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-3">
          {/* macOS window controls */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-600/90 hover:opacity-100 transition-opacity" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/90 hover:opacity-100 transition-opacity" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/90 hover:opacity-100 transition-opacity" />
          </div>

          <div className="flex items-center gap-2 pl-2">
            <span className="text-xs font-mono font-medium text-slate-300 tracking-wider">
              TERMINAL LOGS
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-semibold">
              {logs.length}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-32 focus:w-44 transition-all duration-200 pl-7 pr-2.5 py-1 text-xs rounded-lg bg-slate-950/80 border border-slate-700/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80"
            />
            <svg
              className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1.5 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-white"
              >
                ×
              </button>
            )}
          </div>

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => setAutoScroll((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${autoScroll
                ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200"
              }`}
            title={autoScroll ? "Auto-scroll is ON" : "Auto-scroll is OFF"}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoScroll ? "bg-blue-400 animate-pulse" : "bg-slate-500"}`} />
            Auto-scroll
          </button>

          {/* Copy Logs */}
          <button
            onClick={handleCopyAll}
            disabled={filteredLogs.length === 0}
            className="px-2.5 py-1 rounded-lg border border-slate-700/60 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            title="Copy visible logs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy
          </button>

          {/* Clear Logs */}
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              disabled={logs.length === 0}
              className="px-2.5 py-1 rounded-lg border border-slate-700/60 bg-slate-800/50 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              title="Clear all logs"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="bg-slate-900/50 px-3 py-1.5 border-b border-slate-800/60 flex items-center gap-1 overflow-x-auto text-xs custom-scrollbar">
        {[
          { id: "all", label: "All", count: counts.all },
          { id: "webhook", label: "Webhooks", count: counts.webhook },
          { id: "tunnel", label: "Tunnel", count: counts.tunnel },
          { id: "system", label: "System", count: counts.system },
          { id: "error", label: "Errors", count: counts.error },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${filterType === tab.id
                ? "bg-slate-800 text-white shadow-sm border border-slate-700/80"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterType === tab.id
                  ? "bg-blue-500/20 text-blue-300 font-bold"
                  : "bg-slate-800/80 text-slate-500"
                }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Terminal Body with Virtual/Optimized List */}
      <div className="relative flex-1">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="p-3 overflow-y-auto h-[calc(100vh-360px)] min-h-70 terminal-body select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 italic gap-3 py-16 select-none">
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <svg
                  className="w-8 h-8 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span className="text-sm">
                {logs.length === 0
                  ? "No logs yet. Start the tunnel to begin capturing output."
                  : "No logs match your filter criteria."}
              </span>
            </div>
          ) : (
            filteredLogs.map((log) => <LogItem key={log.id} log={log} />)
          )}
        </div>

        {/* Floating jump to bottom pill if user scrolled up */}
        {!isAtBottom && logs.length > 0 && (
          <button
            onClick={() => scrollToBottom(false)}
            className="absolute bottom-4 right-6 bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border border-blue-400/30 backdrop-blur-md cursor-pointer transition-all flex items-center gap-1.5 animate-bounce"
          >
            <span>↓ Jump to bottom</span>
          </button>
        )}
      </div>
    </div>
  );
}

export const TerminalLog = memo(TerminalLogComponent);
