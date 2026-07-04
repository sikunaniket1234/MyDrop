import { open, type DB, type Scalar } from "@op-engineering/op-sqlite";
import type {
  DatabaseAdapter,
  DatabaseClient,
  DatabaseOpenOptions,
  DatabaseRow,
  ExecutionResult,
  SqlParameters,
} from "@mydrop/core";

const scalarParameters = (parameters: SqlParameters = []): Scalar[] => [...parameters] as Scalar[];

class OpSqliteClient implements DatabaseClient {
  public constructor(private readonly database: DB) {}

  public async query<T extends DatabaseRow>(
    sql: string,
    parameters: SqlParameters = [],
  ): Promise<T[]> {
    const result = await this.database.execute(sql, scalarParameters(parameters));
    return result.rows as T[];
  }

  public async exec(sql: string, parameters: SqlParameters = []): Promise<ExecutionResult> {
    const result = await this.database.execute(sql, scalarParameters(parameters));
    return {
      rowsAffected: result.rowsAffected,
      ...(result.insertId === undefined ? {} : { insertId: result.insertId }),
    };
  }

  public async close(): Promise<void> {
    await this.database.closeAsync();
  }
}

export class OpSqliteAdapter implements DatabaseAdapter {
  public open(options: DatabaseOpenOptions): Promise<DatabaseClient> {
    const nativeOptions = {
      name: options.name,
      ...(options.location === undefined ? {} : { location: options.location }),
      ...(options.encryptionKey === undefined ? {} : { encryptionKey: options.encryptionKey }),
    };
    const db = open(nativeOptions);
    return Promise.resolve(new OpSqliteClient(db));
  }
}
