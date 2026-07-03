import type { DatabaseClient } from "../../db/client.js";
import type { ApiResult } from "./types.js";
import { ok, toDeviceHealthResponse } from "./types.js";

export interface HealthHandlers {
  getHealth(): Promise<ApiResult<{ devices: ReturnType<typeof toDeviceHealthResponse>[]; localStorageBytes: number }>>;
}

export function createHealthHandlers(db: DatabaseClient): HealthHandlers {
  async function getHealth(): Promise<ApiResult<{ devices: ReturnType<typeof toDeviceHealthResponse>[]; localStorageBytes: number }>> {
    const rows = await db.query<{
      id: string; name: string; status: string;
      app_version: string | null; protocol_version: number;
      last_seen: number | null; storage_used_bytes: number;
    }>(`SELECT id, name, status, app_version, protocol_version, last_seen, storage_used_bytes
       FROM devices`);

    const devices = rows.map(r => toDeviceHealthResponse({
      id: r.id, name: r.name, status: r.status as "pending" | "trusted" | "revoked",
      appVersion: r.app_version, protocolVersion: r.protocol_version,
      lastSeen: r.last_seen, storageUsedBytes: r.storage_used_bytes,
      publicKey: "", trustedAt: null,
    }, 0));

    const totalBytes = rows.reduce((sum, r) => sum + (r.storage_used_bytes ?? 0), 0);

    return ok({ devices, localStorageBytes: totalBytes });
  }

  return { getHealth };
}
