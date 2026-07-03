import Database from "better-sqlite3";
import type {
  DatabaseAdapter,
  DatabaseClient,
  DatabaseOpenOptions,
  DatabaseRow,
  ExecutionResult,
  SqlParameters,
} from "@mydrop/core";

function values(parameters: SqlParameters = []): unknown[] {
  return [...parameters];
}

class BetterSqliteClient implements DatabaseClient {
  public constructor(private readonly database: Database.Database) {}

  public query<T extends DatabaseRow>(sql: string, parameters: SqlParameters = []): Promise<T[]> {
    return Promise.resolve(this.database.prepare(sql).all(...values(parameters)) as T[]);
  }

  public exec(sql: string, parameters: SqlParameters = []): Promise<ExecutionResult> {
    if (parameters.length === 0) {
      this.database.exec(sql);
      return Promise.resolve({ rowsAffected: 0 });
    }
    const result = this.database.prepare(sql).run(...values(parameters));
    return Promise.resolve({
      rowsAffected: result.changes,
      insertId: Number(result.lastInsertRowid),
    });
  }

  public close(): Promise<void> {
    this.database.close();
    return Promise.resolve();
  }
}

export class BetterSqliteAdapter implements DatabaseAdapter {
  public open(options: DatabaseOpenOptions): Promise<DatabaseClient> {
    return Promise.resolve().then(() => {
      const path = options.location ? `${options.location}/${options.name}` : options.name;
      const database = new Database(path);
      if (options.encryptionKey !== undefined) {
        const escapedKey = options.encryptionKey.replaceAll("'", "''");
        database.pragma(`key='${escapedKey}'`);
        const cipherVersion = database.pragma("cipher_version", { simple: true });
        if (typeof cipherVersion !== "string" || cipherVersion.length === 0) {
          database.close();
          throw new Error("The installed better-sqlite3 build does not include SQLCipher");
        }
      }
      database.pragma("foreign_keys = ON");
      return new BetterSqliteClient(database);
    });
  }
}
