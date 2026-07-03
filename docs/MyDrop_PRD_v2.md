# MyDrop — Product Requirements Document v2.0
### Self-Hosted, Offline-First, Cross-Device Sync for a Single User

> **Architect's note:** This version keeps every idea from v1 that holds up under scrutiny (offline-first, device equality, no vendor lock-in) and replaces the parts that would break in practice (naive last-write-wins, server-coupled realtime, server-coupled networking). Sections marked **🏗 Architect's Note** are commentary, not spec — read them as the "why," skip them if you just want the contract.

---

## 1. Executive Summary

MyDrop is a self-hosted, offline-first synchronization platform for a single user's devices — phone, laptop, desktop, tablet — covering text, links, files, images, clipboard, voice notes, and screenshots.

It is not a chat app repurposed as a clipboard manager (the WhatsApp Saved Messages workflow). It is purpose-built: every device is a peer, data lives locally first, and synchronization is something that happens *to* your data, not something your data depends on.

**Positioning:** AirDrop's immediacy + Syncthing's ownership model + a personal knowledge base + a clipboard manager that actually works across OSes — with no subscription and no third party holding your data unencrypted.

**The long-term moat, stated explicitly:** clipboard sync and file transfer are the V1/V2 *hooks* — the features that get the tool opened daily. The durable value is what they feed: a **Personal Knowledge Inbox** where every text snippet, PDF, screenshot, voice note, and link becomes one searchable corpus. "Find the RTSP URL I shared last month" returning a result regardless of whether it was a clipboard paste, a screenshot, or a PDF attachment is the feature no competitor (WhatsApp, Telegram Saved Messages, Pushbullet, Syncthing) can match, because none of them treat your data as one structured, searchable graph. This only works if capture is frictionless (§12, FR-7) — an inbox nobody feeds stays empty, regardless of how good the search is.

---

## 2. Problem Statement

Current real-world workflow and its failure modes:

```
Phone → WhatsApp → Desktop
```

| Pain point | Root cause |
|---|---|
| WhatsApp Web logs out / re-pairs | Not designed as a sync layer |
| Saved Messages mixed with real chats | No separation of concerns |
| No clipboard sync | Out of scope for a messaging app |
| Poor file organization | No structured item model, no tags |
| No true offline-first | Messages queue, but app feels broken offline |
| Limited search | Chat search ≠ structured/full-text item search |
| Dependency on Meta's servers | Your "personal inbox" lives on infra you don't control |

People are using messaging platforms as clipboard managers, note systems, and file transfer tools — tools that were never designed for that job. MyDrop is the dedicated tool.

---

## 3. Vision & Guiding Principles

```
        ┌─────────┐
        │  Any     │
        │ Device   │
        └────┬────┘
             │
        ┌────▼────┐
        │ MyDrop  │
        └────┬────┘
             │
        ┌────▼────┐
        │   All    │
        │ Devices  │
        └─────────┘
```

1. **Local-first, always.** Every read and write succeeds against the local SQLite store, online or not. Sync is an enhancement to availability, never a precondition for it.
2. **Device equality.** No device is "the server." Every node can create, store, and propagate data. (See §4 for the one honest caveat to this.)
3. **Eventual consistency, never silent data loss.** Conflicts are detected and surfaced, not resolved by quietly picking a winner and deleting the loser.
4. **Zero recurring cost, zero mandatory third party.** Tailscale is the *recommended* transport, not a hard dependency — see §6.3 for the dependency-free fallback path.
5. **Boring cryptography.** No custom crypto. X25519 for key agreement, Ed25519 for signing, AES-256-GCM for data — all via audited libraries (libsodium / WebCrypto).

---

## 4. 🏗 Architect's Note: "No Central Server" — the Honest Version

The v1 doc claims no central server at all. That's true for the **data plane** (items, files, sync events flow peer-to-peer) but not quite true for the **control plane** (how two devices that have never met find each other and exchange keys).

Three honest options, in order of recommendation:

| Mode | Rendezvous mechanism | Trust implication |
|---|---|---|
| **Recommended (V1 default)** | Tailscale coordination server (free tier) | Out of MyDrop's trust boundary — it only ever sees encrypted WireGuard traffic, never plaintext data. You're trusting Tailscale with *metadata* (which devices exist), not your items. |
| **Self-hosted purist mode** | Headscale (open-source, self-hosted Tailscale control server) | Zero third party. You run the coordination server on a $5 VPS or a Raspberry Pi. |
| **Dependency-free fallback** | WebRTC + public STUN, with a tiny self-hosted signaling relay only for the initial offer/answer exchange | No persistent third-party account needed at all. Slowest to set up, most resilient. |

