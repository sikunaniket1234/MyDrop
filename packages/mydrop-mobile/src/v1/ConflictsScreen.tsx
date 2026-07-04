import type { Item } from "@mydrop/core";
import React, { useEffect, useState } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "./theme.js";

interface ConflictCopy {
  id: string;
  content: string | null;
  losingDevice: string;
  createdAt: number;
}

interface ConflictedItem {
  itemId: string;
  itemTitle: string;
  copies: ConflictCopy[];
}

interface Props {
  apiBase: string;
  items: Item[];
  onBack: () => void;
}

export function ConflictsScreen({
  apiBase,
  items,
  onBack,
}: Props): React.ReactElement {
  const [conflictedItems, setConflictedItems] = useState<ConflictedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    void fetchConflicts();
  }, [apiBase, items]);

  async function fetchConflicts(): Promise<void> {
    setLoading(true);
    const results: ConflictedItem[] = [];
    for (const item of items) {
      try {
        const res = await fetch(
          `${apiBase}/v1/items/${item.id}/conflicts`,
        );
        if (!res.ok) continue;
        const data = (await res.json()) as { conflicts: ConflictCopy[] };
        if (data.conflicts.length > 0) {
          results.push({
            itemId: item.id,
            itemTitle: item.title,
            copies: data.conflicts,
          });
        }
      } catch {
        // skip
      }
    }
    setConflictedItems(results);
    setLoading(false);
  }

  async function handleResolve(
    itemId: string,
    copyId: string,
    keepBoth: boolean,
  ): Promise<void> {
    try {
      await fetch(`${apiBase}/v1/items/${itemId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ copyId, keepBoth }),
      });
      setResolvedId(itemId);
      setConflictedItems(current => current.filter(c => c.itemId !== itemId));
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.surface0} />
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Checking for conflicts...</Text>
        </View>
      </View>
    );
  }

  if (conflictedItems.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.surface0} />
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.centered}>
          <View style={styles.successCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.emptyTitle}>No conflicts</Text>
          <Text style={styles.emptySubtitle}>
            All items are in sync across your devices
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.surface0} />
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.warningBanner}>
        <Text style={styles.warningIcon}>⚠</Text>
        <View>
          <Text style={styles.warningTitle}>
            {conflictedItems.length} item{conflictedItems.length !== 1 ? "s" : ""} with conflicts
          </Text>
          <Text style={styles.warningSub}>
            Different versions were edited on multiple devices
          </Text>
        </View>
      </View>

      {conflictedItems.map(ci => (
        <View key={ci.itemId} style={styles.itemSection}>
          {resolvedId === ci.itemId ? (
            <View style={styles.resolvedBanner}>
              <Text style={styles.resolvedText}>✓ Resolved</Text>
            </View>
          ) : (
            <>
              <Text style={styles.itemTitle}>{ci.itemTitle || "(untitled)"}</Text>
              <View style={styles.grid}>
                {ci.copies.map((c, idx) => (
                  <View key={c.id} style={styles.copyCard}>
                    <Text style={styles.copyVersion}>
                      Version {String.fromCharCode(65 + idx)}
                    </Text>
                    <Text style={styles.copyMeta}>
                      {c.losingDevice} ·{" "}
                      {new Date(c.createdAt).toLocaleTimeString()}
                    </Text>
                    <View style={styles.copyContent}>
                      <Text style={styles.copyText} numberOfLines={6}>
                        {c.content || "(file)"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.keepBtn}
                      onPress={() =>
                        void handleResolve(ci.itemId, c.id, false)
                      }
                    >
                      <Text style={styles.keepBtnText}>
                        Keep {String.fromCharCode(65 + idx)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.keepBothBtn}
                onPress={() =>
                  void handleResolve(ci.itemId, ci.copies[0]!.id, true)
                }
              >
                <Text style={styles.keepBothBtnText}>Keep both</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}
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
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
    marginBottom: 10,
  },
  backText: {
    color: theme.textAccent,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 13,
    color: theme.textMuted,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme.textMuted,
  },
  successCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.bgSuccess,
    borderWidth: 0.5,
    borderColor: theme.borderSuccess,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  successIcon: {
    fontSize: 20,
    color: theme.textSuccess,
  },
  warningBanner: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: theme.bgWarning,
    borderWidth: 0.5,
    borderColor: theme.borderWarning,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
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
  itemSection: {
    marginBottom: 16,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textPrimary,
    marginBottom: 8,
  },
  grid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
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
    marginBottom: 6,
  },
  copyContent: {
    backgroundColor: theme.surface0,
    borderRadius: 6,
    padding: 6,
    marginBottom: 8,
  },
  copyText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: theme.textSecondary,
    lineHeight: 17,
  },
  keepBtn: {
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: theme.border,
    backgroundColor: theme.surface0,
    alignItems: "center",
  },
  keepBtnText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  keepBothBtn: {
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: theme.borderAccent,
    backgroundColor: theme.bgAccent,
    alignItems: "center",
  },
  keepBothBtnText: {
    fontSize: 11,
    color: theme.textAccent,
  },
  resolvedBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.bgSuccess,
    borderWidth: 0.5,
    borderColor: theme.borderSuccess,
    alignItems: "center",
  },
  resolvedText: {
    fontSize: 12,
    color: theme.textSuccess,
  },
});
