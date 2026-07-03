export type SqlPrimitive = string | number | boolean | null | Uint8Array | ArrayBuffer;
export type SqlParameters = readonly SqlPrimitive[];
export type DatabaseRow = Readonly<Record<string, SqlPrimitive>>;

export interface ExecutionResult {
  readonly rowsAffected: number;
  readonly insertId?: number;
}

export interface DatabaseOpenOptions {
  readonly name: string;
  readonly location?: string;
  /** Opaque SQLCipher key supplied by the platform. Core never derives it. */
  readonly encryptionKey?: string;
}

export interface DatabaseClient {
  query<T extends DatabaseRow = DatabaseRow>(sql: string, parameters?: SqlParameters): Promise<T[]>;
  exec(sql: string, parameters?: SqlParameters): Promise<ExecutionResult>;
  close(): Promise<void>;
}

export interface DatabaseAdapter {
  open(options: DatabaseOpenOptions): Promise<DatabaseClient>;
}
