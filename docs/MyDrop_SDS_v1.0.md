# MyDrop — System Design Specification (SDS v1.0)

**Status:** Draft, builds on **PRD v2.0 (locked)**. Where this document and the PRD disagree on a detail, this document wins for implementation purposes — the PRD defines *what and why*, this defines *exactly how*. Any change here that contradicts the PRD's architecture (§4–§10 of the PRD) should be raised as a PRD amendment first, not silently implemented.

**Scope:** Repository structure, DB migrations, sync protocol wire format, REST/WS contracts, pairing sequence, UI wireframes, and the Week 1–4 MVP sprint plan for **V1** as defined in PRD §21.

---

## 1. Repository Structure

Monorepo, **pnpm workspaces + Turborepo** for build orchestration and caching (incremental builds matter once `mydrop-core` is shared across two completely different runtimes).

```
mydrop/
├── package.json                    # workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── docs/
│   ├── PRD.md                      # locked v2.0
│   └── SDS.md                      # this document
│
├── packages/
│   │
│   ├── mydrop-core/                 # Shared logic — pure TS, zero platform code
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── migrations/
│   │   │   │   │   ├── 0001_init.sql
│   │   │   │   │   ├── 0002_sync_events_and_cursors.sql
│   │   │   │   │   ├── 0003_tombstones_and_conflicts.sql
│   │   │   │   │   ├── 0004_tags_and_fts.sql
│   │   │   │   │   └── 0005_device_health_fields.sql
│   │   │   │   ├── migrator.ts        # runs .sql files in order, tracks applied_migrations
│   │   │   │   ├── schema.ts          # Kysely typed table interfaces
│   │   │   │   └── client.ts          # adapter: better-sqlite3 (desktop) | op-sqlite (mobile)
│   │   │   │
│   │   │   ├── sync/
│   │   │   │   ├── hlc.ts             # Hybrid Logical Clock (PRD §7.2)
│   │   │   │   ├── version-vector.ts  # PRD §7.3
│   │   │   │   ├── sync-engine.ts     # orchestrates catch-up, applies events
│   │   │   │   ├── conflict-resolver.ts
│   │   │   │   └── protocol/
│   │   │   │       ├── messages.ts    # TS types — §3 below
│   │   │   │       ├── envelope.ts    # sign/verify wrapper
│   │   │   │       └── codec.ts       # encode/decode + msgpack vs JSON decision
│   │   │   │
│   │   │   ├── crypto/
│   │   │   │   ├── identity.ts        # Ed25519 keypair mgmt
│   │   │   │   ├── pairing.ts         # X25519 ECDH (PRD §10.1)
│   │   │   │   ├── vault.ts           # Vault Key + SQLCipher key derivation (HKDF)
│   │   │   │   └── encryption.ts      # AES-256-GCM per-chunk
│   │   │   │
│   │   │   ├── files/
│   │   │   │   ├── chunker.ts         # 4MB chunking, SHA-256
│   │   │   │   ├── content-store.ts   # content-addressable filesystem layer
│   │   │   │   └── delta.ts           # rsync-style delta — stub in V1, real in V2
│   │   │   │
│   │   │   ├── events/
│   │   │   │   ├── event-log.ts       # append-only sync_events writer/reader
│   │   │   │   ├── tombstone-gc.ts    # 30-day retention sweep
│   │   │   │   └── types.ts
│   │   │   │
│   │   │   ├── api/
│   │   │   │   ├── rest/
│   │   │   │   │   ├── items.ts
│   │   │   │   │   ├── devices.ts
│   │   │   │   │   ├── files.ts
│   │   │   │   │   ├── share.ts       # FR-7 endpoint
│   │   │   │   │   ├── health.ts      # FR-8 endpoint
│   │   │   │   │   └── router.ts
│   │   │   │   └── ws/
│   │   │   │       ├── sync-server.ts # node-to-node (Fastify + ws)
│   │   │   │       ├── ui-server.ts   # local UI-facing events
│   │   │   │       └── handlers/
│   │   │   │
│   │   │   ├── discovery/
│   │   │   │   ├── mdns.ts
│   │   │   │   └── tailscale.ts
│   │   │   │
│   │   │   └── index.ts               # public package exports
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── mydrop-desktop/                # Tauri — full node, ships in V1 (PRD §6.4)
│   │   ├── src-tauri/
│   │   │   ├── src/
│   │   │   │   ├── main.rs
│   │   │   │   ├── clipboard.rs       # V2, stubbed in V1
│   │   │   │   ├── share.rs           # macOS Share Menu service
│   │   │   │   ├── tray.rs
│   │   │   │   └── sidecar/           # Tesseract binary wrapper (V3)
│   │   │   ├── tauri.conf.json
│   │   │   └── Cargo.toml
│   │   ├── src/                       # React webview UI
│   │   │   ├── pages/
│   │   │   │   ├── Inbox.tsx
│   │   │   │   ├── ItemDetail.tsx
│   │   │   │   ├── Pairing.tsx
│   │   │   │   ├── DeviceHealth.tsx
│   │   │   │   └── ConflictResolve.tsx
│   │   │   ├── components/
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   ├── mydrop-mobile/                 # React Native — full node, ships in V1
│   │   ├── src/
│   │   │   ├── screens/               # mirrors desktop pages/
│   │   │   ├── native/
│   │   │   │   ├── ShareExtension/    # iOS — separate app extension target
│   │   │   │   ├── ShareIntentHandler.ts  # Android ACTION_SEND
│   │   │   │   └── BackgroundSync.ts  # push-to-wake (PRD §18)
│   │   │   └── App.tsx
│   │   ├── ios/
│   │   │   └── MyDropShareExtension/  # iOS Share Extension target + App Group
│   │   ├── android/
│   │   └── package.json
│   │
│   ├── mydrop-web/                    # PWA — thin client only (PRD §6.4)
│   │   ├── src/
│   │   ├── public/
│   │   │   └── manifest.json          # includes share_target (Android PWA bonus)
│   │   └── package.json
│   │
│   └── mydrop-serverless/             # Narrow scope only — PRD §17.1
│       ├── push-relay/                # Cloudflare Worker: wake signal only
│       │   └── src/index.ts
│       └── headscale/                 # optional self-hosted rendezvous — docs only, V4
│           └── README.md
```