**Decision for V1:** ship with Tailscale as the default (best UX, free, encrypted, battle-tested NAT traversal), document Headscale as the "I want zero third parties" path, and keep the WebRTC fallback on the V4 roadmap rather than blocking V1 on it.

---

## 5. Core Concepts (refined)

| Concept | Definition | Notes |
|---|---|---|
| **Device** | A physical endpoint (phone, laptop, etc.) | Has one identity keypair, one local DB |
| **Node** | The running MyDrop process on a device | Acts as *both* client and server (§7.1) |
| **Item** | Any synchronized object — text, link, file, voice note, clipboard entry | Has a stable UUID, a version vector, optional file payload |
| **Event** | A mutation: create / update / delete / rename | The unit of synchronization — items are *derived* from their event history |
| **Tombstone** | A retained marker for a deleted item | Prevents resurrection from late-arriving offline events |
| **Vault Key** | Symmetric key encrypting all item content at rest | Generated on the first device, transferred only via authenticated ECDH during pairing |

---

## 6. System Architecture

### 6.1 Topology

```
                  ┌─────────────┐
                  │   Phone     │
                  └──────┬──────┘
                         │  WireGuard (Tailscale) or LAN/mDNS
          ┌──────────────┼──────────────┐
          │               │              │
   ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
   │   Laptop    │ │  Desktop    │ │  Tablet    │
   └─────────────┘ └─────────────┘ └────────────┘

   Each node = local SQLite + local file store + sync engine
   Each node exposes an HTTP+WS endpoint (server role)
   Each node also opens outbound connections (client role)
```

### 6.2 Node Anatomy

```
┌─────────────────────────────────────────┐
│                   Node                    │
│  ┌────────────┐  ┌────────────────────┐ │
│  │   UI Layer  │  │   Sync Engine       │ │
│  └─────┬──────┘  └─────────┬──────────┘ │
│        │                    │            │
│  ┌─────▼────────────────────▼──────────┐ │
│  │         Local API (REST + WS)        │ │
│  └─────┬────────────────────┬──────────┘ │
│        │                    │            │
│  ┌─────▼──────┐     ┌───────▼─────────┐ │
│  │  SQLite DB  │     │  File Store     │ │
│  │  (+FTS5)    │     │  (content-      │ │
│  │             │     │   addressable)  │ │
│  └─────────────┘     └─────────────────┘ │
└─────────────────────────────────────────┘
```

**🏗 Architect's Note:** the v1 doc puts Socket.IO in the "Realtime" slot, which implicitly assumes a client→server topology. Correct this: Socket.IO (or plain `ws`) is fine for *UI-to-local-node* realtime updates, but **node-to-node sync must be server-to-server** — each node runs its own lightweight HTTP+WS listener (Fastify recommended for the sync server specifically; Express is fine for the UI-facing API since it matches your existing stack and isn't the hot path).

### 6.3 Network Layers

| Layer | Mechanism | When used |
|---|---|---|
| LAN | mDNS/Bonjour (`_mydrop._tcp.local`) + direct TCP | Same WiFi/subnet — fastest path, used even in V1 |
| WAN (default) | Tailscale (WireGuard mesh) | Cross-network sync, zero port-forwarding |
| WAN (purist) | Headscale self-hosted control plane | Same protocol, zero third party |
| WAN (fallback) | WebRTC data channel + STUN, TURN as last resort | V4 — for users who want zero persistent account anywhere |

Direct LAN transfer is pulled forward from "V4" in the original doc into the **core V1 architecture** — it's nearly free to implement once mDNS discovery exists, and it's the path most sync events will actually take for a phone+laptop on the same WiFi.

### 6.4 Platform Reality: Which Clients Can Be Full Nodes

This needed to be stated explicitly, because the original V1 plan ("Web UI first, Tauri shell added in V2 for the tray app") quietly implied the browser client was a sync peer. It isn't, and it can't be — a browser tab has no raw TCP listener, no persistent background process, and no real filesystem access for chunked file storage.

