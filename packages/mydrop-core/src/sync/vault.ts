const VAULT_KEY_BYTES = 32;
const SALT_BYTES = 16;
const PBKDF2_ITERATIONS = 100_000;

export interface VaultKey {
  readonly key: Uint8Array;
  readonly salt: Uint8Array;
}

export function generateVaultKey(): VaultKey {
  const key = new Uint8Array(VAULT_KEY_BYTES);
  const salt = new Uint8Array(SALT_BYTES);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(key);
    crypto.getRandomValues(salt);
  } else {
    for (let i = 0; i < VAULT_KEY_BYTES; i++) {
      key[i] = Math.floor(Math.random() * 256);
    }
    for (let i = 0; i < SALT_BYTES; i++) {
      salt[i] = Math.floor(Math.random() * 256);
    }
  }
  return { key, salt };
}

export async function deriveVaultKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<VaultKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return { key: new Uint8Array(derived), salt };
}

export async function deriveDbKey(
  vaultKey: VaultKey,
  purpose: string,
): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      vaultKey.key as unknown as ArrayBuffer,
      "HKDF",
      false,
      ["deriveBits"],
    );

    const derived = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        salt: vaultKey.salt as unknown as ArrayBuffer,
        info: encoder.encode(`mydrop-${purpose}`),
        hash: "SHA-256",
      },
      keyMaterial,
      256,
    );

    return new Uint8Array(derived);
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