**🏗 Architect's Note:** `mydrop-core`'s `db/client.ts` is the one file every platform target imports through — it's the seam where "works on desktop" and "works on mobile" either stay unified or quietly diverge. Keep its public interface (`query`, `exec`, `migrate`) identical regardless of which native SQLite binding sits behind it. If a feature can't be expressed through that interface on both platforms, it doesn't belong in `mydrop-core` — it belongs in the platform package.

---

## 2. Database Migrations

Plain `.sql` files, applied in filename order by `migrator.ts`, tracked in an `applied_migrations` bookkeeping table. No ORM-managed migration DSL — keeps the SQL portable across `better-sqlite3` and `op-sqlite`.

### 0001_init.sql
```sql
CREATE TABLE applied_migrations (
    filename    TEXT PRIMARY KEY,
    applied_at  INTEGER NOT NULL
);

CREATE TABLE devices (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    public_key      TEXT NOT NULL,
    trusted_at      INTEGER,
    last_seen       INTEGER,
    status          TEXT CHECK(status IN ('pending','trusted','revoked')) DEFAULT 'pending'
);

CREATE TABLE items (
    id              TEXT PRIMARY KEY,
    type            TEXT CHECK(type IN ('text','link','file','image','voice','clipboard')) NOT NULL,
    content         TEXT,
    file_id         TEXT REFERENCES files(id),
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    created_by      TEXT REFERENCES devices(id),
    version_vector  TEXT NOT NULL,
    deleted         INTEGER DEFAULT 0
);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_updated ON items(updated_at);

CREATE TABLE files (
    id              TEXT PRIMARY KEY,         -- sha256 of full file
    size            INTEGER NOT NULL,
    mime_type       TEXT,
    chunk_count     INTEGER NOT NULL,
    fully_synced    INTEGER DEFAULT 0
);

CREATE TABLE file_chunks (
    file_id         TEXT REFERENCES files(id),
    chunk_index     INTEGER NOT NULL,
    chunk_hash      TEXT NOT NULL,
    size            INTEGER NOT NULL,
    local_path      TEXT,
    PRIMARY KEY (file_id, chunk_index)
);
```

