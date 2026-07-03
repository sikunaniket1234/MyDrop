import type { DatabaseClient, SqlPrimitive } from "../db/client.js";
import { EventLog } from "../events/event-log.js";
import { TombstoneGc } from "../events/tombstone-gc.js";
import { hlcNow, hlcCompare } from "./hlc.js";
import type {
  ConflictedCopy,
  HLC,
  Item,
  ItemType,
  SyncEvent,
  VersionVector,
} from "./types.js";
import {
  classifyConflict,
  mergeVersionVectors,
  updateVersionVector,
} from "./version-vector.js";

export interface CreateItemInput {
  readonly type: ItemType;
  readonly title: string;
  readonly content: string | null;
  readonly fileId: string | null;
}

export interface ApplyResult {
  readonly applied: number;
  readonly conflicted: number;
  readonly skipped: number;
}

interface ItemRow {
  readonly [key: string]: SqlPrimitive;
  readonly id: string;
  readonly type: ItemType;
  readonly title: string;
  readonly content: string | null;
  readonly file_id: string | null;
  readonly created_at: number;
  readonly updated_at: number;
  readonly created_by: string;
  readonly version_vector: string;
  readonly deleted: number;
}

interface ConflictRow {
  readonly [key: string]: SqlPrimitive;
  readonly id: string;
  readonly item_id: string;
  readonly content: string | null;
  readonly file_id: string | null;
  readonly losing_device: string;
  readonly hlc_physical: number;
  readonly hlc_counter: number;
  readonly created_at: number;
}

export class SyncEngine {
  readonly #db: DatabaseClient;
  readonly #deviceId: string;
  readonly #eventLog: EventLog;
  readonly #tombstones: TombstoneGc;
  #lastHlc: HLC | null = null;

  public constructor(db: DatabaseClient, deviceId: string) {
    this.#db = db;
    this.#deviceId = deviceId;
    this.#eventLog = new EventLog(db);
    this.#tombstones = new TombstoneGc(db);
  }

  public get deviceId(): string {
    return this.#deviceId;
  }