| Client | Can it be a full P2P node? | Role |
|---|---|---|
| **Desktop (Tauri)** | ✅ Yes — ships as a full node **from V1**, not deferred to a "tray app" phase | Always-on sync peer, holds local SQLite + file store, runs the WS sync server |
| **Mobile (React Native)** | ✅ Yes, with caveats (§18 — background execution limits) | Full node when foregrounded/recently active; push-to-wake bridges the gaps |
| **Web (PWA)** | ❌ No — thin client only | Connects over HTTPS to one of your *real* nodes (desktop/mobile) for read access and quick capture when away from your own devices; never holds the Vault Key or runs sync itself |

**Practical consequence for V1 scope:** the desktop deliverable for V1 is the **Tauri-based desktop node service** (sync engine + local API + OS-level clipboard/share hooks built in from day one), not a website. The web client becomes a secondary, lower-priority convenience layer — useful, but never load-bearing for sync.

---

## 7. Synchronization Protocol

### 7.1 Why not naive timestamp+version

The original schema:
```json
{ "id": "uuid", "deviceId": "PHONE_01", "timestamp": 1720000, "version": 1 }
```
breaks under two real scenarios:
- **Clock skew** — a phone with a wrong system clock can make an old edit look newest.
- **True concurrency** — phone and laptop both edit the same note while both offline. Naive LWW picks one and *deletes the other's work with no record it ever happened.*

### 7.2 Hybrid Logical Clock (HLC)

Each event carries an HLC timestamp: `(physical_time, logical_counter, device_id)`. HLCs combine wall-clock time with a logical counter, so ordering stays correct even across clock skew, and ties are broken deterministically.

```
function hlc_now(local_clock, last_hlc):
    pt = max(local_clock.now(), last_hlc.physical)
    if pt == last_hlc.physical:
        counter = last_hlc.counter + 1
    else:
        counter = 0
    return (pt, counter, device_id)

function hlc_compare(a, b):
    if a.physical != b.physical: return a.physical < b.physical
    if a.counter  != b.counter:  return a.counter  < b.counter
    return a.device_id < b.device_id   # deterministic tiebreak
```

### 7.3 Conflict Detection — Version Vectors

Every item carries a **version vector**: `{ deviceId: counter }` for every device that has ever modified it.

```
item.version_vector = { "PHONE_01": 3, "LAPTOP_02": 1 }
```

On receiving a remote version of an item:

```
function classify(local_vv, remote_vv):
    if local_vv dominates remote_vv:   return "LOCAL_NEWER"   # ignore remote
    if remote_vv dominates local_vv:   return "REMOTE_NEWER"  # fast-forward
    if local_vv == remote_vv:          return "IDENTICAL"
    else:                              return "CONCURRENT"    # true conflict
```

- **REMOTE_NEWER** → fast-forward, no user-visible event.
- **CONCURRENT** → resolve by HLC ordering for *which copy becomes the visible item*, but **archive the losing version as a `conflicted_copy`** (same pattern Dropbox/Syncthing use) — never silently delete user data. Surface a small badge in the UI: "2 versions — tap to compare."

**🏗 Architect's Note:** this is the single biggest correctness upgrade over v1. It costs a few extra columns and one extra table; the alternative is a product that occasionally eats your notes, which for a personal-data tool is close to disqualifying.

### 7.4 Deletes — Tombstones

```
DELETE Item → write tombstone(item_id, hlc_timestamp, device_id)
```
Tombstones sync like any other event and are retained for **30 days** (configurable), so a device that was offline for three weeks doesn't resurrect something you deliberately deleted. After the retention window, tombstones are garbage-collected.

### 7.5 Catch-Up Sync (offline reconnect)

```
Desktop (offline) reconnects
  → Desktop: "give me all events for cursor > my_last_seen_hlc"
  → Peer: streams events in HLC order, chunked (default 500/batch)
  → Desktop: applies events, advances cursor, persists cursor per-peer
```

Per-peer sync cursors (not a single global cursor) allow partial connectivity — e.g., phone and desktop syncing over LAN while tablet is still catching up over Tailscale independently.

---

## 8. Database Schema (DDL)

