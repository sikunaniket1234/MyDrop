import { x25519 } from "@noble/curves/ed25519.js";
import type { VaultKey } from "../sync/vault.js";

const PAIRING_TOKEN_LENGTH = 6;
const QR_VERSION = 1;

export interface QrPayload {
  readonly v: number;
  readonly d: string;
  readonly n: string;
  readonly p: string;
  readonly c: string;
  readonly a: string;
}

export interface PairingSession {
  readonly sharedSecret: Uint8Array;
  readonly encryptionKey: CryptoKey;
}

export function generatePairingToken(): string {
  const buf = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  const num = (buf[0]! * 16777216 + buf[1]! * 65536 + buf[2]! * 256 + buf[3]!) % 1000000;
  return num.toString().padStart(PAIRING_TOKEN_LENGTH, "0");
}

export function verifyPairingToken(input: string, expected: string): boolean {
  return input === expected;
}

export function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function deriveX25519SharedSecret(
  theirPublicKey: Uint8Array,
  mySecretKey: Uint8Array,
): Uint8Array {
  return x25519.getSharedSecret(mySecretKey, theirPublicKey);
}

export async function deriveSessionKey(
  sharedSecret: Uint8Array,
): Promise<CryptoKey> {
  const buf = new Uint8Array(sharedSecret);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    buf,
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      salt: new ArrayBuffer(0),
      info: new TextEncoder().encode("mydrop-pairing-session"),
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVaultKey(
  vaultKey: VaultKey,
  sessionKey: CryptoKey,
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const plaintext = new Uint8Array(vaultKey.key.length + vaultKey.salt.length);
  plaintext.set(vaultKey.key, 0);
  plaintext.set(vaultKey.salt, vaultKey.key.length);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    sessionKey,
    plaintext,
  );
  return { iv, ciphertext: new Uint8Array(encrypted) };
}

export async function decryptVaultKey(
  iv: Uint8Array,
  ciphertext: Uint8Array,
  sessionKey: CryptoKey,
): Promise<VaultKey> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    sessionKey,
    new Uint8Array(ciphertext),
  );
  const bytes = new Uint8Array(decrypted);
  const keyHalf = bytes.length / 2;
  return {
    key: bytes.slice(0, keyHalf),
    salt: bytes.slice(keyHalf),
  };
}

export function createQrPayload(
  deviceId: string,
  deviceName: string,
  publicKeyBase64: string,
  pairingToken: string,
  bootstrapAddr: string,
): QrPayload {
  return {
    v: QR_VERSION,
    d: deviceId,
    n: deviceName,
    p: publicKeyBase64,
    c: pairingToken,
    a: bootstrapAddr,
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
