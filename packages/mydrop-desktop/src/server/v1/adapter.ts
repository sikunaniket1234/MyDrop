import type { DatabaseClient, ExecutionResult, DatabaseRow, SqlParameters } from "@mydrop/core";
import Database from "better-sqlite3";

export class BetterSqlite3Client implements DatabaseClient {
  readonly #db: Database.Database;

  public constructor(db: Database.Database) {
    this.#db = db;
    this.#db.pragma("journal_mode = WAL");
    this.#db.pragma("foreign_keys = ON");
  }

  async query<T extends DatabaseRow = DatabaseRow>(
    sql: string,
    parameters?: SqlParameters,
  ): Promise<T[]> {
    const stmt = this.#db.prepare(sql);
    const rows = parameters ? stmt.all(...parameters) : stmt.all();
    return rows as T[];
  }

  async exec(
    sql: string,
    parameters?: SqlParameters,
  ): Promise<ExecutionResult> {
    if (parameters) {
      const stmt = this.#db.prepare(sql);
      const info = stmt.run(...parameters);
      return {
        rowsAffected: info.changes,
      };
    }

    const stmt = this.#db.prepare(sql);
    const info = stmt.run();
    return {
      rowsAffected: info.changes,
    };
  }

  async close(): Promise<void> {
    this.#db.close();
  }
}