### 0002_sync_events_and_cursors.sql
```sql
CREATE TABLE sync_events (
    id              TEXT PRIMARY KEY,
    item_id         TEXT NOT NULL,
    event_type      TEXT CHECK(event_type IN ('create','update','delete','rename')) NOT NULL,
    payload         TEXT,
    hlc_physical    INTEGER NOT NULL,
    hlc_counter     INTEGER NOT NULL,
    device_id       TEXT REFERENCES devices(id),
    created_at      INTEGER NOT NULL
);
CREATE INDEX idx_events_hlc ON sync_events(hlc_physical, hlc_counter);
CREATE INDEX idx_events_item ON sync_events(item_id);

CREATE TABLE sync_cursors (
    peer_device_id      TEXT PRIMARY KEY REFERENCES devices(id),
    last_hlc_physical   INTEGER,
    last_hlc_counter    INTEGER
);
```

### 0003_tombstones_and_conflicts.sql
```sql
CREATE TABLE tombstones (
    item_id         TEXT PRIMARY KEY,
    hlc_physical    INTEGER NOT NULL,
    hlc_counter     INTEGER NOT NULL,
    device_id       TEXT REFERENCES devices(id),
    expires_at      INTEGER NOT NULL
);
CREATE INDEX idx_tombstones_expiry ON tombstones(expires_at);

CREATE TABLE conflicted_copies (
    id              TEXT PRIMARY KEY,
    item_id         TEXT REFERENCES items(id),
    content         TEXT,
    file_id         TEXT REFERENCES files(id),
    losing_device   TEXT REFERENCES devices(id),
    hlc_timestamp   TEXT NOT NULL,
    created_at      INTEGER NOT NULL
);
CREATE INDEX idx_conflicts_item ON conflicted_copies(item_id);
```

### 0004_tags_and_fts.sql
```sql
CREATE TABLE tags (
    item_id         TEXT REFERENCES items(id),
    tag             TEXT NOT NULL,
    source          TEXT CHECK(source IN ('manual','auto')) DEFAULT 'manual',
    PRIMARY KEY (item_id, tag)
);

-- External-content FTS5 table — requires sync triggers, easy to forget:
CREATE VIRTUAL TABLE items_fts USING fts5(content, content='items', content_rowid='rowid');

CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;
CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO items_fts(rowid, content) VALUES (new.rowid, new.content);
END;
```

### 0005_device_health_fields.sql
```sql
ALTER TABLE devices ADD COLUMN app_version TEXT;
ALTER TABLE devices ADD COLUMN protocol_version INTEGER DEFAULT 1;
ALTER TABLE devices ADD COLUMN storage_used_bytes INTEGER DEFAULT 0;
```

**🏗 Architect's Note:** `0004`'s triggers are the part most likely to get silently skipped if someone hand-rolls FTS setup later — an external-content FTS5 table with no triggers looks fine until search results start going stale. Worth a unit test that specifically asserts `items_fts` reflects an update, not just that the table exists.

---

## 3. Sync Protocol — Message Schemas

Every node-to-node message is wrapped in a signed envelope. Wire format: **JSON for V1** (debuggability during early development beats the bandwidth savings of msgpack at this data volume — revisit if file-chunk-announce traffic becomes a bottleneck).

