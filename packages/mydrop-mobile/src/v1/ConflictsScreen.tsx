import type { Item } from "@mydrop/core";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "./theme.js";

interface ConflictCopy {
  id: string;
  version: string;
  device: string;
  time: string;
  content: string;
}

interface Props {
  item: Item;
  copies: ConflictCopy[];
  onResolve: (copyId: string, keepBoth: boolean) => void;
  onBack: () => void;
}

export function ConflictsScreen({
  copies,
  onResolve,
  onBack,
}: Props): React.ReactElement {
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <View style={styles.container}>
        <View style={styles.doneContainer}>
          <View style={styles.successCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.doneTitle}>Conflict resolved</Text>
          <Text style={styles.doneSubtitle}>
            {done === "both"
              ? "Both versions kept as separate items"
              : `Version ${done} kept`}
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.warningBanner}>
        <Text style={styles.warningIcon}>⚠</Text>
        <View>
          <Text style={styles.warningTitle}>2 versions found</Text>
          <Text style={styles.warningSub}>
            Both devices edited this note while offline
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {copies.map(c => (
          <View key={c.id} style={styles.copyCard}>
            <Text style={styles.copyVersion}>Version {c.version}</Text>
            <Text style={styles.copyMeta}>
              {c.device} · {c.time}
            </Text>
            <View style={styles.copyContent}>
              <Text style={styles.copyText}>{c.content}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {copies.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.actionBtn, c.version === "B" && styles.actionBtnAccent]}
            onPress={() => {
              setDone(c.version);
              onResolve(c.id, false);
            }}
          >
            <Text
              style={[
                styles.actionText,
                c.version === "B" && styles.actionTextAccent,
              ]}
            >
              Keep {c.version}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            setDone("both");
            onResolve("", true);
          }}
        >
          <Text style={[styles.actionText, styles.actionTextMuted]}>
            Keep both
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface0,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  warningBanner: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: theme.bgWarning,
    borderWidth: 0.5,
    borderColor: theme.borderWarning,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  warningIcon: {
    fontSize: 15,
    color: theme.textWarning,
    flexShrink: 0,
    marginTop: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textWarning,
  },
  warningSub: {
    fontSize: 11,
    color: theme.textWarning,
    opacity: 0.8,
  },
  grid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  copyCard: {
    flex: 1,
    backgroundColor: theme.surface1,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 10,
  },
  copyVersion: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.textPrimary,
    marginBottom: 2,
  },
  copyMeta: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 8,
  },
  copyContent: {
    backgroundColor: theme.surface0,
    borderRadius: 6,
    padding: 6,
  },
  copyText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: theme.textSecondary,
    lineHeight: 17,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: theme.border,
    backgroundColor: theme.surface1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnAccent: {
    borderColor: theme.borderAccent,
    backgroundColor: theme.bgAccent,
  },
  actionText: {
    fontSize: 12,
    color: theme.textPrimary,
  },
  actionTextAccent: {
    color: theme.textAccent,
  },
  actionTextMuted: {
    color: theme.textSecondary,
  },
  doneContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
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
  doneTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.textPrimary,
    marginBottom: 5,
  },
  doneSubtitle: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 18,
    textAlign: "center",
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  backBtnText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
});
