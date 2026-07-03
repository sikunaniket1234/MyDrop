import type { DatabaseClient, SqlPrimitive } from "../db/client.js";
import type { HLC, SyncEvent, SyncEventType, VersionVector } from "../sync/types.js";

interface SyncEventRow {
  readonly [key: string]: SqlPrimitive;
  readonly id: string;
  readonly item_id: string;
  readonly event_type: SyncEventType;
  readonly payload: string | null;
  readonly item_version_vector: string;
  readonly hlc_physical: number;
  readonly hlc_counter: number;
  readonly device_id: string;
  readonly created_at: number;
}

export class EventLog {
  readonly #db: DatabaseClient;

  public constructor(db: DatabaseClient) {
    this.#db = db;
  }

  async append(
    itemId: string,
    eventType: SyncEventType,
    payload: Record<string, unknown> | null,
    versionVector: VersionVector,
    hlc: HLC,
    deviceId: string,
    createdAt: number,
  ): Promise<string> {
    const id = generateEventId();
    await this.#db.exec(
      `INSERT INTO sync_events (id, item_id, event_type, payload, item_version_vector, hlc_physical, hlc_counter, device_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        itemId,
        eventType,
        payload ? JSON.stringify(payload) : null,
        JSON.stringify(versionVector),
        hlc.physical,
        hlc.counter,
        deviceId,
        createdAt,
      ],
    );
    return id;
  }

  async getEventsSince(cursor: HLC | null): Promise<SyncEvent[]> {
    if (cursor === null) {
      const rows = await this.#db.query<SyncEventRow>(
        `SELECT id, item_id, event_type, payload, item_version_vector, hlc_physical, hlc_counter, device_id, created_at
         FROM sync_events
         ORDER BY hlc_physical ASC, hlc_counter ASC`,
      );
      return rows.map(rowToSyncEvent);
    }

    const rows = await this.#db.query<SyncEventRow>(
      `SELECT id, item_id, event_type, payload, item_version_vector, hlc_physical, hlc_counter, device_id, created_at
       FROM sync_events
       WHERE (hlc_physical > ?) OR (hlc_physical = ? AND hlc_counter > ?)
       ORDER BY hlc_physical ASC, hlc_counter ASC`,
      [cursor.physical, cursor.physical, cursor.counter],
    );
    return rows.map(rowToSyncEvent);
  }

  async getEventCount(): Promise<number> {
    const rows = await this.#db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_events`,
    );
    return rows[0]?.count ?? 0;
  }

  async exists(eventId: string): Promise<boolean> {
    const rows = await this.#db.query<{ id: string }>(
      `SELECT id FROM sync_events WHERE id = ?`,
      [eventId],
    );
    return rows.length > 0;
  }

  async getSyncCursor(peerDeviceId: string): Promise<HLC | null> {
    const rows = await this.#db.query<{
      readonly [key: string]: SqlPrimitive;
      readonly last_hlc_physical: number | null;
      readonly last_hlc_counter: number | null;
    }>(
      `SELECT last_hlc_physical, last_hlc_counter FROM sync_cursors WHERE peer_device_id = ?`,
      [peerDeviceId],
    );
    const row = rows[0];
    if (!row || row.last_hlc_physical === null) return null;
    return {
      physical: row.last_hlc_physical,
      counter: row.last_hlc_counter ?? 0,
      deviceId: peerDeviceId,
    };
  }

  async setSyncCursor(peerDeviceId: string, hlc: HLC): Promise<void> {
    await this.#db.exec(
      `INSERT OR REPLACE INTO sync_cursors (peer_device_id, last_hlc_physical, last_hlc_counter)
       VALUES (?, ?, ?)`,
      [peerDeviceId, hlc.physical, hlc.counter],
    );
  }

  async getLatestHlc(): Promise<HLC | null> {
    const rows = await this.#db.query<SyncEventRow>(
      `SELECT id, item_id, event_type, payload, item_version_vector, hlc_physical, hlc_counter, device_id, created_at
       FROM sync_events
       ORDER BY hlc_physical DESC, hlc_counter DESC
       LIMIT 1`,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      physical: row.hlc_physical,
      counter: row.hlc_counter,
      deviceId: row.device_id,
    };
  }
}

let eventIdCounter = 0;

function generateEventId(): string {
  eventIdCounter++;
  const entropy = Date.now().toString(36) + eventIdCounter.toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `evt_${entropy}_${random}`;
}

function rowToSyncEvent(row: SyncEventRow): SyncEvent {
  return {
    id: row.id,
    itemId: row.item_id,
    eventType: row.event_type,
    payload: row.payload ? (JSON.parse(row.payload) as Record<string, unknown>) : null,
    itemVersionVector: JSON.parse(row.item_version_vector) as VersionVector,
    hlc: {
      physical: row.hlc_physical,
      counter: row.hlc_counter,
      deviceId: row.device_id,
    },
    deviceId: row.device_id,
    createdAt: row.created_at,
  };
}
