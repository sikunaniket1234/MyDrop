import type { DatabaseClient, ExecutionResult, DatabaseRow, SqlParameters } from "@mydrop/core";
import Database from "better-sqlite3";

export class BetterSqlite3Client implements DatabaseClient {
  readonly #db: Database.Database;

  public constructor(db: Database.Database) {
    this.#db = db;
    this.#db.pragma("journal_mode = WAL");
    this.#db.pragma("foreign_keys = ON");
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- better-sqlite3 is synchronous, interface requires Promise
  async query<T extends DatabaseRow = DatabaseRow>(
    sql: string,
    parameters?: SqlParameters,
  ): Promise<T[]> {
    const stmt = this.#db.prepare(sql);
    const rows = parameters ? stmt.all(...parameters) : stmt.all();
    return rows as unknown as T[];
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- better-sqlite3 is synchronous, interface requires Promise
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

  // eslint-disable-next-line @typescript-eslint/require-await -- better-sqlite3 is synchronous, interface requires Promise
  async close(): Promise<void> {
    this.#db.close();
  }
}
