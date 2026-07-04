import type { DatabaseClient } from "./client.js";

export interface Migration {
  readonly filename: string;
  readonly sql: string;
}

export interface MigrationSource {
  discover(): Promise<readonly Migration[]>;
}

export interface MigrationResult {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
}

const validFilename = /^\d{4}_[a-z0-9][a-z0-9_-]*\.sql$/;

export async function migrate(
  client: DatabaseClient,
  source: MigrationSource,
  now: () => number = Date.now,
): Promise<MigrationResult> {
  await client.exec(
    "CREATE TABLE IF NOT EXISTS applied_migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const migrations = [...(await source.discover())].sort((a, b) =>
    a.filename.localeCompare(b.filename),
  );
  const seen = new Set<string>();
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    if (!validFilename.test(migration.filename) || seen.has(migration.filename)) {
      throw new Error(`Invalid or duplicate migration filename: ${migration.filename}`);
    }
    seen.add(migration.filename);
    const existing = await client.query<{ filename: string }>(
      "SELECT filename FROM applied_migrations WHERE filename = ?",
      [migration.filename],
    );
    if (existing.length > 0) {
      skipped.push(migration.filename);
      continue;
    }

    await client.exec("BEGIN IMMEDIATE");
    try {
      await client.exec(migration.sql);
      await client.exec("INSERT INTO applied_migrations(filename, applied_at) VALUES (?, ?)", [
        migration.filename,
        now(),
      ]);
      await client.exec("COMMIT");
      applied.push(migration.filename);
    } catch (error) {
      await client.exec("ROLLBACK");
      throw error;
    }
  }
  return { applied, skipped };
}

export class StaticMigrationSource implements MigrationSource {
  public constructor(private readonly migrations: readonly Migration[]) {}
  public discover(): Promise<readonly Migration[]> {
    return Promise.resolve(this.migrations);
  }
}

export interface FileReader {
  readFile(path: string): Promise<string>;
  listFiles(dir: string): Promise<string[]>;
}

export class FsMigrationSource implements MigrationSource {
  public constructor(
    private readonly dir: string,
    private readonly fs: FileReader,
  ) {}

  public async discover(): Promise<readonly Migration[]> {
    const files = await this.fs.listFiles(this.dir);
    const sqlFiles = files
      .filter(f => f.endsWith(".sql"))
      .sort();
    const migrations: Migration[] = [];
    for (const file of sqlFiles) {
      const fullPath = `${this.dir}/${file}`;
      const sql = await this.fs.readFile(fullPath);
      migrations.push({ filename: file, sql });
    }
    return migrations;
  }
}

export function readMigrationFile(name: string, sql: string): Migration {
  return { filename: name, sql };
}

export const MIGRATION_0001 = readMigrationFile(
  "0001_init.sql",
  `CREATE TABLE IF NOT EXISTS applied_migrations (
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
);`,
);

export const MIGRATION_0002 = readMigrationFile(
  "0002_sync_events_and_cursors.sql",
  `CREATE TABLE sync_events (
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
);`,
);

export const MIGRATION_0003 = readMigrationFile(
  "0003_tombstones_and_conflicts.sql",
  `CREATE TABLE tombstones (
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
CREATE INDEX idx_conflicts_item ON conflicted_copies(item_id);`,
);

export const MIGRATION_0004 = readMigrationFile(
  "0004_tags_and_fts.sql",
  `CREATE TABLE tags (
    item_id         TEXT,
    tag             TEXT NOT NULL,
    source          TEXT CHECK(source IN ('manual','auto')) DEFAULT 'manual',
    PRIMARY KEY (item_id, tag)
);

CREATE VIRTUAL TABLE items_fts USING fts5(
    content,
    content='items',
    content_rowid='rowid'
);

CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO items_fts(rowid, content) VALUES (new.rowid, new.content);
END;`,
);

export const MIGRATION_0005 = readMigrationFile(
  "0005_device_health_fields.sql",
  `ALTER TABLE devices ADD COLUMN app_version TEXT;
ALTER TABLE devices ADD COLUMN protocol_version INTEGER DEFAULT 1;
ALTER TABLE devices ADD COLUMN storage_used_bytes INTEGER DEFAULT 0;`,
);

export const ALL_MIGRATIONS: readonly Migration[] = [
  MIGRATION_0001,
  MIGRATION_0002,
  MIGRATION_0003,
  MIGRATION_0004,
  MIGRATION_0005,
];
