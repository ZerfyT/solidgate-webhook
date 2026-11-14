# Solidgate Webhook Tunnel

A powerful, sleek Tauri desktop application designed to streamline testing and integrating Solidgate Webhooks. It acts as a UI wrapper around the [Tunnelmole](https://tunnelmole.com/) CLI to instantly expose your localhost to the internet, while natively syncing the generated URLs with your Solidgate API dashboard.

<div align="center">
  <img src="./public/screenshot-2.png" width="60%" alt="Solidgate Webhook Tunnel"/>
  <br/><br/>
  <img src="./public/screenshot-1.png" width="60%" alt="Solidgate Webhook Tunnel Terminal"/>
</div>

---

## ⚡ Key Features

### 🌐 Tunnel & Webhook Sync
- **Instant Localhost Tunnels:** One-click generation of secure, public HTTPS URLs forwarding to any local port using `tmole`.
- **Dual Mode (Solidgate & Standalone):** Use it with Solidgate API credentials for automated webhook registration, or without credentials as a fast, clean standalone tunnel tool.
- **Solidgate API Auto-Sync:** Automatically updates existing endpoints or registers new ones with your configured event types in Solidgate the moment the tunnel goes live.
- **Automatic Lifecycle Cleanup:** Automatically deletes temporary endpoints from Solidgate (`DELETE /api/v1/webhooks/endpoints/{id}`) when the tunnel stops, keeping your merchant dashboard uncluttered.
- **Stale Endpoint Protection:** Automatically resets targeting to `+ Create New Webhook Endpoint` whenever a webhook is deleted or missing, preventing requests to non-existent endpoint IDs.
- **Dynamic Embedded Webhook Server:** Includes an embedded Rust `axum` server with wildcard routing (`/{*path}`) and GET health checks that adapts to your target port. If an external service is already running on the port, traffic routes to your app without port-conflict panics.

### 🛡️ Security & Reliability
- **Native OS Keyring Storage:** Secret keys (`sk_...`) are **never stored in plaintext `localStorage`**. They are encrypted directly into your operating system's native credential manager:
  - **macOS:** Apple Keychain
  - **Windows:** Windows Credential Manager
  - **Linux:** FreeDesktop Secret Service API (via `zbus`) with owner-only (`0600`) file fallback.
- **Automatic Legacy Migration:** Automatically migrates any legacy plaintext keys into the OS Keyring and purges them from browser storage on startup.
- **Secure Backend Cryptography:** Solidgate API signatures (HMAC-SHA512) are computed exclusively inside the Rust backend, preventing your secret keys from ever being exposed to web views or logs.
- **Zombie Process Guard:** Window lifecycle hooks handle both `CloseRequested` and `Destroyed` events to guarantee child `tmole` processes are cleanly terminated on exit.
- **React Error Boundary:** Protects the UI against unexpected rendering exceptions with an integrated recovery and cache-clearing screen.
- **Input & Port Validation:** Strict validation for port numbers (1–65535) with inline feedback and disabled execution states for invalid values.

### 🔄 Tunnelmole Rate Limit Auto-Recovery
- **Rate Limit Detection:** Automatically monitors Tunnelmole CLI output for anonymous tier limits (10 tunnels per hour).
- **Silent Session Refresh:** Automatically refreshes the local anonymous session cache (`~/.tmole.sh/local-storage/clientId`) and retries the connection seamlessly so your workflow remains uninterrupted.
- **Real-Time Error Streaming:** Pipes all stderr and stdout diagnostic messages directly into the UI Terminal with red `[ERROR]` badges.

### 🚀 High-Performance React Terminal
- **RAF Log Batching (`requestAnimationFrame`):** High-frequency log chunks from Tunnelmole and rapid webhook hits are collected into a ref queue and flushed once per frame, sustaining a smooth 60 FPS UI without freezing.
- **Virtual-Optimized Rendering:** Employs CSS `content-visibility: auto` to eliminate layout overhead for off-screen log rows, supporting high-throughput test streams effortlessly.
- **Memory-Capped Circular Buffer:** Retains the latest 1,200 log entries to avoid browser memory leaks and DOM scrolling slowdowns during long test sessions.
- **Smart Non-Blocking Auto-Scroll:** Detects manual scrolling and pauses auto-scrolling when you scroll up to inspect logs, showing a floating `↓ Jump to bottom` button.
- **Search & Category Filters:** Instantly filter logs by text or switch categories: `All`, `Webhooks`, `Tunnel`, `System`, and `Errors` with live count badges.
- **Quick Terminal Actions:** 1-click **Copy Visible Logs** and **Clear Terminal**.

### 🎨 Developer Experience & UI/UX
- **Modern Glassmorphic UI:** Built with React 19, TailwindCSS v4, Inter typography, and JetBrains Mono code fonts.
- **Interactive In-App Help & Info:** Complete documentation modal with architecture diagrams, setup workflows, rate-limiting advice, and troubleshooting tips.
- **Accessible Dialogs:** Modal dialogs feature full keyboard focus trapping (`Tab` / `Shift+Tab`) and ARIA live regions for screen readers.
- **Quick Port Selector:** One-click presets (`8000`, `3000`, `5000`, `8080`, `4242`) with `Enter` key shortcut to launch.
- **Interactive Event Chips:** Clickable tag pills in Settings to toggle Solidgate webhook events without manual comma-separated typing.
- **Non-Intrusive Toasts:** Accessible floating toast notifications with `aria-live="polite"` for clipboard actions, save confirmations, and error alerts.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + ,` or `Cmd + ,` | Open / Toggle Settings Modal |
| `?` (Shift + `/`) or `Ctrl + H` / `Cmd + H` | Open / Toggle Help & Info Guide |
| `Enter` (in Port input) | Start Tunnel & Sync |
| `Ctrl + Enter` or `Cmd + Enter` | Save Settings (inside Settings Modal) |
| `Escape` | Close any active modal |
| `Tab` / `Shift + Tab` | Navigate focus within open modal |

---

## 📋 Prerequisites

- **Bun** (recommended frontend package manager)
- **Rust & Cargo** (for the Tauri desktop backend)
- **Tunnelmole CLI:** Ensure the `tmole` command is installed and available in your system `PATH`:

  ```bash
  bun install -g tunnelmole
  # Or via curl:
  # curl -O https://tunnelmole.com/sh/install.sh && sudo bash install.sh
  ```

---

## 🛠️ Getting Started

### 1. Install Dependencies

```bash
bun install
```

### 2. Run in Development Mode

```bash
bun run tauri dev
```

This launches the Vite local server and compiles the Tauri desktop app in debug mode with hot reloading.

### 3. Build for Production

```bash
bun run tauri build
```

The compiled native executable and installer packages (deb/appimage/dmg/msi) will be generated in `src-tauri/target/release/bundle/`.

---

## 📖 How to Use

### Mode A: Solidgate Automated Sync
1. Open **Settings** (Gear icon or `Cmd + ,`).
2. Enter your **Solidgate Public Key** and **Secret Key** (stored securely in your OS Keyring).
3. Click **Refresh List** to fetch your active endpoints from Solidgate.
4. Select `+ Create New Webhook` (auto-deleted upon tunnel stop) or choose an existing webhook endpoint to overwrite.
5. Select or toggle your desired event types using the quick event chips.
6. Click **Save Settings** (`Cmd + Enter`).
7. Enter your local server port (e.g. `8000`) and click **Start Tunnel & Sync**.

### Mode B: Standalone Tunnel
1. Leave the API keys blank in Settings.
2. Enter your desired local port on the home screen.
3. Click **Start Tunnel & Sync** (runs pure Tunnelmole without API sync).

---

## 🏗️ Architecture & Tech Stack

- **Desktop Framework:** [Tauri v2](https://v2.tauri.app/) (v2.12+)
- **Frontend:** [React 19](https://react.dev/), [Vite](https://vite.dev/), [TailwindCSS v4](https://tailwindcss.com/)
- **Native Security:** `keyring` (cross-platform OS credential manager integration)
- **Plugins:** `@tauri-apps/plugin-opener` (native external browser launcher)
- **Backend / CLI:** Rust, [Axum](https://github.com/tokio-rs/axum) (embedded webhook sink with wildcard routing), [Reqwest](https://github.com/seanmonstar/reqwest) (reusable connection pool client)
- **Cryptography:** `hmac`, `sha2`, `base64` (HMAC-SHA512 Solidgate request signature generation)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
