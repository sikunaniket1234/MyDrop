import type { AlphaItem, DatabaseClient, DatabaseRow, SqlParameters } from "@mydrop/core";
import { OpSqliteAdapter } from "../db/op-sqlite-adapter.js";

interface AlphaItemRow extends DatabaseRow {
  readonly id: string;
  readonly kind: "text" | "file";
  readonly title: string;
  readonly body: string | null;
  readonly fileName: string | null;
  readonly fileUri: string | null;
  readonly fileDataUrl: string | null;
  readonly fileSize: number | null;
  readonly mimeType: string | null;
  readonly createdAt: number;
  readonly sourceDevice: string;
}

const adapter = new OpSqliteAdapter();

export async function openAlphaMobileStore(): Promise<AlphaMobileStore> {
  const client = await adapter.open({ name: "mydrop-alpha.sqlite" });
  await client.exec(`
    CREATE TABLE IF NOT EXISTS alpha_items (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('text', 'file')),
      title TEXT NOT NULL,
      body TEXT,
      fileName TEXT,
      fileUri TEXT,
      fileDataUrl TEXT,
      fileSize INTEGER,
      mimeType TEXT,
      createdAt INTEGER NOT NULL,
      sourceDevice TEXT NOT NULL
    );
  `);

  return new AlphaMobileStore(client);
}

export class AlphaMobileStore {
  constructor(private readonly client: DatabaseClient) {}

  async listItems(): Promise<AlphaItem[]> {
    const rows = await this.client.query<AlphaItemRow>(
      `SELECT id, kind, title, body, fileName, fileUri, fileDataUrl, fileSize, mimeType, createdAt, sourceDevice
       FROM alpha_items
       ORDER BY createdAt DESC`,
    );

    return rows.map((row) => ({ ...row }));
  }

  async saveItem(item: AlphaItem): Promise<void> {
    await this.client.exec(
      `INSERT OR REPLACE INTO alpha_items (
        id, kind, title, body, fileName, fileUri, fileDataUrl, fileSize, mimeType, createdAt, sourceDevice
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.kind,
        item.title,
        item.body,
        item.fileName,
        item.fileUri,
        item.fileDataUrl,
        item.fileSize,
        item.mimeType,
        item.createdAt,
        item.sourceDevice,
      ] satisfies SqlParameters,
    );
  }
}
