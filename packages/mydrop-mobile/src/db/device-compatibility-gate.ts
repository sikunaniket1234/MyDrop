import { migrate, StaticMigrationSource, supportsFts5 } from "@mydrop/core";
import { OpSqliteAdapter } from "./op-sqlite-adapter.js";

export interface MobileCompatibilityResult {
  readonly fts5: boolean;
  readonly lifecycle: boolean;
  readonly encryptedOpenRequested: boolean;
}

export async function runMobileDatabaseCompatibilityGate(options: {
  readonly name: string;
  readonly location?: string;
  readonly encryptionKey?: string;
}): Promise<MobileCompatibilityResult> {
  const adapter = new OpSqliteAdapter();
  const migrations = new StaticMigrationSource([
    {
      filename: "0001_probe.sql",
      sql: "CREATE TABLE compatibility_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)",
    },
    {
      filename: "0002_fts5.sql",
      sql: "CREATE VIRTUAL TABLE compatibility_probe_fts USING fts5(value)",
    },
  ]);
  const openOptions = {
    name: options.name,
    ...(options.location === undefined ? {} : { location: options.location }),
    ...(options.encryptionKey === undefined ? {} : { encryptionKey: options.encryptionKey }),
  };
  const first = await adapter.open(openOptions);
  const fts5 = await supportsFts5(first);
  await migrate(first, migrations);
  await first.exec("INSERT INTO compatibility_probe(value) VALUES (?)", ["durable"]);
  await first.close();

  const reopened = await adapter.open(openOptions);
  const rows = await reopened.query<{ value: string }>(
    "SELECT value FROM compatibility_probe WHERE value = ?",
    ["durable"],
  );
  await reopened.close();
  return {
    fts5,
    lifecycle: rows.length === 1 && rows[0]?.value === "durable",
    encryptedOpenRequested: options.encryptionKey !== undefined,
  };
}
