import React from 'react';

export default function InstallModal({ onInstall, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-6">
          <div className="bg-blue-500/20 text-blue-400 p-3 rounded-full shrink-0">
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Install Tunnelmole</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              The Tunnelmole CLI is required to securely expose your local server. It seems to be missing from your system. Would you like to install it now?
            </p>
            <p className="text-slate-400 text-xs mt-2 italic">
              Note: You may be prompted for your system password to complete the installation.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onInstall}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)] text-sm font-medium"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