```sql
-- Identity & trust
CREATE TABLE devices (
    id              TEXT PRIMARY KEY,         -- e.g. "PHONE_01"
    name            TEXT NOT NULL,
    public_key      TEXT NOT NULL,             -- Ed25519, base64
    app_version     TEXT,                      -- e.g. "1.4.2" — needed for safe protocol upgrades
    protocol_version INTEGER DEFAULT 1,        -- sync wire-protocol version, separate from app_version
    trusted_at      INTEGER,
    last_seen       INTEGER,
    storage_used_bytes INTEGER DEFAULT 0,
    status          TEXT CHECK(status IN ('pending','trusted','revoked')) DEFAULT 'pending'
);

-- Logical items (current visible state)
CREATE TABLE items (
    id              TEXT PRIMARY KEY,          -- UUID
    type            TEXT CHECK(type IN ('text','link','file','image','voice','clipboard')) NOT NULL,
    content         TEXT,                      -- inline content (text/link); NULL for files
    file_id         TEXT REFERENCES files(id),
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    created_by      TEXT REFERENCES devices(id),
    version_vector  TEXT NOT NULL,              -- JSON: {"PHONE_01":3,"LAPTOP_02":1}
    deleted         INTEGER DEFAULT 0
);

-- Conflicted copies (never silently discarded)
CREATE TABLE conflicted_copies (
    id              TEXT PRIMARY KEY,
    item_id         TEXT REFERENCES items(id),
    content         TEXT,
    file_id         TEXT REFERENCES files(id),
    losing_device   TEXT REFERENCES devices(id),
    hlc_timestamp   TEXT NOT NULL,
    created_at      INTEGER NOT NULL
);

-- Content-addressable file storage
CREATE TABLE files (
    id              TEXT PRIMARY KEY,           -- = content hash (sha256)
    size            INTEGER NOT NULL,
    mime_type       TEXT,
    chunk_count     INTEGER NOT NULL,
    fully_synced    INTEGER DEFAULT 0
);

CREATE TABLE file_chunks (
    file_id         TEXT REFERENCES files(id),
    chunk_index     INTEGER NOT NULL,
    chunk_hash      TEXT NOT NULL,               -- sha256 of this chunk
    size            INTEGER NOT NULL,
    local_path      TEXT,                        -- NULL until downloaded
    PRIMARY KEY (file_id, chunk_index)
);

-- Append-only event log (source of truth for sync)
CREATE TABLE sync_events (
    id              TEXT PRIMARY KEY,
    item_id         TEXT NOT NULL,
    event_type      TEXT CHECK(event_type IN ('create','update','delete','rename')) NOT NULL,
    payload         TEXT,                        -- JSON delta or full snapshot
    hlc_physical    INTEGER NOT NULL,
    hlc_counter     INTEGER NOT NULL,
    device_id       TEXT REFERENCES devices(id),
    created_at      INTEGER NOT NULL
);
CREATE INDEX idx_events_hlc ON sync_events(hlc_physical, hlc_counter);

-- Per-peer sync cursors (enables independent catch-up per device pair)
CREATE TABLE sync_cursors (
    peer_device_id  TEXT REFERENCES devices(id),
    last_hlc_physical INTEGER,
    last_hlc_counter  INTEGER,
    PRIMARY KEY (peer_device_id)
);

-- Tombstones (retained 30 days, then GC'd)
CREATE TABLE tombstones (
    item_id         TEXT PRIMARY KEY,
    hlc_physical    INTEGER NOT NULL,
    hlc_counter     INTEGER NOT NULL,
    device_id       TEXT REFERENCES devices(id),
    expires_at      INTEGER NOT NULL
);

-- Tags (V3 smart tagging + manual tags)
CREATE TABLE tags (
    item_id         TEXT REFERENCES items(id),
    tag             TEXT NOT NULL,
    source          TEXT CHECK(source IN ('manual','auto')) DEFAULT 'manual',
    PRIMARY KEY (item_id, tag)
);

-- Full-text search
CREATE VIRTUAL TABLE items_fts USING fts5(content, content='items', content_rowid='rowid');
```

---

## 9. File Transfer Protocol