```typescript
// Envelope — every message on the node-to-node WS channel
interface SyncEnvelope<T = unknown> {
  v: 1;                        // protocol version — devices.protocol_version compares against this
  type: SyncMessageType;
  msgId: string;                // UUID — dedup + ack correlation
  deviceId: string;             // sender's device id
  signature: string;            // Ed25519 sig over `${type}:${msgId}:${JSON.stringify(payload)}`, base64
  payload: T;
}

type SyncMessageType =
  | 'sync.hello'
  | 'sync.events'
  | 'sync.request_since'
  | 'sync.ack'
  | 'file.chunk_available'
  | 'file.chunk_request'
  | 'device.trusted'
  | 'device.revoked'
  | 'heartbeat.ping'
  | 'heartbeat.pong';

interface HLC {
  physical: number;             // ms since epoch
  counter: number;
  deviceId: string;             // tiebreak, per PRD §7.2
}

// --- sync.hello — handshake on every new WS connection ---
interface SyncHelloPayload {
  deviceId: string;
  appVersion: string;
  protocolVersion: number;
  cursor: HLC | null;           // last HLC this device has seen FROM the peer it's greeting
}

// --- sync.events — batched event push ---
interface SyncEventPayload {
  id: string;                   // matches sync_events.id
  itemId: string;
  eventType: 'create' | 'update' | 'delete' | 'rename';
  hlc: HLC;
  versionVector: Record<string, number>;   // deviceId -> counter, post-event state
  payload: unknown;             // shape depends on item type — see Appendix A
}
interface SyncEventsPayload {
  events: SyncEventPayload[];   // capped at 500 per PRD §7.5
  hasMore: boolean;
}

// --- sync.request_since — catch-up request ---
interface SyncRequestSincePayload {
  since: HLC | null;            // null = request full history (first sync after pairing)
  limit?: number;                // default 500
}

// --- sync.ack — explicit ack so sender can advance confidence, not just cursor ---
interface SyncAckPayload {
  acknowledgedMsgId: string;
  appliedEventIds: string[];     // events actually applied (may be < sent, if some were no-ops)
}

// --- file.* ---
interface FileChunkAvailablePayload {
  fileId: string;
  chunkIndex: number;
  chunkHash: string;
}
interface FileChunkRequestPayload {
  fileId: string;
  chunkIndex: number;
}

// --- device.trusted / device.revoked — trust-graph propagation ---
interface DeviceTrustedPayload {
  deviceId: string;
  publicKey: string;
  signedBy: string;              // device id that performed the trust action
  trustSignature: string;        // signedBy's signature over `${deviceId}:${publicKey}`
}
interface DeviceRevokedPayload {
  deviceId: string;
  signedBy: string;
  revokeSignature: string;
  newVaultKeyEpoch: number;      // PRD §10.3 — increments on every revoke-triggered rotation
}
```

**Validation rule (applies to every inbound envelope):** verify `signature` against the sender's stored `public_key` *before* touching the payload. A failed signature is a silent drop + log entry, never an error response (don't give a malicious peer a verification oracle).

---

## 4. REST API Contracts

Base path: `http://localhost:<node-port>/api`. All responses use this error envelope on failure:

```json
{ "error": { "code": "ITEM_NOT_FOUND", "message": "No item with that id", "details": {} } }
```

