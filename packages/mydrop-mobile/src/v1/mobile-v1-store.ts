import {
  SyncEngine,
  ALL_MIGRATIONS,
  deriveDbKey,
  deriveVaultKeyFromPassphrase,
  generateVaultKey,
  vaultKeyToHex,
  vaultKeyFromHex,
  vaultKeyToDbEncryptionKeyHex,
  bytesToHex,
  hexToBytes,
  type CreateItemInput,
  type DatabaseClient,
  type Item,
} from "@mydrop/core";
import { StaticMigrationSource, migrate } from "@mydrop/core";
import { randomBytes } from "@noble/hashes/utils.js";
import { OpSqliteAdapter } from "../db/op-sqlite-adapter.js";
import { readVaultState, writeVaultState, type VaultMode } from "./vault-state.js";

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface OpenV1MobileStoreResult {
  store: V1MobileStore;
  needsPassphrase: boolean;
  vaultMode: VaultMode;
}

export async function openV1MobileStore(
  passphrase?: string,
): Promise<OpenV1MobileStoreResult> {
  const adapter = new OpSqliteAdapter();
  const state = await readVaultState();

  if (state.mode === "passphrase") {
    if (!passphrase) {
      return { store: undefined as unknown as V1MobileStore, needsPassphrase: true, vaultMode: "passphrase" };
    }

    if (!state.passphraseSalt) throw new Error("Vault state corrupted: missing passphrase salt");
    const salt = hexToBytes(state.passphraseSalt);
    const vaultKey = await deriveVaultKeyFromPassphrase(passphrase, salt);
    const dbKeyHex = vaultKeyToDbEncryptionKeyHex(vaultKeyToHex(vaultKey));

    const client = await adapter.open({
      name: "mydrop-v1.sqlite",
      encryptionKey: dbKeyHex,
    });
    return { store: await initStore(client), needsPassphrase: false, vaultMode: "passphrase" };
  }

  if (state.mode === "auto" && state.vaultKeyHex) {
    const vaultKey = vaultKeyFromHex(state.vaultKeyHex);
    const derived = await deriveDbKey(vaultKey, "db-key");
    const dbKeyHex = Array.from(derived).map(b => b.toString(16).padStart(2, "0")).join("");

    const client = await adapter.open({
      name: "mydrop-v1.sqlite",
      encryptionKey: dbKeyHex,
    });
    return { store: await initStore(client), needsPassphrase: false, vaultMode: "auto" };
  }

  if (state.mode === "auto" && !state.vaultKeyHex && passphrase) {
    const saltBytes = randomBytes(16);
    const vaultKey = await deriveVaultKeyFromPassphrase(passphrase, saltBytes);
    const vaultKeyHex = vaultKeyToHex(vaultKey);
    const dbKeyHex = vaultKeyToDbEncryptionKeyHex(vaultKeyHex);

    await writeVaultState({
      mode: "passphrase",
      passphraseSalt: bytesToHex(saltBytes),
      vaultKeyHex: null,
    });

    const client = await adapter.open({
      name: "mydrop-v1.sqlite",
      encryptionKey: dbKeyHex,
    });
    return { store: await initStore(client), needsPassphrase: false, vaultMode: "passphrase" };
  }

  if (state.mode === "auto" && !state.vaultKeyHex && !passphrase) {
    const vaultKey = generateVaultKey();
    const vaultKeyHex = vaultKeyToHex(vaultKey);
    const derived = await deriveDbKey(vaultKey, "db-key");
    const dbKeyHex = Array.from(derived).map(b => b.toString(16).padStart(2, "0")).join("");

    await writeVaultState({ mode: "auto", passphraseSalt: null, vaultKeyHex });

    const client = await adapter.open({
      name: "mydrop-v1.sqlite",
      encryptionKey: dbKeyHex,
    });
    return { store: await initStore(client), needsPassphrase: false, vaultMode: "auto" };
  }

  throw new Error("Unreachable");
}

async function initStore(client: DatabaseClient): Promise<V1MobileStore> {
  const mobileMigrations = ALL_MIGRATIONS.filter(
    m => !m.filename.includes("0004"),
  );
  await migrate(client, new StaticMigrationSource(mobileMigrations));
  await client.exec(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  let deviceId = await getMeta(client, "device_id");
  if (!deviceId) {
    deviceId = `mobile_${generateId()}`;
    await setMeta(client, "device_id", deviceId);
  }

  const engine = new SyncEngine(client, deviceId);
  return new V1MobileStore(client, engine);
}

async function getMeta(
  client: DatabaseClient,
  key: string,
): Promise<string | null> {
  const rows = await client.query<{ value: string }>(
    `SELECT value FROM _meta WHERE key = ?`,
    [key],
  );
  return rows[0]?.value ?? null;
}

async function setMeta(
  client: DatabaseClient,
  key: string,
  value: string,
): Promise<void> {
  await client.exec(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)`,
    [key, value],
  );
}

export class V1MobileStore {
  constructor(
    private readonly client: DatabaseClient,
    private readonly engine: SyncEngine,
  ) {}

  get syncEngine(): SyncEngine {
    return this.engine;
  }

  async createItem(input: CreateItemInput): Promise<Item> {
    return this.engine.createItem(input);
  }

  async listItems(): Promise<Item[]> {
    return this.engine.listItems();
  }

  async getItem(id: string): Promise<Item | null> {
    return this.engine.getItem(id);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
