import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";

const VAULT_KEY_BYTES = 32;
const SALT_BYTES = 16;
const PBKDF2_ITERATIONS = 100_000;

export interface VaultKey {
  readonly key: Uint8Array;
  readonly salt: Uint8Array;
}

export function generateVaultKey(): VaultKey {
  const key = randomBytes(VAULT_KEY_BYTES);
  const salt = randomBytes(SALT_BYTES);
  return { key, salt };
}

export async function deriveVaultKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<VaultKey> {
  const derived = pbkdf2(sha256, passphrase, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: VAULT_KEY_BYTES,
  });
  return { key: derived, salt };
}

export async function deriveDbKey(
  vaultKey: VaultKey,
  purpose: string,
): Promise<Uint8Array> {
  const info = new TextEncoder().encode(`mydrop-${purpose}`);
  return hkdf(sha256, vaultKey.key, vaultKey.salt, info, VAULT_KEY_BYTES);
}

export function vaultKeyToHex(key: VaultKey): string {
  return `${bytesToHex(key.key)}:${bytesToHex(key.salt)}`;
}

export function vaultKeyFromHex(encoded: string): VaultKey {
  const parts = encoded.split(":");
  if (parts.length !== 2) throw new Error("Invalid vault key format");
  return {
    key: hexToBytes(parts[0]!),
    salt: hexToBytes(parts[1]!),
  };
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function vaultKeyToDbEncryptionKeyHex(vaultKeyHex: string): string {
  const vk = vaultKeyFromHex(vaultKeyHex);
  const rawKey = vk.key;
  return Array.from(rawKey).map(b => b.toString(16).padStart(2, "0")).join("");
}
