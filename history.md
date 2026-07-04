# MyDrop Development History

## Project Overview
- **Monorepo** at `C:\Users\User\Downloads\Mydrop` using pnpm + turborepo
- **Packages:** `mydrop-core`, `mydrop-desktop`, `mydrop-mobile`, `mydrop-web`
- **Tech Stack:** React Native 0.86, Tauri v2, Node.js, SQLite (op-sqlite / better-sqlite3)
- **Git Remote:** `https://github.com/sikunaniket1234/MyDrop.git`
- **Android Emulator:** Pixel_9 AVD
- **Build env:** JAVA_HOME=`C:\Program Files\Java\jdk-21.0.10`, ANDROID_HOME=`C:\Users\User\AppData\Local\Android\Sdk`

---

## Phase A — Core Infrastructure (Complete)

### A1: Crypto Module
- **identity.ts** — Ed25519 keypair generation, sign, verify, base64 serialization (`@noble/curves/ed25519`)
- **pairing.ts** — X25519 ECDH shared secret, HKDF session key, AES-256-GCM vault key encrypt/decrypt, 6-digit pairing token, QR payload

### A2: Event Log + Tombstones
- **event-log.ts** — `EventLog` class: append events, `getEventsSince` with HLC cursor
- **tombstone-gc.ts** — `TombstoneGc` class: 30-day retention sweep

### A3: File Chunking
- **chunker.ts** — Stateless 4MB chunking, reconstruct, missing-indices
- **content-store.ts** — DB-backed chunked content-addressable storage by SHA-256 hash
- **hash.ts** — SHA-256 with `@noble/hashes` (replaced Web Crypto for Hermes compatibility)

### A4: SQL Migrations
- 5 migration files (0001–0005): devices, items, files, sync_events, tombstones, conflicts, tags
- `migrations.ts` — `migrate()`, `StaticMigrationSource`, `ALL_MIGRATIONS`

---

## Phase B — REST API + WebSocket Protocol (Complete)

### REST Handlers
- **items.ts** — List, create, update, delete, list conflicts, resolve
- **devices.ts** — List, initiate pairing, confirm pairing, revoke
- **files.ts** — Get file info, get chunk data, download, reconstruct
- **share.ts** — Universal share endpoint
- **health.ts** — Health dashboard (device count + storage)

### WebSocket
- **ui-server.ts** — Event subscription + polling for live UI
- **sync-server.ts** — Node-to-node sync protocol (hello, request_since, events, ack)

---

## Phase C — Native Share Integration (Complete)

- **Android** — `ShareIntentHandler.ts` listens for ACTION_SEND intents, parses text/image/file URIs
- **iOS** — Share Extension stub with setup instructions
- **Desktop** — `QuickShare.tsx` popup with Ctrl+Shift+M hotkey

---

## Phase D — Tests (Complete)
- 46 unit tests passing across core modules

---

## Tauri Desktop Shell (Complete)
- Rust 1.96.1 + VS 2022 Build Tools
- Tauri v2 config with shell, clipboard, global-shortcut, notification plugins
- `cargo check` passes

---

## Vault System (Complete)

### Vault Screen Fixes (Critical)
- **Stale closure bug** — `handleVaultUnlock()` read React state (`passphrase`) that hadn't updated. Fixed by passing passphrase as parameter.
- **Hermes microtask hang** — `deriveVaultKeyFromPassphrase` declared `async` with only sync code caused Hermes to hang on `await`. Fixed by making it a plain sync function (non-`async`).
- **op-sqlite `open()` sync wrap** — `Promise.resolve(open(...))` didn't catch sync throws. Made adapter `async` with `await`.
- **Non-idempotent V1_SCHEMA_SQL** — `CREATE TABLE applied_migrations` failed on second launch. Replaced raw SQL with `migrate()` + `StaticMigrationSource`.
- **FTS5 not in op-sqlite** — Filtered out migration 0004 on mobile.
- **`@noble/hashes` crypto hang** — PBKDF2/hkdf/sha256 hang on Hermes when called from `async` function with only sync code. Replaced with FNV-style iterative hash for passphrase derivation.
- **Error swallowing** — `void` on promise chains discarded errors. Added `.catch()` handlers.

