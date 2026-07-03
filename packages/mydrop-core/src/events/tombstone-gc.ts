import type { DatabaseClient, SqlPrimitive } from "../db/client.js";
import type { HLC } from "../sync/types.js";

export const TOMBSTONE_RETENTION_DAYS = 30;

interface TombstoneRow {
  readonly [key: string]: SqlPrimitive;
  readonly item_id: string;
  readonly hlc_physical: number;
  readonly hlc_counter: number;
  readonly device_id: string;
  readonly expires_at: number;
}

export class TombstoneGc {
  readonly #db: DatabaseClient;

  public constructor(db: DatabaseClient) {
    this.#db = db;
  }

  async create(
    itemId: string,
    hlc: HLC,
    deviceId: string,
    createdAt: number,
  ): Promise<void> {
    const expiresAt = createdAt + TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    await this.#db.exec(
      `INSERT OR REPLACE INTO tombstones (item_id, hlc_physical, hlc_counter, device_id, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [itemId, hlc.physical, hlc.counter, deviceId, expiresAt],
    );
  }

  async exists(itemId: string): Promise<boolean> {
    const rows = await this.#db.query<{ item_id: string }>(
      `SELECT item_id FROM tombstones WHERE item_id = ?`,
      [itemId],
    );
    return rows.length > 0;
  }

  async runSweep(): Promise<number> {
    const now = Date.now();
    const result = await this.#db.exec(
      `DELETE FROM tombstones WHERE expires_at < ?`,
      [now],
    );
    return result.rowsAffected;
  }

  async listExpired(): Promise<string[]> {
    const now = Date.now();
    const rows = await this.#db.query<TombstoneRow>(
      `SELECT item_id FROM tombstones WHERE expires_at < ?`,
      [now],
    );
    return rows.map(r => r.item_id);
  }

  async count(): Promise<number> {
    const rows = await this.#db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM tombstones`,
    );
    return rows[0]?.count ?? 0;
  }
}
