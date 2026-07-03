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
