import TextInput from "./ui/text-input.jsx";

export default function SettingsModal({
  onClose,
  onSave,
  settings,
  updateSetting,
  availableWebhooks,
  fetchingWebhooks,
  fetchWebhooks,
  savingSettings,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6 w-full max-w-xl flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Solidgate API Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10 cursor-pointer"
            title="Close"
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <TextInput
            id="sgPublicKey"
            label="Public Key"
            value={settings.publicKey}
            onChange={(e) => updateSetting("publicKey", e.target.value)}
            inputType="text"
            placeholder="pk_..."
          />

          <TextInput
            id="sgSecretKey"
            label="Secret Key"
            value={settings.secretKey}
            onChange={(e) => updateSetting("secretKey", e.target.value)}
            inputType="password"
            placeholder="sk_..."
          />

          <TextInput
            id="sgWebhookSuffix"
            label="Webhook Suffix Path"
            value={settings.webhookSuffix}
            onChange={(e) => updateSetting("webhookSuffix", e.target.value)}
            inputType="text"
            placeholder="/api/webhook"
          />

          <TextInput
            id="sgEventTypes"
            label="Default Event Types (Comma separated)"
            value={settings.eventTypes}
            onChange={(e) => updateSetting("eventTypes", e.target.value)}
            inputType="text"
            placeholder="payment.success, payment.failed"
            inputClassName="h-20"
            isTextArea={true}
          />

          <div className="flex flex-col gap-2 bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 mt-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium text-slate-300">
                Target Webhook to Update
              </label>
              <button
                onClick={fetchWebhooks}
                disabled={fetchingWebhooks}
                className="text-xs bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-md hover:bg-blue-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1.5"
              >
                {fetchingWebhooks ? (
                  <>
                    <svg
                      className="animate-spin h-3 w-3"
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
                    Fetching...
                  </>
                ) : (
                  "Refresh List"
                )}
              </button>
            </div>
            <div className="relative">
              <select
                value={settings.selectedWebhookId}
                onChange={(e) =>
                  updateSetting("selectedWebhookId", e.target.value)
                }
                className="p-2.5 rounded-md bg-slate-900 border border-slate-600 text-white w-full appearance-none cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all pr-10"
              >
                <option
                  value="CREATE_NEW"
                  className="font-semibold text-blue-400"
                >
                  + Create New Webhook
                </option>
                {availableWebhooks.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.id} ({wh.url.split("://")[1]?.substring(0, 30)}...)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select an existing webhook to update its URL when the tunnel
              starts, or choose to create a new one.
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4 pt-2 border-t border-slate-700/50">
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to clear all settings cache?")) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors font-medium text-sm border border-transparent hover:border-red-500/30"
          >
            Clear Cache
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={savingSettings}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 font-semibold cursor-pointer transition-all shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)] hover:shadow-[0_0_20px_-3px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
            >
              {savingSettings ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Validating...
                </>
              ) : (
                "Save Settings"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