1. **Chunking:** files split into 4MB chunks at creation time; each chunk hashed (SHA-256).
2. **Content addressing:** `files.id = sha256(full_file)`. Identical files (even with different names) dedupe automatically across the whole mesh.
3. **Resumable transfer:** receiver requests only missing `chunk_index` values from `file_chunks` — interrupted transfers resume, they don't restart.
4. **Delta sync for updates (V2+):** when an existing file is modified (e.g., a large document), a rolling-hash diff (rsync algorithm) identifies which 4MB chunks actually changed, so a 500MB file with a 10KB edit re-transfers ~4MB, not 500MB.
5. **Direct LAN path:** when sender and receiver are on the same subnet (mDNS-discovered), chunks transfer over a direct TCP socket, bypassing Tailscale/WAN entirely for speed.

---

## 10. Security Architecture

### 10.1 Pairing Flow

```
New Device                         Trusted Device
─────────                          ──────────────
1. Generate Ed25519 identity
   keypair (local, never leaves
   device unencrypted)
2. Render QR:
   { pubkey, pairing_token,
     bootstrap_addr }
                                    3. Scan QR
                                    4. Verify pairing_token
                                       (out-of-band, e.g. user
                                       confirms a 6-digit code
                                       shown on both screens)
                                    5. X25519 ECDH key exchange
                                       → derive session key
                                    6. Encrypt + transfer Vault Key
                                       over session-encrypted channel
                                    7. Sign new device's pubkey,
                                       broadcast "device trusted"
                                       event to all existing devices
8. Receive Vault Key + full
   device roster
9. Bootstrap: request full
   sync_events history
```

**🏗 Architect's Note:** the 6-digit confirmation step (step 4) matters — without an out-of-band check, QR-based pairing is vulnerable to a malicious QR substitution. It's one extra tap; worth it for a tool that holds your entire personal data graph.

### 10.2 Encryption

| Layer | Mechanism |
|---|---|
| Transport | WireGuard (via Tailscale) for WAN; TLS for any direct LAN HTTP fallback |
| At rest — DB | SQLCipher, key derived from Vault Key via HKDF |
| At rest — files | AES-256-GCM per chunk, key derived from Vault Key |
| Identity | Ed25519 signing keypair per device |
| Key agreement | X25519 ECDH during pairing only |

This gives genuine end-to-end encryption: even if a relay (Tailscale DERP, or a fallback TURN server) ever sees encrypted bytes, it never sees the Vault Key or plaintext.

### 10.3 Trust Lifecycle

- **Pending → Trusted:** via pairing flow above.
- **Revoked:** any trusted device can revoke another (e.g., lost phone). Revocation event broadcasts immediately; revoked device's future events are rejected by all peers (signature still valid, but device status check fails). **Vault Key is rotated** on revocation, re-distributed only to remaining trusted devices, so a stolen-but-offline device can't decrypt newly synced data even if it's later powered on.

---

## 11. API Specification

### 11.1 REST (local node, UI-facing)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/items?type=&tag=&q=` | List/search items (hits FTS5 if `q` present) |
| `POST` | `/api/items` | Create item |
| `PATCH` | `/api/items/:id` | Update item (generates new HLC event) |
| `DELETE` | `/api/items/:id` | Delete (writes tombstone) |
| `GET` | `/api/items/:id/conflicts` | List conflicted copies for an item |
| `POST` | `/api/items/:id/resolve` | Resolve conflict (pick version, or keep both) |
| `GET` | `/api/devices` | List devices + trust status |
| `POST` | `/api/devices/pair` | Initiate pairing (generates QR payload) |
| `POST` | `/api/devices/:id/revoke` | Revoke a device |
| `GET` | `/api/files/:id/chunks/:index` | Fetch a single chunk (range-resumable) |

### 11.2 WebSocket (node-to-node sync — server role on every node)

| Event | Direction | Payload |
|---|---|---|
| `sync.hello` | both | `{ deviceId, cursor }` — handshake on connect |
| `sync.events` | both | `{ events: SyncEvent[] }` — batched push |
| `sync.request_since` | both | `{ since: HLC }` — catch-up request |
| `file.chunk_available` | both | `{ fileId, chunkIndex }` — announce new chunk |
| `device.trusted` | both | `{ deviceId, pubkey, signedBy }` |
| `device.revoked` | both | `{ deviceId, signedBy }` |

### 11.3 WebSocket (UI-facing, local only)

| Event | Direction | Payload |
|---|---|---|
| `item.created` / `item.updated` / `item.deleted` | server→UI | live item list updates |
| `sync.status` | server→UI | `{ peer, lastSync, pendingEvents }` — for the device health dashboard |
| `clipboard.update` | server→UI | V2 clipboard listener push |

