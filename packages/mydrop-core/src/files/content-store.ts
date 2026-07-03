import type { DatabaseClient, SqlPrimitive } from "../db/client.js";
import { chunkData, CHUNK_SIZE_BYTES } from "./chunker.js";
import type { HashFunction } from "./hash.js";

export interface FileRecord {
  readonly id: string;
  readonly size: number;
  readonly mimeType: string | null;
  readonly chunkCount: number;
  readonly fullySynced: boolean;
}

export interface FileChunkRecord {
  readonly fileId: string;
  readonly chunkIndex: number;
  readonly chunkHash: string;
  readonly size: number;
  readonly localPath: string | null;
}

interface FileRow {
  readonly [key: string]: SqlPrimitive;
  readonly id: string;
  readonly size: number;
  readonly mime_type: string | null;
  readonly chunk_count: number;
  readonly fully_synced: number;
}

interface ChunkRow {
  readonly [key: string]: SqlPrimitive;
  readonly file_id: string;
  readonly chunk_index: number;
  readonly chunk_hash: string;
  readonly size: number;
  readonly local_path: string | null;
}

export interface ChunkDataStore {
  write(hash: string, data: Uint8Array): Promise<void>;
  read(hash: string): Promise<Uint8Array | null>;
  exists(hash: string): Promise<boolean>;
  delete(hash: string): Promise<void>;
}

export class ContentStore {
  readonly #db: DatabaseClient;
  readonly #chunks: ChunkDataStore;
  readonly #hash: HashFunction;
  readonly #chunkSize: number;

  public constructor(
    db: DatabaseClient,
    chunks: ChunkDataStore,
    hash: HashFunction,
    chunkSize: number = CHUNK_SIZE_BYTES,
  ) {
    this.#db = db;
    this.#chunks = chunks;
    this.#hash = hash;
    this.#chunkSize = chunkSize;
  }

  async storeFile(
    data: Uint8Array,
    mimeType?: string,
  ): Promise<FileRecord> {
    const fileHash = await this.#hash(data);
    const existing = await this.getFile(fileHash);
    if (existing) return existing;

    const chunks = chunkData(data, this.#chunkSize);
    const chunkHashes = await Promise.all(
      chunks.map((chunk) => this.#hash(chunk.data)),
    );

    await this.#db.exec("BEGIN IMMEDIATE");
    try {
      await this.#db.exec(
        `INSERT OR IGNORE INTO files (id, size, mime_type, chunk_count, fully_synced)
         VALUES (?, ?, ?, ?, 0)`,
        [fileHash, data.length, mimeType ?? null, chunks.length],
      );

      for (let i = 0; i < chunks.length; i++) {
        const chunkHash = chunkHashes[i]!;
        await this.#db.exec(
          `INSERT OR IGNORE INTO file_chunks (file_id, chunk_index, chunk_hash, size, local_path)
           VALUES (?, ?, ?, ?, ?)`,
          [fileHash, i, chunkHash, chunks[i]!.data.length, null],
        );

        if (!(await this.#chunks.exists(chunkHash))) {
          await this.#chunks.write(chunkHash, chunks[i]!.data);
        }
      }

      await this.#db.exec(
        `UPDATE files SET fully_synced = 1 WHERE id = ?`,
        [fileHash],
      );

      await this.#db.exec("COMMIT");
    } catch (error) {
      await this.#db.exec("ROLLBACK");
      throw error;
    }

    return (await this.getFile(fileHash))!;
  }

  async storeChunk(
    fileId: string,
    chunkIndex: number,
    data: Uint8Array,
  ): Promise<void> {
    const chunkHash = await this.#hash(data);

    await this.#chunks.write(chunkHash, data);

    await this.#db.exec(
      `INSERT OR REPLACE INTO file_chunks (file_id, chunk_index, chunk_hash, size, local_path)
       VALUES (?, ?, ?, ?, ?)`,
      [fileId, chunkIndex, chunkHash, data.length, null],
    );
  }

  async getFile(fileId: string): Promise<FileRecord | null> {
    const rows = await this.#db.query<FileRow>(
      `SELECT id, size, mime_type, chunk_count, fully_synced FROM files WHERE id = ?`,
      [fileId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      size: row.size,
      mimeType: row.mime_type,
      chunkCount: row.chunk_count,
      fullySynced: row.fully_synced === 1,
    };
  }

  async getChunks(fileId: string): Promise<FileChunkRecord[]> {
    const rows = await this.#db.query<ChunkRow>(
      `SELECT file_id, chunk_index, chunk_hash, size, local_path
       FROM file_chunks
       WHERE file_id = ?
       ORDER BY chunk_index ASC`,
      [fileId],
    );
    return rows.map((row) => ({
      fileId: row.file_id,
      chunkIndex: row.chunk_index,
      chunkHash: row.chunk_hash,
      size: row.size,
      localPath: row.local_path,
    }));
  }

  async getChunkData(
    fileId: string,
    chunkIndex: number,
  ): Promise<Uint8Array | null> {
    const rows = await this.#db.query<ChunkRow>(
      `SELECT chunk_hash FROM file_chunks WHERE file_id = ? AND chunk_index = ?`,
      [fileId, chunkIndex],
    );
    const row = rows[0];
    if (!row) return null;
    return this.#chunks.read(row.chunk_hash);
  }

  async getMissingChunks(fileId: string): Promise<number[]> {
    const chunks = await this.getChunks(fileId);
    const missing: number[] = [];
    for (const chunk of chunks) {
      if (!(await this.#chunks.exists(chunk.chunkHash))) {
        missing.push(chunk.chunkIndex);
      }
    }
    return missing;
  }

  async markComplete(fileId: string): Promise<void> {
    await this.#db.exec(
      `UPDATE files SET fully_synced = 1 WHERE id = ?`,
      [fileId],
    );
  }

  async reconstructFile(fileId: string): Promise<Uint8Array | null> {
    const file = await this.getFile(fileId);
    if (!file) return null;

    const chunks = await this.getChunks(fileId);
    const parts: Uint8Array[] = [];

    for (const chunk of chunks) {
      const data = await this.#chunks.read(chunk.chunkHash);
      if (!data) return null;
      parts.push(data);
    }

    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  async deleteFile(fileId: string): Promise<void> {
    const chunks = await this.getChunks(fileId);
    await this.#db.exec("BEGIN IMMEDIATE");
    try {
      for (const chunk of chunks) {
        await this.#chunks.delete(chunk.chunkHash);
      }
      await this.#db.exec(`DELETE FROM file_chunks WHERE file_id = ?`, [fileId]);
      await this.#db.exec(`DELETE FROM files WHERE id = ?`, [fileId]);
      await this.#db.exec("COMMIT");
    } catch (error) {
      await this.#db.exec("ROLLBACK");
      throw error;
    }
  }
}
