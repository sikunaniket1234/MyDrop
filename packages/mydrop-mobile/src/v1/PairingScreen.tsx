import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "./theme.js";

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export function PairingScreen({
  onComplete,
}: Props): React.ReactElement {
  const [step, setStep] = useState(0);

  function renderStep(): React.ReactElement {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Scan to pair a new device</Text>
            <Text style={styles.stepSubtitle}>
              Open MyDrop on the other device and point it at this code
            </Text>
            <View style={styles.qrBox}>
              <Text style={styles.qrPlaceholder}>QR</Text>
            </View>
            <Text style={styles.expiry}>Expires in 4:52</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setStep(1)}
            >
              <Text style={styles.stepBtnText}>Scanned — continue</Text>
            </TouchableOpacity>
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Confirm the code matches</Text>
            <Text style={styles.stepSubtitle}>
              Check both devices show the same 4 digits
            </Text>
            <View style={styles.codeRow}>
              {["4", "8", "2", "1"].map((d, i) => (
                <View key={i} style={styles.codeDigit}>
                  <Text style={styles.codeDigitText}>{d}</Text>
                </View>
              ))}
            </View>
            <View style={styles.stepActions}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setStep(0)}
              >
                <Text style={styles.stepBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepBtn, styles.stepBtnPrimary]}
                onPress={() => setStep(2)}
              >
                <Text style={[styles.stepBtnText, styles.stepBtnPrimaryText]}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.successCircle}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.stepTitle}>Device paired</Text>
            <Text style={styles.stepSubtitle}>
              Syncing history — this may take a moment
            </Text>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
            <Text style={styles.progressText}>
              128 of 214 events synced
            </Text>
            <TouchableOpacity
              style={[styles.stepBtn, styles.stepBtnOutline]}
              onPress={() => {
                setStep(0);
                onComplete();
              }}
            >
              <Text style={[styles.stepBtnText, styles.stepBtnOutlineText]}>
                Go to devices
              </Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return <View />;
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressDots}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[
              styles.dot,
              i < step && styles.dotDone,
              i === step && styles.dotActive,
            ]}
          />
        ))}
      </View>
      {renderStep()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface0,
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
    fontSize: 14,
    fontWeight: "500",
    color: theme.textPrimary,
    marginBottom: 5,
    textAlign: "center",
  },
  stepSubtitle: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 18,
    textAlign: "center",
  },
  qrBox: {
    width: 150,
    height: 150,
    backgroundColor: theme.surface1,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  qrPlaceholder: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  expiry: {
    fontSize: 11,
    color: theme.textMuted,
    marginBottom: 18,
  },
  stepBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  stepBtnText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  stepBtnPrimary: {
    backgroundColor: theme.fillAccent,
    borderColor: theme.fillAccent,
  },
  stepBtnPrimaryText: {
    color: theme.onAccent,
  },
  stepBtnOutline: {
    borderColor: theme.borderAccent,
  },
  stepBtnOutlineText: {
    color: theme.textAccent,
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 26,
  },
  codeDigit: {
    width: 46,
    height: 54,
    backgroundColor: theme.surface1,
    borderWidth: 0.5,
    borderColor: theme.borderStrong,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  codeDigitText: {
    fontSize: 22,
    fontWeight: "500",
    fontFamily: "monospace",
    color: theme.textAccent,
  },
  stepActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
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
  progressBar: {
    height: 4,
    backgroundColor: theme.surface1,
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
    alignSelf: "stretch",
    marginHorizontal: 16,
  },
  progressFill: {
    width: "62%",
    height: "100%",
    backgroundColor: theme.fillAccent,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    color: theme.textMuted,
    marginBottom: 18,
  },
});