---

## 12. Functional Requirements

### FR-1 Text Sharing
- Create, edit, delete, search text snippets (OTPs, code, prompts, notes).
- **Acceptance:** a snippet created offline on Device A appears on Device B within 1s of both being online on the same LAN, or within 5s over WAN.

### FR-2 Link Sharing
- Paste URL → auto-fetch title + favicon (best-effort, fails gracefully offline) → open in default browser → searchable.
- **Acceptance:** title extraction has a 3s timeout; on failure, item is still created with the raw URL as title.

### FR-3 File Sharing
- Drag-and-drop, preview (PDF/image inline; others show metadata), download, chunked resumable transfer.
- **Acceptance:** a transfer interrupted at 60% resumes from ~60%, not 0%, on reconnect.

### FR-4 Image Sharing
- Gallery view, preview, EXIF metadata display (with a one-tap "strip metadata before further sharing" option — privacy-relevant for screenshots/photos).
- **Acceptance:** thumbnail generation happens locally, never requires a network round-trip.

### FR-5 Device Management
- Rename, trust (pair), revoke devices; device health view (last seen, pending event count, storage contribution).
- **Acceptance:** revoking a device takes effect on all *other* online devices within one sync cycle, regardless of whether the revoked device is online.

### FR-6 Conflict Resolution (new — was implicit/missing in v1)
- Concurrent edits surface as a visible "2 versions" indicator; user picks one or keeps both as separate items.
- **Acceptance:** no item is ever silently overwritten without a recoverable conflicted copy.

### FR-7 Universal Share Endpoint (new — highest-leverage addition)
- Every node exposes a local `/share` handler reachable via OS-native share surfaces, so capture never requires opening the app first.
- **Android:** RN app registers an `ACTION_SEND` intent filter — handles shares directly, including from a cold start.
- **iOS:** a dedicated **Share Extension** target writes to a shared App Group container; the main app picks it up and creates the item on next activation (works around iOS not allowing the main app to handle share-sheet intents directly).
- **Desktop:** OS share integration where available (macOS Share Menu service), plus a global hotkey "quick share" popup as the cross-platform baseline.
- **Web (bonus, low cost):** an installed Android PWA can register as a Web Share Target via `manifest.json`'s `share_target` key, giving the thin client share-sheet integration nearly for free.
- **Acceptance:** sharing an image from any app's native share sheet creates a MyDrop item within 2s, without the MyDrop UI ever needing to be foregrounded first.

### FR-8 Device Health Dashboard (new — elevated from a passing mention)
- A dedicated view listing every paired device with live status:

```
Desktop      ● Online                          v1.4.2
Laptop       ● Online                          v1.4.1
Phone        ○ Offline (last seen 3h ago)      v1.4.2
```

- Per device: **pending event count** (events generated locally but not yet acknowledged by this device), **storage contribution** (bytes held), **last sync timestamp**, **app/protocol version** (flags mismatches that could cause sync issues).
- **Acceptance:** a stuck sync (e.g., a device offline for days, or a version mismatch blocking event application) is diagnosable from this screen alone, without reading logs.

---

## 13. V2 — Clipboard, Browser Extension, Tray Polish

Since the desktop node already ships as a full Tauri app in V1 (§6.4, §17), V2 is no longer "introduce the native shell" — it's "add OS hooks to the shell that already exists."

- **Clipboard sync:** OS-level clipboard listener (Tauri sidecar) → on copy, debounce 400ms → push as a `clipboard` item type → other devices' tray apps offer one-tap paste-from-MyDrop.
- **Browser extension:** save current page / selected text / image directly, using the same local REST API (extension talks to `localhost` node).
- **Desktop tray app:** quick-share, clipboard listener, native notifications — now UX polish on an existing service rather than new infrastructure.

## 14. V3 — OCR, AI Search, Smart Tagging

- **OCR:** native Tesseract binary via Tauri sidecar on desktop (fast); Tesseract.js as a web/mobile fallback only (it's slow in a JS runtime — don't make it the primary path).
- **AI Search:** local embeddings (Transformers.js / Ollama) run **only on the most capable available node** (typically desktop) — mobile clients query that node rather than running embedding inference locally. Avoid draining phone battery/CPU for this.
- **Smart tagging:** auto-tag on ingest using the same local model, confidence-gated (low-confidence tags shown as suggestions, not auto-applied).

