import type { Item } from "@mydrop/core";
import React from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import RNFS from "react-native-fs";
import { theme, itemTypeColor, itemTypeBg, itemTypeIcon } from "./theme.js";

interface Props {
  item: Item;
  onBack: () => void;
  apiBase: string;
}

export function DetailScreen({
  item,
  onBack,
  apiBase,
}: Props): React.ReactElement {
  const color = itemTypeColor[item.type];
  const bg = itemTypeBg[item.type];
  const icon = itemTypeIcon[item.type];

  async function handleDownload(): Promise<void> {
    const fileName = item.title ?? `mydrop-${item.id}`;
    const dest = `${RNFS.DownloadDirectoryPath}/${fileName}`;
    try {
      if (item.fileId) {
        const res = await fetch(`${apiBase}/v1/files/${item.fileId}/download`);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]!);
          }
          const base64 = btoa(binary);
          await RNFS.writeFile(dest, base64, "base64");
          Alert.alert("Downloaded", `Saved to Downloads/${fileName}`, [
            {
              text: "Open",
              onPress: () => void Linking.openURL(`file://${dest}`),
            },
            { text: "OK" },
          ]);
          return;
        }
      }
      if (item.content?.startsWith("data:")) {
        const metaIndex = item.content.indexOf(",");
        if (metaIndex === -1) throw new Error("Invalid data URL");
        const base64 = item.content.slice(metaIndex + 1);
        await RNFS.writeFile(dest, base64, "base64");
        Alert.alert("Downloaded", `Saved to Downloads/${fileName}`);
        return;
      }
      Alert.alert("Cannot download", "No file data available");
    } catch (err: unknown) {
      Alert.alert(
        "Download failed",
        err instanceof Error ? err.message : "Unknown error",
      );
    }
  }

  async function handleShare(): Promise<void> {
    const text = item.content ?? item.title;
    try {
      await Linking.openURL(`sms:?body=${encodeURIComponent(text)}`);
    } catch {
      Alert.alert("Share", "Share this item from your device share sheet");
    }
  }

  function handleDelete(): void {
    Alert.alert(
      "Delete item",
      "Are you sure you want to delete this item?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onBack() },
      ],
    );
  }

  const metaFields: [string, string][] = [
    ["Type", item.type],
    ["Synced", "2 devices"],
    ["From", item.createdBy],
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.iconRow}>
        <View style={[styles.iconBox, { backgroundColor: bg }]}>
          <Text style={[styles.icon, { color }]}>{icon}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        {item.content ? (
          <Text style={styles.content}>{item.content}</Text>
        ) : null}
        <View style={styles.metaGrid}>
          {metaFields.map(([label, value]) => (
            <View key={label} style={styles.metaField}>
              <Text style={styles.metaLabel}>{label}</Text>
              <Text style={styles.metaValue}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.tagsRow}>
        <Text style={styles.tagHeader}>Tags</Text>
        <View style={styles.tag}>
          <Text style={styles.tagText}>#work</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>#mydrop</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => void handleDownload()}
        >
          <Text style={styles.actionText}>⬇ Download</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => void handleShare()}
        >
          <Text style={styles.actionText}>↗ Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionDanger]}
          onPress={handleDelete}
        >
          <Text style={[styles.actionText, styles.actionDangerText]}>
            🗑 Delete
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
  },
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  backText: {
    color: theme.textAccent,
    fontSize: 13,
  },
  iconRow: {
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  iconBox: {
    height: 90,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 36,
    opacity: 0.5,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.textPrimary,
    marginBottom: 4,
  },
  content: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 10,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  metaField: {},
  metaLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  tagHeader: {
    fontSize: 11,
    color: theme.textMuted,
  },
  tag: {
    backgroundColor: theme.surface1,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  actionText: {
    fontSize: 12,
    color: theme.textPrimary,
  },
  actionDanger: {
    backgroundColor: theme.bgDanger,
    borderColor: theme.borderDanger,
  },
  actionDangerText: {
    color: theme.textDanger,
  },
});