| Method | Path | Request | Response | Status |
|---|---|---|---|---|
| `GET` | `/items?type=&tag=&q=&cursor=` | — | `{ items: Item[], nextCursor: string \| null }` | 200 |
| `POST` | `/items` | `{ type, content?, fileId? }` | `Item` | 201 / 400 |
| `PATCH` | `/items/:id` | `{ content?, tags? }` | `Item` | 200 / 404 |
| `DELETE` | `/items/:id` | — | `{ deleted: true }` | 200 / 404 |
| `GET` | `/items/:id/conflicts` | — | `{ conflicts: ConflictedCopy[] }` | 200 |
| `POST` | `/items/:id/resolve` | `{ keep: 'local' \| 'remote' \| 'both' }` | `Item` | 200 / 404 |
| `GET` | `/devices` | — | `{ devices: DeviceHealth[] }` | 200 |
| `POST` | `/devices/pair` | — | `{ qrPayload: string, pairingToken: string }` | 201 |
| `POST` | `/devices/:id/revoke` | — | `{ revoked: true, newVaultKeyEpoch: number }` | 200 / 404 |
| `GET` | `/files/:id/chunks/:index` | — | binary, `Range`-resumable | 200 / 206 / 404 |
| `POST` | `/share` | `{ type, content?, fileBase64? }` (FR-7) | `Item` | 201 / 400 |
| `GET` | `/health` | — | `{ devices: DeviceHealth[], localStorageBytes: number }` (FR-8) | 200 |

```typescript
interface Item {
  id: string; type: 'text'|'link'|'file'|'image'|'voice'|'clipboard';
  content: string | null; fileId: string | null;
  createdAt: number; updatedAt: number; createdBy: string;
  tags: string[];
}

interface DeviceHealth {
  id: string; name: string; status: 'pending'|'trusted'|'revoked';
  appVersion: string; protocolVersion: number;
  lastSeen: number; pendingEventCount: number; storageUsedBytes: number;
}

interface ConflictedCopy {
  id: string; itemId: string; content: string | null;
  losingDevice: string; hlcTimestamp: string; createdAt: number;
}
```

**`POST /share` note (FR-7):** this is the endpoint every native share-sheet handler (Android intent, iOS Share Extension) calls. It deliberately mirrors `POST /items` rather than reusing it directly — share-sheet payloads need looser validation (a share intent might hand you a content URI instead of inline bytes) and a different error-handling contract: a failed share should queue locally and retry silently, never surface a blocking error to a user who's mid-share from another app.

---

## 5. WebSocket Event Contracts (UI-facing)

Separate WS channel from node-to-node sync (§3) — this one is local-only, unauthenticated beyond "you can reach localhost," and drives the live UI.

```typescript
type UIEvent =
  | { type: 'item.created'; item: Item }
  | { type: 'item.updated'; item: Item }
  | { type: 'item.deleted'; itemId: string }
  | { type: 'sync.status'; peer: string; lastSync: number; pendingEvents: number }
  | { type: 'clipboard.update'; preview: string }            // V2
  | { type: 'conflict.detected'; itemId: string; conflictId: string };
```

UI clients connect once on app launch, receive a full snapshot via `GET /items` first, then apply `UIEvent`s incrementally — never re-fetch the whole list on every event.

---

## 6. Device Pairing — Sequence Diagram

Expands PRD §10.1 with exact message names from §3 above.

```
 New Device                                    Trusted Device
 ───────────                                    ──────────────
 generate Ed25519 keypair (local)
 render QR: { pubkey, pairingToken,
              bootstrapAddr }
                                                 scan QR
                                                 ─────────────────────────
                                                 derive X25519 ECDH
                                                 session key from pubkey
                                                 ─────────────────────────
                 ◄──────── show 6-digit code on BOTH screens ─────────►
                          user confirms match on trusted device
                                                 ─────────────────────────
        ◄──────────── DeviceTrustedPayload (signed) ────────────────────
        { deviceId, publicKey, signedBy, trustSignature }
                                                 ─────────────────────────
        ◄──── Vault Key, encrypted under ECDH session key ──────────────
                                                 ─────────────────────────
                                                 broadcast DeviceTrusted
                                                 to all other trusted
                                                 devices
        ─────── sync.hello { cursor: null } ───────────────────────────►
        ◄────── sync.events { events: [...full history...], hasMore } ──
        ─────── sync.ack { appliedEventIds: [...] } ───────────────────►
        ─────── sync.request_since (repeat until hasMore=false) ───────►

        Device now fully bootstrapped — appears in /devices on all peers
```

