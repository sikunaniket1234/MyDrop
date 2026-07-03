import React, { useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  deriveVaultKeyFromPassphrase,
  generateVaultKey,
  vaultKeyToHex,
  bytesToHex,
} from "@mydrop/core";
import { readVaultState, writeVaultState, type VaultMode } from "./vault-state.js";

export interface VaultScreenResult {
  vaultMode: VaultMode;
  passphrase: string;
}

interface Props {
  onUnlock: (result: VaultScreenResult) => void;
  onSkip: () => void;
}

export function VaultScreen({ onUnlock, onSkip }: Props): React.ReactElement {
  const [mode, setMode] = useState<VaultMode | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function checkState(): Promise<"setup" | "unlock" | "unlocked"> {
    const state = await readVaultState();
    if (state.mode === "passphrase") return "unlock";
    if (state.mode === "auto" && state.vaultKeyHex) return "unlocked";
    return "setup";
  }

  async function handleSetPassphrase(): Promise<void> {
    setError(null);
    if (passphrase.length < 4) {
      setError("Passphrase must be at least 4 characters");
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError("Passphrases do not match");
      return;
    }

    setBusy(true);
    try {
      const saltBytes = new Uint8Array(16);
      crypto.getRandomValues(saltBytes);
      await deriveVaultKeyFromPassphrase(passphrase, saltBytes);

      await writeVaultState({
        mode: "passphrase",
        passphraseSalt: bytesToHex(saltBytes),
        vaultKeyHex: null,
      });

      onUnlock({ vaultMode: "passphrase", passphrase });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to set passphrase");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(): Promise<void> {
    setError(null);
    if (!passphrase) {
      setError("Enter your passphrase");
      return;
    }

    setBusy(true);
    try {
      const state = await readVaultState();
      if (state.mode !== "passphrase" || !state.passphraseSalt) {
        setError("Vault not configured for passphrase");
        setBusy(false);
        return;
      }
      onUnlock({ vaultMode: "passphrase", passphrase });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to unlock");
    } finally {
      setBusy(false);
    }
  }

  async function handleAuto(): Promise<void> {
    setBusy(true);
    try {
      const vaultKey = generateVaultKey();
      const vaultKeyHex = vaultKeyToHex(vaultKey);
      await writeVaultState({ mode: "auto", passphraseSalt: null, vaultKeyHex });
      onUnlock({ vaultMode: "auto", passphrase: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initialize");
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    void checkState().then(s => {
      if (s === "setup") setMode(null);
      else if (s === "unlock") setMode("passphrase");
      else void handleAuto();
    });
  }, []);

  if (busy) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.center}>
          <Text style={styles.loading}>Initializing vault...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === "passphrase") {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.card}>
          <Text style={styles.title}>Unlock Vault</Text>
          <Text style={styles.subtitle}>Enter your passphrase to unlock your vault</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TextInput
            value={passphrase}
            onChangeText={setPassphrase}
            style={styles.input}
            placeholder="Passphrase"
            secureTextEntry
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleUnlock()}>
            <Text style={styles.primaryButtonText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.card}>
        <Text style={styles.title}>Secure Your Vault</Text>
        <Text style={styles.subtitle}>Choose how to protect your data</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Set a passphrase</Text>
        <TextInput
          value={passphrase}
          onChangeText={setPassphrase}
          style={styles.input}
          placeholder="Passphrase (min 4 characters)"
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          value={confirmPassphrase}
          onChangeText={setConfirmPassphrase}
          style={styles.input}
          placeholder="Confirm passphrase"
          secureTextEntry
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSetPassphrase()}>
          <Text style={styles.primaryButtonText}>Set Passphrase</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleAuto()}>
          <Text style={styles.secondaryButtonText}>Use Auto-Generated Key (No Passphrase)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={onSkip}>
          <Text style={styles.linkText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: "#f5f7fb",
    flex: 1,
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  loading: {
    color: "#64748b",
    fontSize: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    gap: 12,
    margin: 16,
    padding: 24,
  },
  title: {
    color: "#172033",
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    marginBottom: 8,
  },
  label: {
    color: "#334155",
    fontWeight: "700",
  },
  input: {
    borderColor: "#cbd5e1",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#275efe",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#172033",
    fontWeight: "800",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  linkText: {
    color: "#275efe",
    fontWeight: "600",
  },
  divider: {
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    marginVertical: 4,
  },
});
