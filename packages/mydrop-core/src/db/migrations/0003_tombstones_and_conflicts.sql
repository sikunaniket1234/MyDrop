CREATE TABLE tombstones (
    item_id         TEXT PRIMARY KEY,
    hlc_physical    INTEGER NOT NULL,
    hlc_counter     INTEGER NOT NULL,
    device_id       TEXT,
    expires_at      INTEGER NOT NULL
);
CREATE INDEX idx_tombstones_expiry ON tombstones(expires_at);

CREATE TABLE conflicted_copies (
    id              TEXT PRIMARY KEY,
    item_id         TEXT,
    content         TEXT,
    file_id         TEXT,
    losing_device   TEXT,
    hlc_timestamp   TEXT NOT NULL,
    created_at      INTEGER NOT NULL
);
CREATE INDEX idx_conflicts_item ON conflicted_copies(item_id);
