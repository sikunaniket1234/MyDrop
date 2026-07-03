CREATE TABLE sync_events (
    id              TEXT PRIMARY KEY,
    item_id         TEXT NOT NULL,
    event_type      TEXT CHECK(event_type IN ('create','update','delete','rename')) NOT NULL,
    payload         TEXT,
    item_version_vector TEXT NOT NULL DEFAULT '{}',
    hlc_physical    INTEGER NOT NULL,
    hlc_counter     INTEGER NOT NULL,
    device_id       TEXT,
    created_at      INTEGER NOT NULL
);
CREATE INDEX idx_events_hlc ON sync_events(hlc_physical, hlc_counter);
CREATE INDEX idx_events_item ON sync_events(item_id);

CREATE TABLE sync_cursors (
    peer_device_id      TEXT PRIMARY KEY,
    last_hlc_physical   INTEGER,
    last_hlc_counter    INTEGER
);