**🏗 Architect's Note:** v1 lists this as V3 alongside OCR — agree with that sequencing. Don't pull AI search forward; it's the feature most tempting to over-build, and it's worthless if sync underneath it is still flaky.

## 15. V4 — Voice Notes, E2E Encryption, Direct LAN

- Voice notes: record → sync as file item → background transcription (same node-selection strategy as AI search) → searchable transcript.
- E2E encryption: see §10 — pulled forward conceptually into core architecture even though full key-rotation UX ships in V4.
- LAN direct transfer: already part of core architecture (§6.3), V4 just adds UI polish (transfer speed indicator, "devices on this network" view).

---

## 16. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Local read availability | 100% (local-first; never blocks on network) |
| Sync propagation success | ≥99.9% of events eventually delivered once both devices are online |
| Sync latency (LAN) | P50 < 1s, P99 < 3s |
| Sync latency (WAN, Tailscale) | P50 < 5s, P99 < 15s |
| Search latency | P95 < 200ms for FTS5 query over ≤100K items |
| Max file size (V1) | 2GB, chunked |
| Storage | Bounded by device disk; warn at 80% disk usage, configurable per-device retention policy |
| Tombstone retention | 30 days (configurable) |
| Conflict data loss | Zero — every losing version recoverable as `conflicted_copy` |

---

## 17. Recommended Tech Stack

| Layer | Choice | Architect's note |
|---|---|---|
| Web UI | React + TypeScript + Bootstrap | Thin client only (§6.4) — not a sync node, useful for quick access from an untrusted/borrowed browser |
| Mobile | React Native + Expo | Agree — flag background-sync limits in §18; ships as a full node from V1, including FR-7 share-sheet handling |
| Desktop shell | **Tauri, shipped as the V1 desktop node service** (not deferred to a "V2 tray" phase) | Corrected from v1's "Web first, Tauri later" — clipboard sync, file chunking, and the WS sync server all need OS-level access a browser doesn't have, so the real node has to exist from day one |
| UI-facing API | Node.js + Express + TypeScript | Fine — not the hot path |
| Node-to-node sync server | **Fastify** + `ws`, not Socket.IO | Socket.IO assumes client→server; sync needs peer servers |
| Database | SQLite (SQLCipher for encryption) per device | Agree, add SQLCipher |
| Full-text search | SQLite FTS5 | Agree |
| File storage | Local filesystem, content-addressed (`/data/files/<sha256>`) | Refined from v1's flat `/data/files` |
| OCR | Native Tesseract (Tauri sidecar) primary, Tesseract.js fallback | Refined — JS OCR is too slow as primary path |
| AI search / embeddings | Transformers.js or Ollama, **desktop-node-only** | Refined — don't run on mobile |
| WAN networking | Tailscale (default), Headscale (self-hosted), WebRTC+STUN/TURN (fallback) | Refined — explicit fallback tiers |
| LAN discovery | mDNS/Bonjour | Pulled forward into V1 core |

### 17.1 Repository / Package Structure

```
mydrop/
├── mydrop-core/         Sync Engine, SQLite layer, Encryption, Event System
│                         (shared logic — pure TS, no platform-specific code,
│                          consumed by desktop and mobile)
│
├── mydrop-desktop/       Tauri shell — V1 full node
│                         (sync server, file store, clipboard listener,
│                          OS share integration, system tray)
│
├── mydrop-mobile/        React Native — V1 full node
│                         (sync server, FR-7 share-sheet handlers,
│                          push-to-wake background sync — §18)
│
├── mydrop-web/           PWA — thin client only (§6.4)
│                         (talks to a real node over HTTPS; never holds
│                          the Vault Key; optional Web Share Target)
│
└── mydrop-serverless/    Deliberately narrow scope — two jobs only:
                          (a) push-wake relay: tells a sleeping phone
                              "you have pending events" via APNs/FCM,
                              never sees plaintext, only device tokens
                              and event counts
                          (b) optional self-hosted Headscale rendezvous
                              for purist/zero-third-party mode
                          Both are skippable entirely for Tailscale-only
                          setups — this package must never grow into
                          "the central server" the architecture exists
                          to avoid.
```

