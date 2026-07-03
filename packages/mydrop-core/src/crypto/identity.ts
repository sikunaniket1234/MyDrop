import { ed25519 } from "@noble/curves/ed25519.js";

export interface IdentityKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

const PUBLIC_KEY_BYTES = 32;
const SECRET_KEY_BYTES = 64;

export function generateIdentityKeypair(): IdentityKeypair {
  const secretKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(secretKey);
  return { publicKey, secretKey };
}

export function sign(
  data: Uint8Array,
  secretKey: Uint8Array,
): Uint8Array {
  return ed25519.sign(data, secretKey);
}

export function verify(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  return ed25519.verify(signature, data, publicKey);
}

export function publicKeyToBase64(key: Uint8Array): string {
  const bytes = new Uint8Array(PUBLIC_KEY_BYTES);
  bytes.set(key);
  return btoa(String.fromCharCode(...bytes));
}

export function secretKeyToBase64(key: Uint8Array): string {
  const bytes = new Uint8Array(SECRET_KEY_BYTES);
  bytes.set(key);
  return btoa(String.fromCharCode(...bytes));
}

export function base64ToPublicKey(s: string): Uint8Array {
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function base64ToSecretKey(s: string): Uint8Array {
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
