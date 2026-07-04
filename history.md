# MyDrop Development History

## Project Overview
Monorepo at `C:\Users\User\Downloads\Mydrop` using pnpm + turborepo.
Packages: `mydrop-core`, `mydrop-desktop`, `mydrop-mobile`, `mydrop-web`.

---

## Phase A — Core Infrastructure (Complete)

### A1: Crypto Module (`packages/mydrop-core/src/crypto/`)
- **identity.ts**: Ed25519 keypair generation, sign, verify, base64 serialization using `@noble/curves/ed25519`
- **pairing.ts**: X25519 ECDH shared secret, HKDF session key derivation, AES-256-GCM vault key encrypt/decrypt, 6-digit pairing token, QR payload envelope
- Removed old `sync/crypto.ts` and `sync/pairing.ts`; updated `index.ts` exports

### A2: Event Log + Tombstones (`packages/mydrop-core/src/events/`)
- **event-log.ts**: `EventLog` class — append events, `getEventsSince` with HLC cursor, cursor persistence
- **tombstone-gc.ts**: `TombstoneGc` class — 30-day retention sweep, create/check/list operations
- Refactored `SyncEngine` to delegate to both modules (net -135 lines)

### A3: File Chunking (`packages/mydrop-core/src/files/`)
- **chunker.ts**: Stateless 4MB chunking, reconstruct, missing-indices
- **content-store.ts**: `ContentStore` (renamed from `FileStore`) — DB-backed chunked file storage by SHA-256 hash
- **hash.ts**: SHA-256 with WebCrypto + fallback
- **delta.ts**: V2 stub (throws — deferred)
- Removed old `sync/file-store.ts` and `sync/hash.ts`

### A4: SQL Migrations (`packages/mydrop-core/src/db/migrations/`)
- **0001_init.sql**: applied_migrations, devices, items, files, file_chunks with indexes
- **0002_sync_events_and_cursors.sql**: sync_events, sync_cursors
- **0003_tombstones_and_conflicts.sql**: tombstones, conflicted_copies
- **0004_tags_and_fts.sql**: tags, items_fts FTS5 virtual table + triggers
- **0005_device_health_fields.sql**: ALTER devices with app_version, protocol_version, storage_used_bytes
- **migrations.ts**: `FsMigrationSource`, `FileReader` interface, `ALL_MIGRATIONS` constant
- `v1-schema.ts` now derived from concatenation of all 5 migrations

---

## Phase B — REST API + WebSocket Protocol (Complete)

### REST Handlers (`packages/mydrop-core/src/api/rest/`)
- **types.ts**: Shared types, error helpers, response formatters
- **items.ts**: List, create, update, delete, list conflicts, resolve
- **devices.ts**: List, initiate pairing (Ed25519 keypair + QR), confirm pairing, revoke
- **files.ts**: Get file info, get chunk data
- **share.ts**: FR-7 universal share endpoint (looser validation)
- **health.ts**: FR-8 health dashboard (device list + localStorageBytes)
- **router.ts**: Wires all handlers together

### WebSocket Modules (`packages/mydrop-core/src/api/ws/`)
- **ui-server.ts**: Event subscription + polling for live UI updates
- **sync-server.ts**: Node-to-node sync protocol (hello, request_since, events, ack, file chunk, device trust/revoke)

---

## Phase C — FR-7 Native Share Integration (Complete)

### Android (`packages/mydrop-mobile/src/native/ShareIntentHandler.ts`)
- Listens for `ACTION_SEND` / `ACTION_SEND_MULTIPLE` intents via `AppState` + `NativeModules`
- Parses text, image URIs, file URIs from intent JSON
- Creates items through `V1MobileStore`

### iOS (`packages/mydrop-mobile/src/native/ShareExtension/index.ts`)
- Xcode Share Extension stub with setup instructions

### Desktop Quick Share (`packages/mydrop-desktop/src/ui/QuickShare.tsx`)
- `QuickSharePopup` component + `useQuickShare` hook
- Global hotkey: `Ctrl+Shift+M`
- Text input + file picker, calls POST `/items/text` and `/items/file`
- Wired into `main.tsx` sidebar footer button

### Mobile App Integration (`packages/mydrop-mobile/src/App.tsx`)
- Initializes `ShareIntentHandler` on vault unlock
- Subscribes to intents, refreshes item list
- Cleanup on unmount

---

## Tauri Desktop Shell (Complete)

### Rust Toolchain
- Installed Rust 1.96.1 via `rustup default stable`
- Installed VS 2022 Build Tools + "Desktop development with C++" workload (MSVC linker)
- Cargo check passes

### Tauri v2 Configuration (`packages/mydrop-desktop/src-tauri/`)
- **Cargo.toml**: `tauri` v2 with plugins (shell, clipboard-manager, global-shortcut, notification)
- **tauri.conf.json**: dev URL, build commands, plugin config (Ctrl+Shift+M shortcut)
- **lib.rs**: Plugin registration
- **main.rs**: Entry point
- **build.rs**: `tauri_build::build()`
- **icons/icon.ico**: 32x32 generated

---

## Mobile UI Redesign (Complete)
- `v1/theme.ts` — dark color tokens + item type colors
- `v1/InboxScreen.tsx` — filter pills, item list with colored type badges
- `v1/DetailScreen.tsx` — item detail, meta grid, tags, Download/Share/Delete
- `v1/DevicesScreen.tsx` — device cards, status dot, stats, "Pair new device"
- `v1/PairingScreen.tsx` — 3-step QR → code confirm → synced
- `v1/ConflictsScreen.tsx` — warning banner, side-by-side cards, Keep A/B/both + resolved
- `v1/TabBar.tsx` — bottom tab navigation with badges
- `App.tsx` — vault unlock gate, tab navigation, composer, live Socket.IO connection

