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
    title           TEXT NOT NULL DEFAULT '',
    content         TEXT,
    file_id         TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    created_by      TEXT,
    version_vector  TEXT NOT NULL DEFAULT '{}',
    deleted         INTEGER DEFAULT 0
);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_updated ON items(updated_at);

CREATE TABLE files (
    id              TEXT PRIMARY KEY,
    size            INTEGER NOT NULL,
    mime_type       TEXT,
    chunk_count     INTEGER NOT NULL,
    fully_synced    INTEGER DEFAULT 0
);

CREATE TABLE file_chunks (
    file_id         TEXT,
    chunk_index     INTEGER NOT NULL,
    chunk_hash      TEXT NOT NULL,
    size            INTEGER NOT NULL,
    local_path      TEXT,
    PRIMARY KEY (file_id, chunk_index)
);
