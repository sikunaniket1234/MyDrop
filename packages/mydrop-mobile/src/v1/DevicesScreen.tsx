import React, { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "./theme.js";

interface DeviceEntry {
  id: string;
  name: string;
  status: string;
  online: boolean;
  trustedAt: number | null;
  lastSeen: number | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDevices = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${apiBase}/v1/devices`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { devices: DeviceEntry[] };
      setDevices(data.devices);
      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? `Cannot reach server: ${err.message}`
          : "Cannot reach server",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  function handleRefresh(): void {
    setRefreshing(true);
    void fetchDevices();
  }

  function formatLastSeen(ts: number | null): string {
    if (!ts) return "Never";
    const diff = Date.now() - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.surface0} />

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading devices...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorIconBox}>
            <Text style={styles.errorIcon}>⚠</Text>
          </View>
          <Text style={styles.errorTitle}>Server unreachable</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <Text style={styles.errorHint}>
            Make sure the desktop app is running on the same network
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.listWrap}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.textMuted}
              colors={[theme.fillAccent]}
            />
          }
        >
          {devices.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No devices paired</Text>
              <Text style={styles.emptySubtitle}>
                Pair your first device to start syncing
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {devices.map((d, i) => (
                <View
                  key={d.id}
                  style={[styles.card, i > 0 && styles.cardGap]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <View
                        style={[
                          styles.statusDot,
                          d.online
                            ? styles.statusOnline
                            : styles.statusOffline,
                        ]}
                      />
                      <Text style={styles.cardName}>{d.name}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        d.online
                          ? styles.statusBadgeOnline
                          : styles.statusBadgeOffline,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          d.online
                            ? styles.statusBadgeTextOnline
                            : styles.statusBadgeTextOffline,
                        ]}
                      >
                        {d.online ? "Online" : "Offline"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Status</Text>
                      <Text style={styles.statValue}>{d.status}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Trusted</Text>
                      <Text style={styles.statValue}>
                        {d.trustedAt
                          ? new Date(d.trustedAt).toLocaleDateString()
                          : "—"}
                      </Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statLabel}>Last seen</Text>
                      <Text style={styles.statValue}>
                        {formatLastSeen(d.lastSeen)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.pairBtn} onPress={onPair}>
            <Text style={styles.pairBtnText}>+ Pair new device</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface0,
  },
  listWrap: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listContent: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 13,
    color: theme.textMuted,
  },
  errorIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.bgDanger,
    borderWidth: 0.5,
    borderColor: theme.borderDanger,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  errorIcon: {
    fontSize: 20,
    color: theme.textDanger,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.textPrimary,
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 4,
    textAlign: "center",
  },
  errorHint: {
    fontSize: 11,
    color: theme.textMuted,
    opacity: 0.7,
    marginBottom: 16,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: theme.borderAccent,
    backgroundColor: theme.bgAccent,
  },
  retryBtnText: {
    fontSize: 12,
    color: theme.textAccent,
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
  cardName: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textPrimary,
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
  pairBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderStyle: "dashed",
    borderColor: theme.borderStrong,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pairBtnText: {
    color: theme.textAccent,
    fontSize: 12,
  },
});