---

## Desktop UI Overhaul (Complete)
- `main.tsx` — 3-panel layout: sidebar (logo + nav + status), inbox panel (filters + composer + item list), detail panel, devices page with cards
- `styles.css` — full dark theme using CSS custom properties matching `MyDrop_UI.html` palette

---

## Commits (All Pushed to GitHub `origin/master`)

| Commit | Message |
|--------|---------|
| `c68b5d2` | Phase C: FR-7 native share integration (Android + desktop quick-share) |
| `cb460cf` | Phase B: Add REST API handlers + WebSocket protocol modules |
| `04a35c5` | Phase A4: SQL migrations 0001-0005 + migration infrastructure |
| `...` | (previous commits for A1-A3, mobile UI, desktop UI) |

---

## Remaining / Blocked

### OpenSSL Cert Generation
- Requires `openssl` on PATH for transport TLS certs
- Falls back to HTTP gracefully if not found

### Pre-existing Lint Errors (10)
- In `alpha-server.ts`, `adapter.ts`, `sync-peer.ts`, `pairing-handler.ts`
- Not introduced by recent changes

### Phase D — Tests (Pending)
- Unit tests for core modules: HLC, version-vector, crypto, event-log, chunker, content-store
- E2E offline/online cycling test

### Integration Wiring (Pending)
- Wire REST handlers into `alpha-server.ts`
- Wire WS protocol into `sync-server.ts`

---

## Key Decisions
- Crypto logic moved from `sync/` to dedicated `crypto/`, `events/`, `files/`, `api/` per SDS architecture
- `EventLog` and `TombstoneGc` extracted from `SyncEngine` to reduce `engine.ts` by 135 lines
- REST handlers are dependency-injected classes/functions (accept `SyncEngine`, `DatabaseClient`, `ContentStore`) — no HTTP framework coupling
- WS modules defined at core layer; actual socket wiring in desktop/mobile packages
- SQL migrations are canonical source of truth; `V1_SCHEMA_SQL` derived from `ALL_MIGRATIONS`
- `@noble/curves` imported from `@noble/curves/ed25519.js` (`.js` extension required by package exports)

---

## Relevant Files

### Core
- `packages/mydrop-core/src/crypto/identity.ts` — Ed25519 keypair, sign, verify
- `packages/mydrop-core/src/crypto/pairing.ts` — X25519 ECDH, session key, vault key encrypt/decrypt, QR payload, pairing tokens
- `packages/mydrop-core/src/events/event-log.ts` — EventLog class
- `packages/mydrop-core/src/events/tombstone-gc.ts` — TombstoneGc class
- `packages/mydrop-core/src/files/chunker.ts` — 4MB chunking, reconstruct, missing-indices
- `packages/mydrop-core/src/files/content-store.ts` — ContentStore (chunked content-addressable storage)
- `packages/mydrop-core/src/files/hash.ts` — SHA-256 WebCrypto + fallback
- `packages/mydrop-core/src/db/migrations/0001-0005.sql` — Canonical schema migrations
- `packages/mydrop-core/src/db/migrations.ts` — Migrate function, FsMigrationSource, ALL_MIGRATIONS
- `packages/mydrop-core/src/api/rest/*.ts` — REST handlers + router
- `packages/mydrop-core/src/api/ws/*.ts` — UI event server + sync protocol server

### Mobile
- `packages/mydrop-mobile/src/v1/*.tsx` — All screen components + TabBar + theme
- `packages/mydrop-mobile/src/App.tsx` — Vault gate + tab navigation + composer
- `packages/mydrop-mobile/src/native/ShareIntentHandler.ts` — Android share intent handler
- `packages/mydrop-mobile/src/native/ShareExtension/index.ts` — iOS extension stub
- `packages/mydrop-mobile/android/app/src/main/AndroidManifest.xml` — ACTION_SEND/SEND_MULTIPLE intent filters

### Desktop
- `packages/mydrop-desktop/src/ui/main.tsx` — 3-panel layout
- `packages/mydrop-desktop/src/ui/styles.css` — Dark theme CSS
- `packages/mydrop-desktop/src/ui/QuickShare.tsx` — Quick share popup + hook
- `packages/mydrop-desktop/src-tauri/` — Full Tauri v2 Rust shell (cargo check passes)
- `packages/mydrop-desktop/src/server/v1/tls.ts` — OpenSSL auto-detection for Windows

---

## Recent Commits (Phase C+)
- `28ca6fd` — Fix all 21 lint errors + OpenSSL TLS support
- `91f4622` — Phase D: Add unit tests for core modules (46 tests)
- `424d2e5` — Wire REST API into alpha-server + fix Tauri shell
- `c68b5d2` — Phase C: FR-7 native share integration (Android + desktop quick-share)

---

## Remaining
- ~~Install openssl~~ ✅ (OpenSSL 4.0.1, auto-detected via `findOpenssl()`)
- ~~Fix all lint errors~~ ✅ (21 errors → 0)
- ~~Wire REST API~~ ✅ (`dispatchRestRouter` in alpha-server.ts)
- ~~Wire WS sync~~ ✅ (already integrated via SyncPeer)
- ~~Phase D~~ ✅ (46 unit tests passing)

## All Phases Complete ✅