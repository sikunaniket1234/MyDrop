import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir, hostname } from "node:os";

export interface TlsCredentials {
  readonly key: string;
  readonly cert: string;
}

const CERT_DIR = join(homedir(), ".mydrop", "tls");
const KEY_PATH = join(CERT_DIR, "server.key");
const CERT_PATH = join(CERT_DIR, "server.crt");

export function hasTlsCredentials(): boolean {
  return existsSync(KEY_PATH) && existsSync(CERT_PATH);
}

export async function readTlsCredentials(): Promise<TlsCredentials> {
  return {
    key: await readFile(KEY_PATH, "utf8"),
    cert: await readFile(CERT_PATH, "utf8"),
  };
}

function findOpenssl(): string {
  const common = [
    "C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe",
    "C:\\Program Files (x86)\\OpenSSL\\bin\\openssl.exe",
    "C:\\Program Files\\OpenSSL\\bin\\openssl.exe",
  ];
  for (const p of common) {
    if (existsSync(p)) return p;
  }
  return "openssl";
}

export async function tryGenerateSelfSignedCert(): Promise<boolean> {
  if (hasTlsCredentials()) return true;

  await mkdir(CERT_DIR, { recursive: true });

  const openssl = findOpenssl();
  const result = spawnSync(openssl, [
    "req",
    "-x509",
    "-newkey", "rsa:2048",
    "-keyout", KEY_PATH,
    "-out", CERT_PATH,
    "-days", "3650",
    "-nodes",
    "-subj", `/CN=${hostname()}/O=MyDrop`,
  ], { stdio: "ignore" });

  if (result.status !== 0) {
    return false;
  }

  return existsSync(KEY_PATH) && existsSync(CERT_PATH);
}
