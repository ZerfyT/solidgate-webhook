export function TerminalLog({ logs, logsEndRef }) {
  return (
    <div className="flex-grow bg-[#0f172a] rounded-xl border border-slate-700/50 flex flex-col overflow-hidden shadow-2xl mb-8 mt-4">
      <div className="bg-slate-800/80 px-4 py-3 flex items-center border-b border-slate-700/50 backdrop-blur-sm">
        <div className="flex gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></span>
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></span>
          <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></span>
        </div>
        <span className="mx-auto text-slate-400 text-xs font-mono tracking-widest uppercase">
          Terminal Logs
        </span>
      </div>
      <div className="p-4 overflow-y-auto h-[calc(100vh-340px)] flex-grow font-mono text-sm leading-relaxed terminal-body scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
        {logs.length === 0 ? (
          <div className="text-slate-500 italic text-center mt-10 flex flex-col items-center gap-3">
            <svg
              className="w-10 h-10 opacity-30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              ></path>
            </svg>
            <span>No logs yet. Start the tunnel to see activity.</span>
          </div>
        ) : (
          logs.map((log) => {
            let colorClass = "text-slate-300";
            if (log.type === "webhook")
              colorClass = "text-emerald-400 font-medium";
            else if (log.type === "system") colorClass = "text-blue-400 italic";
            else if (log.type === "error")
              colorClass = "text-red-400 font-medium";

            return (
              <div
                key={log.id}
                className={`mb-2 break-all flex gap-3 ${colorClass} hover:bg-white/5 p-1 -mx-1 px-2 rounded transition-colors`}
              >
                <span className="text-slate-500 shrink-0 select-none">
                  [{new Date(log.id).toLocaleTimeString()}]
                </span>
                <span>{log.content}</span>
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
