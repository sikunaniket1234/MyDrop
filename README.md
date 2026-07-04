# MyDrop

**Self-hosted, cross-device sync platform. Share text, files, and clipboard content across your own devices — no cloud, no third party.**

MyDrop runs a sync hub on your desktop (Windows, macOS, or Linux). Mobile devices and a web client connect over your LAN or the internet via IP. All data stays on your infrastructure, encrypted at rest with AES-256.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Packages](#packages)
- [Getting Started](#getting-started)
- [Building the Android APK](#building-the-android-apk)
- [Running the Desktop Server](#running-the-desktop-server)
- [Connecting Mobile to Desktop](#connecting-mobile-to-desktop)
- [Pairing Devices](#pairing-devices)
- [API Reference](#api-reference)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Sync Engine
- **CRDT-based sync** — Hybrid Logical Clocks (HLC) and version vectors for conflict detection
- **WebSocket sync protocol** — Real-time bidirectional event push between peers
- **Conflict resolution** — Automatic classification (LOCAL_NEWER, REMOTE_NEWER, CONCURRENT, IDENTICAL) with manual "Keep A / Keep B / Keep Both" UI
- **Tombstone garbage collection** — Hourly cleanup of soft-deleted items with 30-day retention

### File Transfer
- **Chunked upload** — SHA-256 content-addressed 4 MB chunks with resumable download
- **File reconstruction** — Server-side chunk assembly and missing-chunk listing for resume
- **Download to device** — Files saved to device Downloads folder

### Security
- **Encryption at rest** — AES-256 encrypted SQLite database via op-sqlite
- **Vault key system** — Passphrase-based key derivation with salt
- **Transport encryption** — Optional self-signed TLS for HTTP server
- **6-digit pairing codes** — Device trust established via short codes

### Cross-Platform
- **Desktop** — HTTP + Socket.IO server, WebSocket sync, Quick Share (Ctrl+Shift+M)
- **Android** — Native SQLite, mDNS discovery, share intent from any app
- **Web** — Thin PWA client connected to any desktop node

### User Interface
- **Dark theme** — Consistent dark palette across all platforms
- **Inbox** — Unified item list with type filtering (Text, Link, File, Image, Voice)
- **Devices dashboard** — Online/offline status, trust dates, storage usage
- **Conflict resolution** — Side-by-side comparison with one-tap resolution

---

## Architecture

```
┌─────────────────────┐                          ┌─────────────────────┐
│   Android App       │    WebSocket / HTTP      │   Desktop Hub       │
│   (React Native)    │ ◄──────────────────────► │   (Node.js/Tauri)   │
│   - Sync Peer       │                          │   - REST API        │
│   - SQLite (OP)     │                          │   - Socket.IO       │
│   - mDNS Browser    │                          │   - Sync Engine     │
└─────────────────────┘                          │   - File Store      │
                                                 │   - Pairing Handler │
                                                 └─────────┬───────────┘
                                                           │
                                                 ┌─────────▼───────────┐
                                                 │   Web Client        │
                                                 │   (PWA)             │
                                                 └─────────────────────┘
```

**How it works:**
1. The desktop node runs an HTTP server on port **4317** with Socket.IO for real-time events and a dedicated WebSocket for the sync protocol.
2. Mobile devices pair via 6-digit codes, discover the hub via mDNS on the local network, and exchange items through the V1 sync engine.
3. Items created on any device propagate to all other paired devices in real time.

---

## Packages

| Package | Role | Technology |
|---------|------|------------|
| `@mydrop/core` | Sync engine, crypto, file store, REST handlers, protocol types | TypeScript, `@noble/hashes`, `@noble/curves` |
| `@mydrop/desktop` | HTTP + Socket.IO server, Tauri v2 shell, React UI | Node.js, Vite, React, Rust |
| `@mydrop/mobile` | Native Android/iOS app with SQLite, sync peer, share intent | React Native 0.86, op-sqlite |
| `@mydrop/web` | Thin PWA client (view + share, no local sync) | React, Vite |
| `@mydrop/serverless` | Wake/control-plane utilities | Node.js |

---

## Getting Started

### Prerequisites

- **Node.js 22+**
- **Corepack** (enabled via `corepack enable`)
- **Android SDK** (for APK build) — set `ANDROID_HOME` environment variable
- **JDK 21** — set `JAVA_HOME` environment variable
- **Rust toolchain** (only for Tauri desktop build)

### Installation

```sh
git clone https://github.com/sikunaniket1234/MyDrop.git
cd MyDrop
corepack enable
pnpm install
```

### Build Core

```sh
pnpm --filter @mydrop/core build
```

---

## Building the Android APK

```sh
# 1. Build core library
pnpm --filter @mydrop/core build

# 2. Navigate to android directory
cd packages/mydrop-mobile/android

# 3. Build release APK
set JAVA_HOME=C:\Program Files\Java\jdk-21.0.10
set ANDROID_HOME=C:\Users\<you>\AppData\Local\Android\Sdk
gradlew.bat assembleRelease --no-daemon -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease -x lintVitalDebug -x lint
```

**Output:** `packages/mydrop-mobile/android/app/build/outputs/apk/release/app-release.apk`

### First Launch
1. Install the APK on your Android device
2. On first launch, choose **Auto-Generated Key** (fastest) or **Set Passphrase**
3. Enter your desktop server IP in the connection bar (e.g., `192.168.1.10:4317`)
4. Tap **Go** — status should show **Connected**

---

## Running the Desktop Server

### Option 1: Start Script (Recommended)

Double-click `Start-MyDrop.bat` in the project root. This starts both the API server (port 4317) and Vite UI dev server (port 1420).

### Option 2: Manual

```sh
# Terminal 1: API server
pnpm --filter @mydrop/desktop dev:api

# Terminal 2: UI dev server
pnpm --filter @mydrop/desktop dev:ui
```

### Access Points

| Service | URL |
|---------|-----|
| REST API | `http://127.0.0.1:4317` |
| Desktop UI | `http://127.0.0.1:1420` |
| Health check | `http://127.0.0.1:4317/health` |

---

## Connecting Mobile to Desktop

1. Ensure both devices are on the same network
2. Find your desktop's WiFi IP:
   - **Windows:** `ipconfig` → look for Wi-Fi adapter IPv4 address
   - **macOS/Linux:** `ifconfig` or `ip addr`
3. In the mobile app, enter the IP in the format `IP:PORT` (e.g., `192.168.1.10:4317`)
4. Tap **Go**

> **Note:** The `http://` protocol prefix is added automatically if omitted.

---

## Pairing Devices

### From Desktop (Initiate)
1. Open the Desktop UI → **Devices** tab
2. Click **+ Pair new device**
3. A 6-digit code appears (expires in 5 minutes)

### From Mobile (Confirm)
1. Open the mobile app → **Pair** tab
2. Enter the 6-digit code from your desktop screen
3. Tap **Pair Device**
4. Both devices now show as paired and can sync

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health status |
| `/v1/items` | GET | List all items |
| `/v1/items` | POST | Create a new item |
| `/v1/items/:id` | PATCH | Update an item |
| `/v1/items/:id` | DELETE | Delete an item |
| `/v1/items/:id/conflicts` | GET | List conflicts for an item |
| `/v1/items/:id/resolve` | POST | Resolve a conflict |
| `/v1/devices` | GET | List all paired devices |
| `/v1/pairing/request` | POST | Initiate device pairing |
| `/v1/pairing/confirm` | POST | Confirm pairing with code |
| `/v1/devices/:id/revoke` | POST | Revoke device trust |
| `/v1/files/:id` | GET | Get file metadata |
| `/v1/files/:id/download` | GET | Download file |
| `/v1/files/:id/chunks` | GET | List file chunks |
| `/items` | GET | List alpha-format items |
| `/items/text` | POST | Create text item (alpha) |
| `/items/file` | POST | Create file item (alpha) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | React Native 0.86, TypeScript, op-sqlite, Socket.IO client |
| **Desktop** | Node.js, TypeScript, Vite, React, Socket.IO, better-sqlite3 |
| **Desktop Shell** | Tauri v2 (Rust), Windows/macOS/Linux |
| **Sync Engine** | CRDT with HLC timestamps, version vectors, event log |
| **Crypto** | `@noble/hashes` (SHA-256, HKDF), `@noble/curves` (Ed25519, X25519) |
| **Database** | SQLite via op-sqlite (mobile) / better-sqlite3 (desktop) |
| **Discovery** | mDNS (`_mydrop._tcp.local`) via react-native-zeroconf |
| **Build** | pnpm workspaces, Turborepo, Gradle (Android) |

---

## Project Structure

```
MyDrop/
├── packages/
│   ├── mydrop-core/           # Shared library (sync, crypto, API, DB)
│   │   ├── src/
│   │   │   ├── api/rest/      # REST API handlers
│   │   │   ├── api/ws/        # WebSocket protocol
│   │   │   ├── crypto/        # Ed25519, X25519, pairing
│   │   │   ├── db/            # SQLite migrations, client interface
│   │   │   ├── events/        # Event log, tombstone GC
│   │   │   ├── files/         # Chunking, content store, hashing
│   │   │   └── sync/          # Sync engine, HLC, version vectors
│   │   └── dist/              # Compiled output
│   ├── mydrop-desktop/        # Desktop app (server + UI)
│   │   ├── src/server/        # Node.js HTTP + Socket.IO server
│   │   ├── src/ui/            # React UI (Vite)
│   │   └── src-tauri/         # Tauri v2 Rust shell
│   ├── mydrop-mobile/         # Android/iOS app
│   │   ├── src/v1/            # Screen components, theme
│   │   ├── src/sync/          # Sync peer client, mDNS browser
│   │   ├── src/native/        # Share intent, platform APIs
│   │   └── android/           # Native Android project
│   ├── mydrop-web/            # Web PWA client
│   └── mydrop-serverless/     # Control plane utilities
├── Start-MyDrop.bat           # One-click desktop launcher
├── USER_MANUAL.md             # User manual with screenshots
└── README.md                  # This file
```

---

## Development Commands

```sh
# Typecheck all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Build core (required before typechecking mobile/desktop)
pnpm --filter @mydrop/core build

# Run tests
pnpm --filter @mydrop/core test

# Start mobile Metro bundler
pnpm --filter @mydrop/mobile start

# Start desktop dev servers
pnpm --filter @mydrop/desktop dev
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Network request failed" on mobile | Ensure desktop server is running and IP:port is correct. Check firewall allows port 4317. |
| Vault unlock hangs | Ensure using latest APK with `network_security_config.xml` for cleartext HTTP. |
| Pairing fails | Desktop must initiate first (Pair tab → shows code). Mobile enters that code. |
| Items not syncing | Check connection bar shows green checkmark. Items are posted to server, not local-only. |
| Desktop shows "Disconnected" | Restart API server (`pnpm --filter @mydrop/desktop dev:api`). |
| Build fails with hermesc | Create junction for hermesc in `node_modules` (see build instructions). |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -m 'Add my feature'`)
4. Push to branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

This project is private and proprietary. All rights reserved.
