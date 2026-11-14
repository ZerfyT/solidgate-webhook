import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-rose-500/30 font-sans">
          <div className="max-w-md w-full bg-slate-900/90 border border-rose-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Application Error Encountered
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                An unexpected error prevented the interface from rendering properly.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-left font-mono text-xs text-rose-300 break-all max-h-32 overflow-y-auto custom-scrollbar">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex items-center gap-3 w-full mt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition-all cursor-pointer font-medium"
              >
                Clear Cache & Reset
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs text-white transition-all cursor-pointer font-semibold shadow-lg shadow-blue-600/30"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
