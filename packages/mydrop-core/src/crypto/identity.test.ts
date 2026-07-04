import { describe, expect, it } from "vitest";
import {
  generateIdentityKeypair,
  sign,
  verify,
  publicKeyToBase64,
  secretKeyToBase64,
  base64ToPublicKey,
  base64ToSecretKey,
} from "../crypto/identity.js";
import {
  generatePairingToken,
  verifyPairingToken,
  createQrPayload,
  parseQrPayload,
  generateDeviceId,
} from "../crypto/pairing.js";

describe("identity", () => {
  it("generates valid keypair", () => {
    const kp = generateIdentityKeypair();
    expect(kp.publicKey.length).toBe(32);
    expect(kp.secretKey.length).toBeGreaterThanOrEqual(32);
  });

  it("signs and verifies", () => {
    const kp = generateIdentityKeypair();
    const data = new TextEncoder().encode("hello world");
    const sig = sign(data, kp.secretKey);
    expect(verify(data, sig, kp.publicKey)).toBe(true);
  });

  it("rejects wrong key", () => {
    const kp1 = generateIdentityKeypair();
    const kp2 = generateIdentityKeypair();
    const data = new TextEncoder().encode("hello world");
    const sig = sign(data, kp1.secretKey);
    expect(verify(data, sig, kp2.publicKey)).toBe(false);
  });

  it("rejects corrupted data", () => {
    const kp = generateIdentityKeypair();
    const data = new TextEncoder().encode("hello world");
    const sig = sign(data, kp.secretKey);
    const bad = new TextEncoder().encode("hello worlx");
    expect(verify(bad, sig, kp.publicKey)).toBe(false);
  });

  it("roundtrips base64 keys", () => {
    const kp = generateIdentityKeypair();
    const pubB64 = publicKeyToBase64(kp.publicKey);
    expect(base64ToPublicKey(pubB64).slice(0, kp.publicKey.length)).toEqual(kp.publicKey);
    // secretKey may be 32 bytes; secretKeyToBase64 pads to 64
    const secB64 = secretKeyToBase64(kp.secretKey);
    const decoded = base64ToSecretKey(secB64);
    expect(decoded.slice(0, kp.secretKey.length)).toEqual(kp.secretKey);
  });
});

describe("pairing", () => {
  it("generates 6-digit token", () => {
    const token = generatePairingToken();
    expect(token.length).toBe(6);
    expect(/^\d{6}$/.test(token)).toBe(true);
  });

  it("verifies matching tokens", () => {
    expect(verifyPairingToken("123456", "123456")).toBe(true);
  });

  it("rejects non-matching tokens", () => {
    expect(verifyPairingToken("123456", "654321")).toBe(false);
  });

  it("creates and parses QR payload", () => {
    const payload = createQrPayload("dev1", "My Phone", "abc123", "000100", "192.168.1.5:4317");
    const json = JSON.stringify(payload);
    const parsed = parseQrPayload(json);
    expect(parsed).toEqual(payload);
    expect(parsed.v).toBe(1);
    expect(parsed.d).toBe("dev1");
    expect(parsed.n).toBe("My Phone");
    expect(parsed.p).toBe("abc123");
    expect(parsed.c).toBe("000100");
    expect(parsed.a).toBe("192.168.1.5:4317");
  });

  it("generates unique device IDs", () => {
    const id1 = generateDeviceId();
    const id2 = generateDeviceId();
    expect(id1).toMatch(/^dev_/);
    expect(id1).not.toBe(id2);
  });
});
