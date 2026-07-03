export function generatePairingCode(): string {
  const buf = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  const num = (buf[0]! * 16777216 + buf[1]! * 65536 + buf[2]! * 256 + buf[3]!) % 1000000;
  return num.toString().padStart(6, "0");
}

export function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
