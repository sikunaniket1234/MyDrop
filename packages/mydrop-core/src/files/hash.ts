import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";

export type HashFunction = (data: Uint8Array) => Promise<string>;

export function sha256(data: Uint8Array): Promise<string> {
  const hash = nobleSha256(data);
  return Promise.resolve(bytesToHex(hash));
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
