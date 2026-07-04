import type { DatabaseClient } from "@mydrop/core";
import { generatePairingToken } from "@mydrop/core";

interface PendingPairing {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly pairingCode: string;
  readonly expiresAt: number;
}

export class PairingHandler {
  readonly #db: DatabaseClient;
  readonly #pending = new Map<string, PendingPairing>();
  readonly #pairingTtl = 5 * 60 * 1000;

  public constructor(db: DatabaseClient) {
    this.#db = db;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- returns synchronously, interface requires Promise
  async initiatePairing(
    deviceId: string,
    deviceName: string,
  ): Promise<{ pairingCode: string }> {
    const pairingCode = generatePairingToken();
    this.#pending.set(deviceId, {
      deviceId,
      deviceName,
      pairingCode,
      expiresAt: Date.now() + this.#pairingTtl,
    });
    return { pairingCode };
  }

  async confirmPairing(
    deviceId: string,
    pairingCode: string,
    deviceName: string,
  ): Promise<boolean> {
    const pending = this.#pending.get(deviceId);
    if (!pending) return false;
    if (Date.now() > pending.expiresAt) {
      this.#pending.delete(deviceId);
      return false;
    }
    if (pending.pairingCode !== pairingCode) return false;

    await this.#db.exec(
      `INSERT OR REPLACE INTO devices (id, name, public_key, protocol_version, trusted_at, status)
       VALUES (?, ?, '', 1, ?, 'trusted')`,
      [deviceId, deviceName, Date.now()],
    );

    this.#pending.delete(deviceId);
    return true;
  }

  async listDevices(): Promise<
    Array<{
      id: string;
      name: string;
      status: string;
      trustedAt: number | null;
      lastSeen: number | null;
    }>
  > {
    const rows = await this.#db.query<{
      id: string;
      name: string;
      status: string;
      trusted_at: number | null;
      last_seen: number | null;
    }>(`SELECT id, name, status, trusted_at, last_seen FROM devices ORDER BY trusted_at ASC`);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      trustedAt: r.trusted_at,
      lastSeen: r.last_seen,
    }));
  }

  async revokeDevice(deviceId: string): Promise<boolean> {
    const result = await this.#db.exec(
      `UPDATE devices SET status = 'revoked' WHERE id = ? AND status = 'trusted'`,
      [deviceId],
    );
    return result.rowsAffected > 0;
  }
}
