export interface PairingRequest {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly pairingCode: string;
  readonly publicKey: string | null;
}

export interface PairingConfirmation {
  readonly deviceId: string;
  readonly pairingCode: string;
  readonly confirmed: boolean;
}

export interface QrPayload {
  readonly v: number;
  readonly d: string;
  readonly n: string;
  readonly c: string;
  readonly a: string;
}

export function createQrPayload(
  deviceId: string,
  deviceName: string,
  pairingCode: string,
  address: string,
): QrPayload {
  return {
    v: 1,
    d: deviceId,
    n: deviceName,
    c: pairingCode,
    a: address,
  };
}

export function parseQrPayload(raw: string): QrPayload {
  return JSON.parse(raw) as QrPayload;
}

export function generateDeviceId(): string {
  const entropy = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `dev_${entropy}_${random}`;
}
