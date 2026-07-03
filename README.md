# MyDrop

**Self-hosted, cross-device sync platform.**

MyDrop lets you share text, files, and clipboard content across your own devices — no cloud, no third party. A desktop node acts as the sync hub; mobile devices and a thin web client connect over your LAN (or the internet via IP). Everything stays on your infrastructure.

---

## Features

### Synchronization
- **V1 Sync Engine** — Conflict-free replicated data type (CRDT) based sync with HLC timestamps and version vectors
- **WebSocket Sync Protocol** — Real-time event push between peers
- **Sync Peer Client (Mobile)** — Connects to desktop hub, syncs items bidirectionally
- **Tombstone GC** — Hourly cleanup of soft-deleted items (30-day retention)

### Pairing & Discovery
- **6-digit pairing codes** — Desktop generates a code; mobile pairs by entering it on the desktop UI
- **mDNS LAN Discovery** — Mobile auto-discovers desktop nodes on the local network (fallback: manual IP entry)
- **Device Management** — List paired devices, see online/offline status, revoke trust

### File Transfer
- **Chunked File Upload** — SHA-256 content-addressed 4 MB chunks; resumable download
- **File Store** — Server-side chunk assembly and missing-chunk listing for resume

### Security
- **Encryption at Rest (Vault)** — AES-256 encrypted local database via op-sqlite
- **Vault Key UI** — Passphrase prompt on mobile (first-launch setup + subsequent unlock) and desktop settings tab
- **HKDF Key Derivation** — Passphrase → PBKDF2 → Vault key → HKDF → DB encryption key
- **Transport Encryption (TLS)** — Optional self-signed TLS for HTTP server (requires `openssl`)
- **End-to-end pairing** — QR codes and Ed25519 trust model (E2E encryption deferred to post-V1)

### Cross-Platform
- **Desktop (Tauri v2)** — HTTP + Socket.IO server, WebSocket sync, tray icon, clipboard monitoring
- **Mobile (React Native 0.86)** — Native SQLite via op-sqlite, image/file picker, mDNS browser
- **Web (PWA)** — Thin client that connects to any desktop node, installable to homescreen
- **Android Share Intent** — ANY file/text/image from any app can be shared directly to MyDrop

### UI
- **Inbox** — Unified item list (text, files, images, clipboard entries)
- **Devices Dashboard** — Online/offline status dots, trust dates, last seen
- **Conflict Resolution** — Conflict badge, expandable sheet with Accept / Keep-both

---

## Packages

| Package | Role | Platform |
|---|---|---|
| `@mydrop/core` | Sync engine, vault, file store, protocol types | All |
| `@mydrop/desktop` | HTTP + WebSocket server, Tauri shell, React UI | Windows / macOS / Linux |
| `@mydrop/mobile` | Native app with SQLite, sync peer, file picker | Android / iOS |
| `@mydrop/web` | Thin PWA client (no sync peer) | Browser |
| `@mydrop/serverless` | Wake/control-plane utilities | Node.js |

---

## Prerequisites

- Node.js 22+
- Corepack
- Rust toolchain (only for Tauri desktop build)
- OpenSSL (only for TLS cert auto-generation)

## Setup

```sh
corepack enable
pnpm install
```

## Development

```sh
pnpm --filter @mydrop/core build
pnpm --filter @mydrop/desktop dev     # starts HTTP server on :4317 + UI dev server
pnpm --filter @mydrop/mobile start    # starts React Native Metro bundler
```

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm build
```

---

## Architecture

```
┌──────────────┐     WebSocket / HTTP      ┌──────────────┐
│  Mobile App  │ ◄──────────────────────► │  Desktop Hub  │
│  (RN - Peer) │                          │  (Tauri/Node) │
└──────────────┘                          └──────┬───────┘
                                                 │
                                        ┌────────▼───────┐
                                        │  Web Thin Client│
                                        │  (PWA - Viewer) │
                                        └────────────────┘
```

The desktop node runs an HTTP server (port 4317) with Socket.IO for real-time events and a dedicated WebSocket for the sync protocol. Mobile devices pair via 6-digit codes, discover the hub via mDNS, and exchange items through the V1 sync engine.

---

## Roadmap Status

All P0–P3 items are implemented. See [`docs/`](docs/) and [`ai/`](ai/) for detailed design documents and architecture decisions.

### What's left
- Tauri binary build (requires Rust toolchain not present on dev machine)
- Vault key management UI polish (passphrase change, biometric unlock)
- Web thin client polish
- Testing on real hardware/emulators
