import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "./theme.js";

interface DeviceEntry {
  id: string;
  name: string;
  ver: string;
  status: "online" | "offline";
  seen: string;
  storage: string;
  pending: number;
}

interface Props {
  apiBase: string;
  onPair: () => void;
}

export function DevicesScreen({
  apiBase,
  onPair,
}: Props): React.ReactElement {
  const [devices, setDevices] = useState<DeviceEntry[]>([]);

  useEffect(() => {
    void fetchDevices();
  }, [apiBase]);

  async function fetchDevices(): Promise<void> {
    try {
      const res = await fetch(`${apiBase}/v1/devices`);
      const data = (await res.json()) as { devices: DeviceEntry[] };
      setDevices(data.devices);
    } catch {
      // fallback demo data
      setDevices([
        { id: "d", name: "Desktop", ver: "v1.0.0", status: "online", seen: "now", storage: "142 MB", pending: 0 },
        { id: "l", name: "Laptop", ver: "v1.0.0", status: "online", seen: "12s ago", storage: "89 MB", pending: 3 },
        { id: "p", name: "Phone", ver: "v1.0.0", status: "offline", seen: "3h ago", storage: "211 MB", pending: 14 },
      ]);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {devices.map((d, i) => (
          <View key={d.id} style={[styles.card, i > 0 && styles.cardGap]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <View
                  style={[
                    styles.statusDot,
                    d.status === "online"
                      ? styles.statusOnline
                      : styles.statusOffline,
                    d.status === "online" && styles.syncing,
                  ]}
                />
                <Text style={styles.cardName}>{d.name}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.verText}>{d.ver}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    d.status === "online"
                      ? styles.statusBadgeOnline
                      : styles.statusBadgeOffline,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      d.status === "online"
                        ? styles.statusBadgeTextOnline
                        : styles.statusBadgeTextOffline,
                    ]}
                  >
                    {d.status}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.statsGrid}>
              {[
                { label: "Storage", value: d.storage, warn: false },
                {
                  label: "Pending",
                  value: d.pending > 0 ? `${d.pending} events` : "Up to date",
                  warn: d.pending > 0,
                },
                { label: "Last seen", value: d.seen, warn: false },
              ].map(stat => (
                <View key={stat.label} style={styles.statBox}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text
                    style={[
                      styles.statValue,
                      stat.warn && styles.statWarn,
                    ]}
                  >
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.pairBtn} onPress={onPair}>
        <Text style={styles.pairBtnText}>+ Pair new device</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  list: {},
  card: {
    backgroundColor: theme.surface1,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
  },
  cardGap: {
    marginTop: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusOnline: {
    backgroundColor: theme.fillSuccess,
  },
  statusOffline: {
    backgroundColor: theme.borderStrong,
  },
  syncing: {
    opacity: 0.7,
  },
  cardName: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textPrimary,
  },
  cardMeta: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  verText: {
    fontSize: 10,
    color: theme.textMuted,
    fontFamily: "monospace",
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusBadgeOnline: {
    backgroundColor: theme.bgSuccess,
    borderWidth: 0.5,
    borderColor: theme.borderSuccess,
  },
  statusBadgeOffline: {
    backgroundColor: theme.surface2,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  statusBadgeText: {
    fontSize: 10,
  },
  statusBadgeTextOnline: {
    color: theme.textSuccess,
  },
  statusBadgeTextOffline: {
    color: theme.textMuted,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 6,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.surface0,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 7,
    padding: 6,
  },
  statLabel: {
    fontSize: 9,
    color: theme.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  statWarn: {
    color: theme.textWarning,
  },
  pairBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderStyle: "dashed",
    borderColor: theme.borderStrong,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  pairBtnText: {
    color: theme.textAccent,
    fontSize: 12,
  },
});