**Failure modes to handle explicitly:**
- 6-digit mismatch → abort, discard ECDH session key, no trust event ever broadcast.
- Trusted device goes offline mid-bootstrap → new device retries `sync.request_since` against any *other* trusted device once it learns the roster (full history is identical across all peers).
- QR scanned but `pairingToken` expired (5 min TTL) → new device's QR screen shows "expired, generate new code," no partial trust state created.

---

## 7. UI Wireframes

### 7.1 Inbox (Home)
```
┌─────────────────────────────┐
│ MyDrop          🔍  ⚙️        │
├─────────────────────────────┤
│ [All] [Text] [Files] [Links] │
├─────────────────────────────┤
│ 📋 "OTP: 482931"         2m  │
│ 🔗 youtube.com/watch?...   1h │
│ 📄 invoice_march.pdf      3h │
│ 🖼  Screenshot_0231.png    5h │
│ 🎙  Voice note (0:42)      1d │
├─────────────────────────────┤
│         [ + Quick Add ]       │
└─────────────────────────────┘
```

### 7.2 Item Detail
```
┌─────────────────────────────┐
│ ←  Back               ⋮ More │
├─────────────────────────────┤
│  invoice_march.pdf            │
│  2.4 MB · PDF                 │
│                                │
│  [     PDF preview pane    ]  │
│                                │
│  Tags: #work #oswas            │
│  Synced: Desktop, Laptop       │
│  Created: Mar 14, 9:02 AM      │
├─────────────────────────────┤
│ [Download] [Share] [Delete]   │
└─────────────────────────────┘
```

### 7.3 Pairing Flow
```
 Step 1 — New Device              Step 2 — Trusted Device
┌──────────────────────┐         ┌──────────────────────┐
│   Pair This Device     │         │    Scan to Pair        │
│                         │         │                         │
│    [    QR CODE    ]   │  scan→  │   [ Camera viewfinder ] │
│                         │         │                         │
│   Waiting for scan...  │         │                         │
└──────────────────────┘         └──────────────────────┘
                    ↓ both screens then show:
         ┌──────────────────────┐
         │   Confirm Code Match    │
         │                          │
         │       4   8   2   1       │
         │                          │
         │   [Confirm]  [Cancel]   │
         └──────────────────────┘
```

### 7.4 Device Health Dashboard (FR-8)
```
┌───────────────────────────────────────────┐
│ Devices                                      │
├───────────────────────────────────────────┤
│ ● Desktop          v1.4.2     Online          │
│   142 MB · 0 pending · synced just now        │
├───────────────────────────────────────────┤
│ ● Laptop           v1.4.1     Online          │
│   89 MB · 3 pending · synced 12s ago          │
├───────────────────────────────────────────┤
│ ○ Phone            v1.4.2     Offline         │
│   211 MB · 14 pending · last seen 3h ago      │
├───────────────────────────────────────────┤
│              [ + Pair New Device ]            │
└───────────────────────────────────────────┘
```

### 7.5 Conflict Resolution
```
┌───────────────────────────────────────────┐
│ ⚠  2 Versions Found                          │
├───────────────────────────────────────────┤
│  Version A (this device)   Version B (Phone)  │
│  "Meeting notes draft 1"   "Meeting notes      │
│   ...                       draft 1 + action   │
│                              items"            │
│  Edited 10:42 AM            Edited 10:44 AM    │
├───────────────────────────────────────────┤
│  [ Keep A ]   [ Keep B ]   [ Keep Both ]      │
└───────────────────────────────────────────┘
```

