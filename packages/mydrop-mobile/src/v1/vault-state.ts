import RNFS from "react-native-fs";

const STATE_FILE = `${RNFS.DocumentDirectoryPath}/.mydrop-vault.json`;

export type VaultMode = "auto" | "passphrase";

export interface VaultState {
  readonly mode: VaultMode;
  readonly passphraseSalt: string | null;
  readonly vaultKeyHex: string | null;
}

const DEFAULT_STATE: VaultState = {
  mode: "auto",
  passphraseSalt: null,
  vaultKeyHex: null,
};

export async function readVaultState(): Promise<VaultState> {
  try {
    const exists = await RNFS.exists(STATE_FILE);
    if (!exists) return DEFAULT_STATE;

    const content = await RNFS.readFile(STATE_FILE, "utf8");
    return JSON.parse(content) as VaultState;
  } catch {
    return DEFAULT_STATE;
  }
}

export async function writeVaultState(state: VaultState): Promise<void> {
  await RNFS.writeFile(STATE_FILE, JSON.stringify(state), "utf8");
}

export async function clearVaultState(): Promise<void> {
  try {
    await RNFS.unlink(STATE_FILE);
  } catch {
    // ignore
  }
}