  async createItem(input: CreateItemInput): Promise<Item> {
    const now = Date.now();
    const id = generateId();
    const hlc = this.#nextHlc();
    const vv: VersionVector = { [this.#deviceId]: 1 };

    await this.#db.exec("BEGIN IMMEDIATE");

    try {
      await this.#eventLog.append(id, "create", input as unknown as Record<string, unknown>, vv, hlc, this.#deviceId, now);

      const item: Item = {
        id,
        type: input.type,
        title: input.title ?? "",
        content: input.content ?? null,
        fileId: input.fileId ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: this.#deviceId,
        versionVector: vv,
        deleted: false,
      };

      await this.#upsertItem(item);

      await this.#db.exec("COMMIT");
      return item;
    } catch (error) {
      await this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  async updateItem(
    id: string,
    changes: Record<string, unknown>,
  ): Promise<Item> {
    const existing = await this.#findItem(id);
    if (!existing) {
      throw new Error(`Item not found: ${id}`);
    }
    if (existing.deleted) {
      throw new Error(`Item is deleted: ${id}`);
    }

    const now = Date.now();
    const hlc = this.#nextHlc();
    const newVv = updateVersionVector(existing.versionVector, this.#deviceId);

    await this.#db.exec("BEGIN IMMEDIATE");

    try {
      await this.#eventLog.append(id, "update", changes, newVv, hlc, this.#deviceId, now);

      const item: Item = {
        ...existing,
        ...(changes as Partial<Item>),
        updatedAt: now,
        versionVector: newVv,
      };

      await this.#upsertItem(item);

      await this.#db.exec("COMMIT");
      return item;
    } catch (error) {
      await this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  async deleteItem(id: string): Promise<void> {
    const existing = await this.#findItem(id);
    if (!existing || existing.deleted) return;

    const now = Date.now();
    const hlc = this.#nextHlc();

    await this.#db.exec("BEGIN IMMEDIATE");

    try {
      await this.#eventLog.append(id, "delete", null, existing.versionVector, hlc, this.#deviceId, now);
      await this.#tombstones.create(id, hlc, this.#deviceId, now);

      await this.#db.exec(
        `UPDATE items SET deleted = 1, updated_at = ?, version_vector = ? WHERE id = ?`,
        [now, JSON.stringify(existing.versionVector), id],
      );

      await this.#db.exec("COMMIT");
    } catch (error) {
      await this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  async getItem(id: string): Promise<Item | null> {
    return this.#findItem(id);
  }

  async listItems(): Promise<Item[]> {
    const rows = await this.#db.query<ItemRow>(
      `SELECT id, type, title, content, file_id, created_at, updated_at, created_by, version_vector, deleted
       FROM items
       WHERE deleted = 0
       ORDER BY updated_at DESC`,
    );
    return rows.map(rowToItem);
  }

  async getConflictedCopies(itemId: string): Promise<ConflictedCopy[]> {
    const rows = await this.#db.query<ConflictRow>(
      `SELECT id, item_id, content, file_id, losing_device, hlc_physical, hlc_counter, created_at
       FROM conflicted_copies
       WHERE item_id = ?
       ORDER BY created_at DESC`,
      [itemId],
    );
    return rows.map(rowToConflictedCopy);
  }

  async resolveConflict(
    itemId: string,
    winningCopyId: string,
    keepBoth: boolean,
  ): Promise<void> {
    const copies = await this.getConflictedCopies(itemId);
    const winner = copies.find((c) => c.id === winningCopyId);
    if (!winner) {
      throw new Error(`Conflicted copy not found: ${winningCopyId}`);
    }

    if (keepBoth) {
      await this.createItem({
        type: (await this.getItem(itemId))?.type ?? "text",
        title: `(conflicted) ${winner.id}`,
        content: winner.content,
        fileId: winner.fileId,
      });
      await this.#db.exec(
        `DELETE FROM conflicted_copies WHERE id = ?`,
        [winningCopyId],
      );
      return;
    }

    await this.#db.exec("BEGIN IMMEDIATE");
    try {
      await this.#db.exec(
        `UPDATE items SET content = ?, file_id = ? WHERE id = ?`,
        [winner.content, winner.fileId, itemId],
      );
      await this.#db.exec(
        `DELETE FROM conflicted_copies WHERE item_id = ?`,
        [itemId],
      );
      await this.#db.exec("COMMIT");
    } catch (error) {
      await this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  async applyRemoteEvents(events: SyncEvent[]): Promise<ApplyResult> {
    let applied = 0;
    let conflicted = 0;
    let skipped = 0;

    // Sort by HLC for deterministic application order
    const sorted = [...events].sort((a, b) => hlcCompare(a.hlc, b.hlc));

    for (const event of sorted) {
      const result = await this.#applySingleEvent(event);
      if (result === "applied") applied++;
      else if (result === "conflicted") conflicted++;
      else skipped++;
    }

    return { applied, conflicted, skipped };
  }

  async getEventsSince(cursor: HLC | null): Promise<SyncEvent[]> {
    return this.#eventLog.getEventsSince(cursor);
  }

  async getSyncCursor(peerDeviceId: string): Promise<HLC | null> {
    return this.#eventLog.getSyncCursor(peerDeviceId);
  }

  async setSyncCursor(peerDeviceId: string, hlc: HLC): Promise<void> {
    await this.#eventLog.setSyncCursor(peerDeviceId, hlc);
  }

  async gcTombstones(): Promise<number> {
    return this.#tombstones.runSweep();
  }

  #nextHlc(): HLC {
    this.#lastHlc = hlcNow(this.#deviceId, this.#lastHlc);
    return this.#lastHlc;
  }

  async #findItem(id: string): Promise<Item | null> {
    const rows = await this.#db.query<ItemRow>(
      `SELECT id, type, title, content, file_id, created_at, updated_at, created_by, version_vector, deleted
       FROM items WHERE id = ?`,
      [id],
    );
    const row = rows[0];
    return row ? rowToItem(row) : null;
  }

  async #upsertItem(item: Item): Promise<void> {
    await this.#db.exec(
      `INSERT OR REPLACE INTO items (
        id, type, title, content, file_id, created_at, updated_at, created_by, version_vector, deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.type,
        item.title,
        item.content,
        item.fileId,
        item.createdAt,
        item.updatedAt,
        item.createdBy,
        JSON.stringify(item.versionVector),
        item.deleted ? 1 : 0,
      ],
    );
  }

  async #applySingleEvent(
    event: SyncEvent,
  ): Promise<"applied" | "conflicted" | "skipped"> {
    const existing = await this.#findItem(event.itemId);
    const remoteVv = event.itemVersionVector;

    if (event.eventType !== "delete") {
      const exists = await this.#tombstones.exists(event.itemId);
      if (exists) return "skipped";
    }

    if (existing) {
      const classification = classifyConflict(
        existing.versionVector,
        remoteVv,
      );

      switch (classification) {
        case "LOCAL_NEWER":
          return "skipped";
        case "IDENTICAL":
          return "skipped";
        case "CONCURRENT":
          return this.#handleConcurrent(event, existing, remoteVv);
        case "REMOTE_NEWER":
          break;
      }
    }

    await this.#db.exec("BEGIN IMMEDIATE");
    try {
      await this.#saveEvent(event);

      switch (event.eventType) {
        case "create": {
          const payload = (event.payload ?? {}) as Record<string, unknown>;
          const item: Item = {
            id: event.itemId,
            type: (payload.type as ItemType) ?? "text",
            title: (payload.title as string) ?? "",
            content: (payload.content as string | null) ?? null,
            fileId: (payload.fileId as string | null) ?? null,
            createdAt: event.createdAt,
            updatedAt: event.createdAt,
            createdBy: event.deviceId,
            versionVector: remoteVv,
            deleted: false,
          };
          await this.#upsertItem(item);
          break;
        }
        case "update": {
          if (existing) {
            const payload = (event.payload ?? {}) as Record<
              string,
              unknown
            >;
            const item: Item = {
              ...existing,
              ...(payload as Partial<Item>),
              updatedAt: event.createdAt,
              versionVector: mergeVersionVectors(
                existing.versionVector,
                remoteVv,
              ),
            };
            await this.#upsertItem(item);
          }
          break;
        }
        case "delete": {
          if (existing) {
            await this.#db.exec(
              `UPDATE items SET deleted = 1, updated_at = ? WHERE id = ?`,
              [event.createdAt, event.itemId],
            );
          }
          await this.#tombstones.create(event.itemId, event.hlc, event.deviceId, event.createdAt);
          break;
        }
        case "rename": {
          if (existing) {
            const payload = (event.payload ?? {}) as {
              title?: string;
            };
            await this.#db.exec(
              `UPDATE items SET title = ?, updated_at = ?, version_vector = ? WHERE id = ?`,
              [
                payload.title ?? existing.title,
                event.createdAt,
                JSON.stringify(
                  mergeVersionVectors(existing.versionVector, remoteVv),
                ),
                event.itemId,
              ],
            );
          }
          break;
        }
      }

      await this.#db.exec("COMMIT");
      return "applied";
    } catch (error) {
      await this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  async #handleConcurrent(
    event: SyncEvent,
    local: Item,
    remoteVv: VersionVector,
  ): Promise<"conflicted"> {
    await this.#db.exec("BEGIN IMMEDIATE");
    try {
      await this.#saveEvent(event);

      await this.#db.exec(
        `INSERT INTO conflicted_copies (id, item_id, content, losing_device, hlc_physical, hlc_counter, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          event.itemId,
          local.content,
          local.createdBy,
          event.hlc.physical,
          event.hlc.counter,
          Date.now(),
        ],
      );

      const mergedVv = mergeVersionVectors(local.versionVector, remoteVv);
      const payload = (event.payload ?? {}) as Record<string, unknown>;

      const updatedItem: Item = {
        ...local,
        ...(payload as Partial<Item>),
        updatedAt: event.createdAt,
        versionVector: mergedVv,
      };
      await this.#upsertItem(updatedItem);

      await this.#db.exec("COMMIT");
      return "conflicted";
    } catch (error) {
      await this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  async #saveEvent(event: SyncEvent): Promise<void> {
    const alreadyExists = await this.#eventLog.exists(event.id);
    if (alreadyExists) return;

    await this.#eventLog.append(
      event.itemId,
      event.eventType,
      event.payload,
      event.itemVersionVector,
      event.hlc,
      event.deviceId,
      event.createdAt,
    );
  }
}

let idCounter = 0;

function generateId(): string {
  idCounter++;
  const entropy = Date.now().toString(36) + idCounter.toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${entropy}_${random}`;
}

function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    fileId: row.file_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    versionVector: JSON.parse(row.version_vector) as VersionVector,
    deleted: row.deleted === 1,
  };
}

function rowToConflictedCopy(row: ConflictRow): ConflictedCopy {
  return {
    id: row.id,
    itemId: row.item_id,
    content: row.content,
    fileId: row.file_id,
    losingDevice: row.losing_device,
    hlc: {
      physical: row.hlc_physical,
      counter: row.hlc_counter,
      deviceId: row.losing_device,
    },
    createdAt: row.created_at,
  };
}
