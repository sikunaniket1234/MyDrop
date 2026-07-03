import type { Item, ItemType } from "@mydrop/core";
import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme, itemTypeColor, itemTypeBg, itemTypeIcon } from "./theme.js";

const FILTERS: ("all" | ItemType)[] = [
  "all",
  "text",
  "link",
  "file",
  "image",
  "voice",
];

interface Props {
  items: Item[];
  onSelect: (item: Item) => void;
}

export function InboxScreen({ items, onSelect }: Props): React.ReactElement {
  const [filter, setFilter] = useState<"all" | ItemType>("all");

  const filtered =
    filter === "all" ? items : items.filter(i => i.type === filter);

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.pill, filter === f && styles.pillActive]}
          >
            <Text
              style={[
                styles.pillText,
                filter === f && styles.pillTextActive,
              ]}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No items yet.</Text>
        }
        renderItem={({ item }) => (
          <ItemRow item={item} onPress={() => onSelect(item)} />
        )}
      />
    </View>
  );
}

function ItemRow({
  item,
  onPress,
}: {
  item: Item;
  onPress: () => void;
}): React.ReactElement {
  const color = itemTypeColor[item.type];
  const bg = itemTypeBg[item.type];
  const icon = itemTypeIcon[item.type];

  return (
    <TouchableWrapper onPress={onPress}>
      <View style={[styles.itemRow, { borderLeftColor: color }]}>
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <Text style={[styles.badgeIcon, { color }]}>{icon}</Text>
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.content ? (
            <Text style={styles.itemMeta} numberOfLines={1}>
              {item.content}
            </Text>
          ) : null}
        </View>
        <Text style={styles.itemTime}>
          {formatTime(item.createdAt)}
        </Text>
      </View>
    </TouchableWrapper>
  );
}

function TouchableWrapper({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface0,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: theme.border,
    backgroundColor: "transparent",
  },
  pillActive: {
    backgroundColor: theme.bgAccent,
    borderColor: theme.borderAccent,
  },
  pillText: {
    fontSize: 11,
    color: theme.textMuted,
  },
  pillTextActive: {
    color: theme.textAccent,
  },
  list: {
    paddingBottom: 20,
  },
  empty: {
    color: theme.textMuted,
    padding: 24,
    textAlign: "center",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
    borderLeftWidth: 3,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  badgeIcon: {
    fontSize: 14,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 13,
    color: theme.textPrimary,
    fontFamily: "monospace",
  },
  itemMeta: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 1,
  },
  itemTime: {
    fontSize: 11,
    color: theme.textMuted,
    flexShrink: 0,
    paddingTop: 1,
  },
});
