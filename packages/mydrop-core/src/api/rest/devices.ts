import type { DatabaseClient } from "../../db/client.js";
import type { ApiResult } from "./types.js";
import { ok, toDeviceHealthResponse } from "./types.js";
import { generateDeviceId, generatePairingToken } from "../../crypto/pairing.js";
import { generateIdentityKeypair, publicKeyToBase64, secretKeyToBase64 } from "../../crypto/identity.js";

export interface PairingInitResult {
  deviceId: string;
  pairingCode: string;
  qrPayload: string;
  publicKey: string;
  secretKey: string;
}

export interface DeviceHandlers {
  list(): Promise<ApiResult<{ devices: ReturnType<typeof toDeviceHealthResponse>[] }>>;
  initiatePairing(body: { deviceName: string }): Promise<ApiResult<PairingInitResult>>;
  confirmPairing(deviceId: string, body: { pairingCode: string; deviceName: string }): Promise<ApiResult<{ trusted: boolean }>>;
  revoke(deviceId: string): Promise<ApiResult<{ revoked: boolean; newVaultKeyEpoch: number }>>;
}

export function createDeviceHandlers(db: DatabaseClient): DeviceHandlers {
  async function list(): Promise<ApiResult<{ devices: ReturnType<typeof toDeviceHealthResponse>[] }>> {
    const rows = await db.query<{
      id: string; name: string; status: string;
      app_version: string | null; protocol_version: number;
      last_seen: number | null; storage_used_bytes: number;
    }>(`SELECT id, name, status, app_version, protocol_version, last_seen, storage_used_bytes
       FROM devices ORDER BY trusted_at ASC`);

    const devices = rows.map(r => toDeviceHealthResponse({
      id: r.id, name: r.name, status: r.status as "pending" | "trusted" | "revoked",
      appVersion: r.app_version, protocolVersion: r.protocol_version,
      lastSeen: r.last_seen, storageUsedBytes: r.storage_used_bytes,
      publicKey: "", trustedAt: null,
    }, 0));

    return ok({ devices });
  }

  async function initiatePairing(body: { deviceName: string }): Promise<ApiResult<PairingInitResult>> {
    const deviceId = generateDeviceId();
    const pairingCode = generatePairingToken();
    const keypair = generateIdentityKeypair();
    const publicKey = publicKeyToBase64(keypair.publicKey);
    const secretKey = secretKeyToBase64(keypair.secretKey);

    await Promise.resolve();

    const qrPayload = JSON.stringify({
      v: 1,
      d: deviceId,
      n: body.deviceName,
      p: publicKey,
      c: pairingCode,
    });

    return ok({ deviceId, pairingCode, qrPayload, publicKey, secretKey });
  }

  async function confirmPairing(deviceId: string, body: { pairingCode: string; deviceName: string }): Promise<ApiResult<{ trusted: boolean }>> {
    await db.exec(
      `INSERT OR REPLACE INTO devices (id, name, public_key, protocol_version, trusted_at, status)
       VALUES (?, ?, '', 1, ?, 'trusted')`,
      [deviceId, body.deviceName, Date.now()],
    );
    return ok({ trusted: true });
  }

  async function revoke(id: string): Promise<ApiResult<{ revoked: boolean; newVaultKeyEpoch: number }>> {
    const result = await db.exec(
      `UPDATE devices SET status = 'revoked' WHERE id = ? AND status = 'trusted'`,
      [id],
    );
    if (result.rowsAffected === 0) {
      return { status: 404, error: { code: "NOT_FOUND", message: "Device not found or not trusted" } };
    }
    return ok({ revoked: true, newVaultKeyEpoch: Date.now() });
  }

  return { list, initiatePairing, confirmPairing, revoke };
}
