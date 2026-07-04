import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "./theme.js";

interface Props {
  apiBase: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function PairingScreen({
  apiBase,
  onComplete,
  onCancel,
}: Props): React.ReactElement {
  const [step, setStep] = useState<"init" | "confirm" | "success">("init");
  const [pairingCode, setPairingCode] = useState("");
  const [deviceName, setDeviceName] = useState("Phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(300);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step === "init") {
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [step]);

  function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function handlePairWithCode(): Promise<void> {
    const code = pairingCode.trim();
    if (code.length !== 6) {
      setError("Pairing code must be 6 digits");
      return;
    }
    setLoading(true);
    setError(null);
    const url = `${apiBase}/v1/pairing/confirm`;
    console.warn("[DEBUG] PairingScreen: POST " + url);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: `mobile_${Date.now().toString(36)}`,
          pairingCode: code,
          deviceName: deviceName || "Phone",
        }),
      });
      console.warn("[DEBUG] PairingScreen: status=" + res.status);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Pairing failed");
      }
      setStep("success");
    } catch (err: unknown) {
      console.warn("[DEBUG] PairingScreen FAILED: " + (err instanceof Error ? err.message : String(err)));
      setError(err instanceof Error ? err.message : "Pairing failed");
    } finally {
      setLoading(false);
    }
  }

  function renderStep(): React.ReactElement {
    switch (step) {
      case "init":
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Pair with Desktop</Text>
            <Text style={styles.stepSubtitle}>
              Enter the 6-digit pairing code shown on your desktop
            </Text>

            <TextInput
              value={deviceName}
              onChangeText={setDeviceName}
              style={styles.input}
              placeholder="Device name"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
            />

            <TextInput
              value={pairingCode}
              onChangeText={text => {
                const cleaned = text.replace(/[^0-9]/g, "").slice(0, 6);
                setPairingCode(cleaned);
                setError(null);
              }}
              style={[styles.input, styles.codeInput]}
              placeholder="000000"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {countdown > 0 ? (
              <Text style={styles.expiry}>
                Code expires in {formatCountdown(countdown)}
              </Text>
            ) : (
              <Text style={[styles.expiry, styles.expiryExpired]}>
                Code expired — get a new one from desktop
              </Text>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={() => void handlePairWithCode()}
              disabled={loading || pairingCode.length !== 6}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? "Pairing..." : "Pair Device"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case "success":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.successCircle}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.stepTitle}>Device paired</Text>
            <Text style={styles.stepSubtitle}>
              Your devices are now connected and will sync automatically
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onComplete}
            >
              <Text style={styles.primaryBtnText}>Go to Devices</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return <View />;
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.surface0} />
      <View style={styles.progressDots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View
          style={[styles.dot, step === "success" && styles.dotDone]}
        />
      </View>
      {renderStep()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface0,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  progressDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 22,
  },
  dot: {
    height: 5,
    borderRadius: 3,
    width: 6,
    backgroundColor: theme.borderStrong,
  },
  dotDone: {
    backgroundColor: theme.fillSuccess,
  },
  dotActive: {
    width: 20,
    backgroundColor: theme.fillAccent,
  },
  stepContainer: {
    alignItems: "center",
    width: "100%",
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  stepSubtitle: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 18,
  },
  input: {
    width: "100%",
    borderWidth: 0.5,
    borderColor: theme.borderStrong,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: theme.textPrimary,
    backgroundColor: theme.surface1,
    marginBottom: 10,
  },
  codeInput: {
    fontSize: 24,
    fontFamily: "monospace",
    textAlign: "center",
    letterSpacing: 8,
    height: 56,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 12,
    color: theme.textDanger,
    marginBottom: 8,
  },
  expiry: {
    fontSize: 11,
    color: theme.textMuted,
    marginBottom: 18,
  },
  expiryExpired: {
    color: theme.textWarning,
  },
  primaryBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.fillAccent,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.onAccent,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  successCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.bgSuccess,
    borderWidth: 0.5,
    borderColor: theme.borderSuccess,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successIcon: {
    fontSize: 24,
    color: theme.textSuccess,
  },
});
