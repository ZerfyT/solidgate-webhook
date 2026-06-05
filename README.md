# Solidgate Webhook Tunnel

A powerful, sleek Tauri desktop application designed to streamline testing and integrating Solidgate Webhooks. It acts as a UI wrapper around the [Tunnelmole](https://tunnelmole.com/) CLI to instantly expose your localhost to the internet, while natively syncing the generated URLs with your Solidgate API dashboard.

![App Preview](https://via.placeholder.com/800x500.png?text=Solidgate+Webhook+Tunnel+UI) *(Replace with actual screenshot)*

## Features

- **Instant Localhost Tunnels:** One-click generation of secure, public HTTPS URLs forwarding to any local port using `tmole`.
- **Solidgate API Auto-Sync:** Automatically updates or creates Webhook Endpoints in your Solidgate Dashboard via API the moment a tunnel goes live.
- **Secure Backend Cryptography:** Solidgate API signatures (HMAC-SHA512) are generated securely in the Rust backend, ensuring your Secret Keys never leak to the frontend or browser inspector.
- **Built-in Dummy Webhook Server:** Ships with an embedded Rust `axum` server running on port `8000`. You can route your Solidgate webhooks to it for instant testing without needing your own local backend.
- **Real-Time Terminal Logs:** View active Tunnelmole logs and incoming webhook hits streaming live in a beautiful, auto-scrolling macOS-style terminal UI.
- **Premium Interface:** Built with React and TailwindCSS v4 featuring glassmorphism, responsive layouts, dark mode, and micro-animations.

## Prerequisites

- **Bun** (for frontend dependencies)
- **Rust / Cargo** (for the Tauri backend)
- **Tunnelmole CLI:** Ensure the `tmole` command is installed and available in your system `PATH`.
  ```bash
  npm install -g tunnelmole
  ```

## Getting Started

### 1. Install Dependencies
```bash
bun install
```

### 2. Run the App in Development Mode
```bash
bun run tauri dev
```
This command starts the Vite development server and launches the Tauri desktop application.

### 3. Build for Production
```bash
bun run tauri build
```

## How to Use Auto-Sync

1. Open the **Settings** (Gear Icon in the top right corner).
2. Enter your **Solidgate Public Key** and **Solidgate Secret Key**.
3. Click **Refresh List** to dynamically fetch your currently configured webhooks from the Solidgate API.
4. Select an existing Webhook to update, or select `+ Create New Webhook` and configure your default event types.
5. Return to the main screen, enter your local port (e.g. `8000`), and click **Start Tunnel & Sync**.

The app will generate the tunnel, append your configured URL suffix (e.g., `/webhook-solidgate`), and automatically `POST` or `PATCH` the endpoint in Solidgate.

## Tech Stack

- **Frontend:** React, Vite, TailwindCSS v4
- **Backend:** Rust, Tauri v2, Axum, Reqwest
- **Cryptography:** `hmac`, `sha2`, `base64` (for Solidgate API Request Signatures)

## License
MIT License.
