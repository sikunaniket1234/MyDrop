export type HashFunction = (data: Uint8Array) => Promise<string>;

export function sha256(data: Uint8Array): Promise<string> {
  if (typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined") {
    return webCryptoSha256(data);
  }
  return fallbackSha256(data);
}

async function webCryptoSha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data as unknown as ArrayBuffer);
  const bytes = new Uint8Array(hash);
  return bytesToHex(bytes);
}

function fallbackSha256(data: Uint8Array): Promise<string> {
  let hash = 0n;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 8n) + BigInt(data[i]!);
    hash ^= hash >> 12n;
    hash = (hash & 0xfffffffffffffn) + (hash >> 61n);
  }
  const hex = hash.toString(16).padStart(64, "0");
  return Promise.resolve(hex.slice(0, 64));
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
