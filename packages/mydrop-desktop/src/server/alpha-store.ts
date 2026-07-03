import type { AlphaItem, CreateAlphaFileItem, CreateAlphaTextItem } from "@mydrop/core";
import { createAlphaItemId, titleForAlphaText } from "@mydrop/core";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

interface AlphaItemRow {
  readonly id: string;
  readonly kind: "text" | "file";
  readonly title: string;
  readonly body: string | null;
  readonly file_name: string | null;
  readonly file_uri: string | null;
  readonly file_data_url: string | null;
  readonly file_size: number | null;
  readonly mime_type: string | null;
  readonly created_at: number;
  readonly source_device: string;
}

export class AlphaDesktopStore {
  readonly #db: Database.Database;

  constructor(path = defaultAlphaDatabasePath()) {
    mkdirSync(dirname(path), { recursive: true });
    this.#db = new Database(path);
    this.#db.pragma("journal_mode = WAL");
    this.#db.pragma("foreign_keys = ON");
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS alpha_items (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('text', 'file')),
        title TEXT NOT NULL,
        body TEXT,
        file_name TEXT,
        file_uri TEXT,
        file_data_url TEXT,
        file_size INTEGER,
        mime_type TEXT,
        created_at INTEGER NOT NULL,
        source_device TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_alpha_items_created_at
        ON alpha_items(created_at DESC);
    `);
  }

  listItems(): AlphaItem[] {
    const rows = this.#db
      .prepare(
        `SELECT id, kind, title, body, file_name, file_uri, file_data_url, file_size, mime_type, created_at, source_device
         FROM alpha_items
         ORDER BY created_at DESC`,
      )
      .all() as AlphaItemRow[];

    return rows.map(rowToAlphaItem);
  }

  createTextItem(input: CreateAlphaTextItem): AlphaItem {
    const now = Date.now();
    const item: AlphaItem = {
      id: createAlphaItemId(now),
      kind: "text",
      title: titleForAlphaText(input.body),
      body: input.body,
      fileName: null,
      fileUri: null,
      fileDataUrl: null,
      fileSize: null,
      mimeType: null,
      createdAt: now,
      sourceDevice: input.sourceDevice,
    };

    this.#insert(item);
    return item;
  }

  createFileItem(input: CreateAlphaFileItem): AlphaItem {
    const now = Date.now();
    const item: AlphaItem = {
      id: createAlphaItemId(now),
      kind: "file",
      title: input.fileName,
      body: null,
      fileName: input.fileName,
      fileUri: input.fileUri,
      fileDataUrl: input.fileDataUrl ?? null,
      fileSize: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      createdAt: now,
      sourceDevice: input.sourceDevice,
    };

    this.#insert(item);
    return item;
  }

  close(): void {
    this.#db.close();
  }

  #insert(item: AlphaItem): void {
    this.#db
      .prepare(
        `INSERT INTO alpha_items (
          id, kind, title, body, file_name, file_uri, file_data_url, file_size, mime_type, created_at, source_device
        ) VALUES (
          @id, @kind, @title, @body, @fileName, @fileUri, @fileDataUrl, @fileSize, @mimeType, @createdAt, @sourceDevice
        )`,
      )
      .run(item);
  }
}

function defaultAlphaDatabasePath(): string {
  return process.env.MYDROP_ALPHA_DB ?? join(homedir(), ".mydrop", "alpha.sqlite");
}

function rowToAlphaItem(row: AlphaItemRow): AlphaItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    fileName: row.file_name,
    fileUri: row.file_uri,
    fileDataUrl: row.file_data_url,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    sourceDevice: row.source_device,
  };
}