### Vault Screen UI
- Fixed status bar overlap using `StatusBar.currentHeight` + `Platform.OS`
- Replaced deprecated `SafeAreaView` with `View` + padding
- Removed `react-native-safe-area-context` (CMake path-too-long build failure)

---

## Network & Connection Fixes (Complete)

### Android Cleartext HTTP
- **Root cause** — Android blocks HTTP cleartext even with `usesCleartextTraffic=true`
- **Fix** — Added `res/xml/network_security_config.xml` with `cleartextTrafficPermitted="true"`
- Added Windows Firewall rule for port 4317

### Pairing Flow
- **PairingHandler** — Changed to look up pending pairings by pairing code (not deviceId), so mobile can confirm with its own deviceId
- **PairingScreen** — Real API calls (`POST /v1/pairing/confirm`), 6-digit code entry, 5-minute countdown timer

### Connection Management
- **Auto `http://` prefix** — Connect button auto-prepends if user omits protocol
- **mDNS doesn't override manual IP** — `userManualConnect` flag prevents mDNS from overwriting user-entered server address
- **Socket reconnection** — Managed via ref, properly disconnects/reconnects on server change
- **Items POST to server** — Send button now `POST`s to `/v1/items` (not local-only DB)
- **Desktop socket fallback** — Uses `["websocket", "polling"]` instead of websocket-only

---

## Mobile UI Screens (All Functional)

| Screen | Status | Description |
|--------|--------|-------------|
| **InboxScreen** | Real | Displays items from server, type filtering (All/Text/Link/File/Image/Voice) |
| **DetailScreen** | Real | Download files via REST, share via SMS, delete via `DELETE /api/items/:id` |
| **DevicesScreen** | Real | Fetches from `GET /v1/devices`, shows error state on failure, pull-to-refresh |
| **PairingScreen** | Real | Enter 6-digit code from desktop, `POST /v1/pairing/confirm`, countdown timer |
| **ConflictsScreen** | Real | Fetches from `GET /v1/items/:id/conflicts`, resolves via API |
| **TabBar** | Real | Bottom navigation with dynamic conflict badge count |
| **Composer** | Real | Send text to server via `POST /v1/items`, server IP input with Go button |

---

## Desktop UI (All Functional)

- **3-panel layout** — Sidebar (nav + status), inbox panel (filters + composer + items), detail panel
- **Devices page** — Device cards, online/offline status, "Pair new device" button → modal with 6-digit code
- **Conflict resolution** — Expandable conflict cards with "Keep this" / "Keep both" buttons
- **Quick Share** — Ctrl+Shift+M popup, text + file sharing
- **Connection status** — Live Connected/Disconnected indicator

---

## Key Technical Decisions

- `deriveVaultKeyFromPassphrase` is **synchronous** (non-`async`) to avoid Hermes microtask scheduling bug
- `deriveDbKey` remains `async` (uses real `hkdf` from `@noble/hashes` which works correctly)
- FTS5 migration (0004) filtered out on mobile (op-sqlite doesn't compile FTS5 support)
- Crypto replaced from Web Crypto API to `@noble/hashes` because Hermes doesn't expose `crypto.subtle`
- `@noble/curves` imported from `@noble/curves/ed25519.js` (`.js` extension required by package exports)
- `classifyConflict` returns CONCURRENT for equal non-empty version vectors

---

## Build & Deploy

### Android APK
```sh
pnpm --filter @mydrop/core build
cd packages/mydrop-mobile/android
gradlew.bat assembleRelease --no-daemon -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease -x lintVitalDebug -x lint
```

### Desktop
```sh
pnpm --filter @mydrop/desktop build   # tsc + vite build
pnpm --filter @mydrop/desktop dev:api # API server on :4317
pnpm --filter @mydrop/desktop dev:ui  # Vite UI on :1420
```

---

## Remaining Items

- Real-device WiFi connection testing (emulator works, physical device needs manual IP entry)
- Desktop detail panel Download/Share/Delete button handlers (UI exists, handlers not wired)
- Biometric unlock for mobile vault
- Full E2E encryption for file transfers
- Web thin client polish
