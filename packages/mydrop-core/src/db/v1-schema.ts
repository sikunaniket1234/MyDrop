export const V1_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS devices (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  public_key      TEXT NOT NULL,
  app_version     TEXT,
  protocol_version INTEGER DEFAULT 1,
  trusted_at      INTEGER,
  last_seen       INTEGER,
  storage_used_bytes INTEGER DEFAULT 0,
  status          TEXT CHECK(status IN ('pending','trusted','revoked')) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS items (
  id              TEXT PRIMARY KEY,
  type            TEXT CHECK(type IN ('text','link','file','image','voice','clipboard')) NOT NULL,
  title           TEXT NOT NULL DEFAULT '',
  content         TEXT,
  file_id         TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  created_by      TEXT,
  version_vector  TEXT NOT NULL DEFAULT '{}',
  deleted         INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conflicted_copies (
  id              TEXT PRIMARY KEY,
  item_id         TEXT NOT NULL,
  content         TEXT,
  file_id         TEXT,
  losing_device   TEXT NOT NULL,
  hlc_physical    INTEGER NOT NULL,
  hlc_counter     INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id              TEXT PRIMARY KEY,
  size            INTEGER NOT NULL,
  mime_type       TEXT,
  chunk_count     INTEGER NOT NULL DEFAULT 0,
  fully_synced    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS file_chunks (
  file_id         TEXT NOT NULL,
  chunk_index     INTEGER NOT NULL,
  chunk_hash      TEXT NOT NULL,
  size            INTEGER NOT NULL,
  local_path      TEXT,
  PRIMARY KEY (file_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS sync_events (
  id              TEXT PRIMARY KEY,
  item_id         TEXT NOT NULL,
  event_type      TEXT CHECK(event_type IN ('create','update','delete','rename')) NOT NULL,
  payload         TEXT,
  item_version_vector TEXT NOT NULL DEFAULT '{}',
  hlc_physical    INTEGER NOT NULL,
  hlc_counter     INTEGER NOT NULL,
  device_id       TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_events_hlc ON sync_events(hlc_physical, hlc_counter);
CREATE INDEX IF NOT EXISTS idx_sync_events_item_id ON sync_events(item_id);

CREATE TABLE IF NOT EXISTS sync_cursors (
  peer_device_id    TEXT PRIMARY KEY,
  last_hlc_physical INTEGER,
  last_hlc_counter  INTEGER
);

CREATE TABLE IF NOT EXISTS tombstones (
  item_id       TEXT PRIMARY KEY,
  hlc_physical  INTEGER NOT NULL,
  hlc_counter   INTEGER NOT NULL,
  device_id     TEXT NOT NULL,
  expires_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  item_id       TEXT NOT NULL,
  tag           TEXT NOT NULL,
  source        TEXT CHECK(source IN ('manual','auto')) DEFAULT 'manual',
  PRIMARY KEY (item_id, tag)
);
`;
