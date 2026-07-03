import { V1_SCHEMA_SQL } from "@mydrop/core";
import type { DatabaseClient } from "@mydrop/core";

export async function migrateV1(client: DatabaseClient): Promise<void> {
  await client.exec(
    "CREATE TABLE IF NOT EXISTS _v1_migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );

  const rows = await client.query<{ filename: string }>(
    "SELECT filename FROM _v1_migrations WHERE filename = '001_v1_schema'",
  );

  if (rows.length > 0) return;

  await client.exec("BEGIN IMMEDIATE");
  try {
    for (const statement of splitSqlStatements(V1_SCHEMA_SQL)) {
      await client.exec(statement);
    }
    await client.exec(
      "INSERT INTO _v1_migrations (filename, applied_at) VALUES ('001_v1_schema', ?)",
      [Date.now()],
    );
    await client.exec("COMMIT");
  } catch (error) {
    await client.exec("ROLLBACK");
    throw error;
  }
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => `${s};`);
}