**🏗 Architect's Note:** `mydrop-serverless` is the one package worth watching over time — it's the natural place for scope creep to reintroduce a central server by accident. The test for anything proposed for this package: *does it ever see plaintext item content, or does it only ever see "wake up" signals and device metadata?* If the former, it doesn't belong here.

---

## 18. Mobile-Specific Considerations (new section)

iOS and Android both aggressively suspend background processes — this is the single biggest practical risk to "always synced" on mobile and wasn't addressed in v1.

- **iOS:** background execution is capped (~30s after backgrounding without a registered background task). Use silent push notifications (APNs) to wake the app briefly for sync when a peer has new events, rather than relying on a persistent background connection.
- **Android:** more background-tolerant, but battery optimization (Doze mode) on stock Android still throttles. Use a foreground service with a persistent low-priority notification ("MyDrop sync active") when the user opts into "always-on sync," falling back to FCM push otherwise.
- **Practical implication:** mobile devices should be treated as *eventually* consistent on a longer tail than desktop/laptop — design the UI's "pending sync" indicator around this reality rather than promising instant sync on mobile.

---

## 19. Open Risks & Engineering Challenges (honest list)

| Risk | Mitigation / status |
|---|---|
| Symmetric NAT defeating even Tailscale's relay-less mode | Tailscale falls back to DERP relay automatically — accept the latency hit rather than building custom TURN logic in V1 |
| Conflict UI complexity (users don't want to think about version vectors) | Keep the *concept* hidden — surface only "2 versions, pick one or keep both" |
| Mobile background limits (§18) | Push-to-wake architecture, honest "last synced" UI rather than false promises |
| Delta sync (rsync-style) implementation complexity | Defer to V2 — V1 ships whole-file re-transfer on update, which is correct-but-slow, not broken |
| SQLCipher + React Native integration maturity | Spike this early — encrypted SQLite on RN has historically been the rockiest integration point in this stack |
| Vault Key rotation on revoke, with offline devices | Rotation must re-encrypt incrementally as devices come online, not require all devices online simultaneously |

---

## 20. Competitive Comparison

| Feature | WhatsApp | Telegram Saved Messages | Syncthing | MyDrop |
|---|---|---|---|---|
| Text sync | ✅ | ✅ | ❌ | ✅ |
| File sync | ✅ | ✅ | ✅ | ✅ |
| Clipboard sync | ❌ | ❌ | ❌ | ✅ |
| Offline-first | Partial | Partial | ✅ | ✅ |
| Self-hosted | ❌ | ❌ | ✅ | ✅ |
| Conflict-safe (no silent data loss) | N/A | N/A | ✅ | ✅ |
| AI search | ❌ | ❌ | ❌ | ✅ (V3) |
| E2E encrypted at rest | ❌ | Partial | ❌ | ✅ |
| Personal inbox UX | ❌ | ❌ | ❌ | ✅ |

---

## 21. Phased Roadmap & Exit Criteria

| Phase | Scope | Exit criteria |
|---|---|---|
| **V1** | Tauri desktop node + RN mobile node (both full peers from day one), text/link/file/image sync, mDNS LAN + Tailscale WAN, pairing flow, conflict detection, tombstones, **FR-7 Universal Share Endpoint**, **FR-8 Device Health Dashboard** | Two real devices, zero data loss across 1 week of daily offline/online cycling, *and* every item captured via native share sheet rather than opening the app |
| **V2** | Clipboard sync (OS listener, now trivial since the desktop node is already Tauri), browser extension, full tray-app UX polish | Clipboard round-trip phone↔desktop in <2s on LAN |
| **V3** | OCR, AI search, smart tagging | Search returns correct result for a query matching only image-OCR'd text |
| **V4** | Voice notes + transcription, full E2E key rotation UX, WebRTC fallback transport | Pairing and full sync work with zero Tailscale account, end to end |

---

## 22. Success Metrics

- Daily active use across ≥2 devices within first week of personal use (dogfooding signal).
- Zero unrecoverable data-loss incidents (conflicted copies always available) across testing period.
- Clipboard sync used ≥10x/day once V2 ships — this is the feature that, per the original doc's instinct, will get the most real-world usage.
- Search P95 latency stays under 200ms as personal corpus grows past 10K items.

---

*End of PRD v2.0. Original concept and V1 draft by Aniket; this revision adds the sync-protocol, security, and mobile-reliability layers needed to take it from "good idea" to "buildable spec."*