### 7.6 Share Sheet → Quick Add (FR-7)
```
 [Any App] → Share → ┌───────────────┐
                      │ Share via...    │
                      │ ✉  Mail          │
                      │ 💬  Messages      │
                      │ 📥  MyDrop  ←tap  │
                      └───────────────┘
                              ↓
                   ┌───────────────────────┐
                   │   Add to MyDrop          │
                   │   [ content preview ]    │
                   │   Tags: ______________   │
                   │   [ Save ]                │
                   └───────────────────────┘
                   auto-dismisses after Save —
                   never requires opening the
                   full app
```

---

## 8. MVP Sprint Breakdown (Week 1–4)

20 working days, mapped to PRD §21's V1 exit criteria. Week 1 leads with the highest-risk spike, per the standing recommendation to de-risk SQLCipher-on-mobile before building sync logic on top of it.

### Week 1 — Foundation + highest-risk spike
| Day | Work |
|---|---|
| 1–2 | Monorepo scaffold (pnpm + Turborepo); `mydrop-core` skeleton; **SQLCipher + `op-sqlite` spike on a real RN device** (not simulator) — read/write/migrate against an encrypted DB, confirm it survives app backgrounding |
| 3–4 | Migrations 0001–0005 + `migrator.ts`; `hlc.ts` + `version-vector.ts` with unit tests covering the concurrent-edit case from PRD §7.3 |
| 5 | Event log (`event-log.ts`) + local item CRUD via `mydrop-core`, exposed through REST on the Tauri desktop shell only (mobile UI not wired yet) |

### Week 2 — Sync protocol + networking
| Day | Work |
|---|---|
| 6–7 | mDNS discovery + direct LAN WS between two desktop dev instances — prove `sync.hello` → `sync.events` → `sync.ack` round-trip end to end |
| 8 | Tailscale integration for the WAN path |
| 9–10 | Pairing flow (§6): QR generation, ECDH, 6-digit confirm, Vault Key transfer — desktop-to-desktop first, then desktop-to-mobile |

### Week 3 — Mobile node + file sync + conflicts
| Day | Work |
|---|---|
| 11–12 | RN app wired to `mydrop-core`, becomes a full node (local server, mDNS, sync engine) |
| 13 | File chunking + content-addressable store + resumable transfer (§9 of PRD) |
| 14 | Conflict detection (concurrent version-vector case) + `conflicted_copies` UI (§7.5) |
| 15 | Tombstone propagation + GC sweep job |

### Week 4 — Capture surfaces + exit-criteria validation
| Day | Work |
|---|---|
| 16 | FR-7: Android `ACTION_SEND` share intent handler |
| 17 | FR-7: iOS Share Extension target + App Group bridge to main app |
| 18 | FR-8: Device Health Dashboard, desktop + mobile (§7.4) |
| 19 | Scripted end-to-end test: 1 week of offline/online cycling across 2 real devices (automate what can be automated; the offline cycling itself has to run in real time, so kick this off early in the day) |
| 20 | Bug bash + sign-off against PRD §21's V1 exit criteria: zero data loss across the cycling test, **and** every test item captured via native share sheet rather than opening the app |

**🏗 Architect's Note:** Day 19's test can't be compressed — "1 week of offline/online cycling" means what it says. Start a long-running scripted version of it (toggle airplane mode on a schedule, log every sync outcome) on Day 11 in the background on a spare device, so by Day 19 you're reviewing a week of real data instead of starting the clock from zero.

---

## 9. Explicitly Out of Scope for This SDS

These are acknowledged but deferred, consistent with PRD phasing — don't let sprint planning quietly pull them forward:

- Delta sync algorithm implementation (`files/delta.ts` ships as a stub — V2 per PRD §19)
- Clipboard OS listener wiring (`clipboard.rs` stub only — V2)
- Vault Key rotation UX on revoke with offline devices (V4 per PRD §19's open risk list)
- WebRTC fallback transport (V4)

---

*End of SDS v1.0. Builds on PRD v2.0 (locked). Amendments to architecture decisions in §3–§6 should be proposed as PRD changes first, then reflected here.*
