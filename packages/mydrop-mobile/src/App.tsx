import type { Item } from "@mydrop/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { io } from "socket.io-client";
import { openV1MobileStore, type V1MobileStore } from "./v1/mobile-v1-store.js";
import { VaultScreen } from "./v1/VaultScreen.js";
import { InboxScreen } from "./v1/InboxScreen.js";
import { DetailScreen } from "./v1/DetailScreen.js";
import { DevicesScreen } from "./v1/DevicesScreen.js";
import { PairingScreen } from "./v1/PairingScreen.js";
import { ConflictsScreen } from "./v1/ConflictsScreen.js";
import { TabBar, type TabItem } from "./v1/TabBar.js";
import { theme } from "./v1/theme.js";
import { SyncPeerClient, type SyncPeerStatus } from "./sync/sync-peer-client.js";
import { MdnsBrowser } from "./sync/mdns-browser.js";
import { ShareIntentHandler } from "./native/ShareIntentHandler.js";

type AppPhase = "vault" | "main";
type Screen =
  | "inbox"
  | "detail"
  | "devices"
  | "pairing"
  | "conflicts";

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

export function MyDropAlphaApp(): React.ReactElement {
  const [phase, setPhase] = useState<AppPhase>("vault");
  const [screen, setScreen] = useState<Screen>("inbox");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [apiBase, setApiBase] = useState("http://10.0.2.2:4317");
  const [apiBaseInput, setApiBaseInput] = useState(apiBase);
  const [items, setItems] = useState<Item[]>([]);
  const [store, setStore] = useState<V1MobileStore | null>(null);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncPeerStatus>("disconnected");
  const [conflictCount, setConflictCount] = useState(0);
  const [userManualConnect, setUserManualConnect] = useState(false);
  const syncPeer = useRef<SyncPeerClient | null>(null);
  const mdnsRef = useRef<MdnsBrowser | null>(null);
  const shareHandlerRef = useRef<ShareIntentHandler | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  function connectToServer(url: string): void {
    const normalized = normalizeUrl(url);
    console.warn("[DEBUG] connectToServer: " + normalized);

    if (socketRef.current) {
      socketRef.current.off("connect");
      socketRef.current.off("disconnect");
      socketRef.current.off("v1:snapshot");
      socketRef.current.off("v1:item:created");
      socketRef.current.off("v1:item:deleted");
      socketRef.current.off("device:trusted");
      socketRef.current.disconnect();
    }

    setApiBase(normalized);
    setApiBaseInput(normalized);
    setUserManualConnect(true);
    setConnected(false);

    const socket = io(normalized, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.warn("[DEBUG] socket connected to " + normalized);
      setConnected(true);
      syncPeer.current?.connect(normalized);
      // Fallback: fetch items via HTTP in case socket snapshot is delayed
      fetch(`${normalized}/v1/items`)
        .then(res => res.json())
        .then(data => {
          const list = (data as { items?: Item[] }) ?? data;
          const itemsArray = Array.isArray(list) ? list : list.items ?? [];
          console.warn("[DEBUG] HTTP fallback fetched " + itemsArray.length + " items");
          if (itemsArray.length > 0) setItems(itemsArray);
        })
        .catch(() => {});
    });
    socket.on("disconnect", (reason) => {
      console.warn("[DEBUG] socket disconnected: " + reason);
      setConnected(false);
      syncPeer.current?.disconnect();
    });
    socket.on("connect_error", (err) => {
      console.warn("[DEBUG] socket connection error: " + err.message);
    });
    socket.on("v1:snapshot", snapshot => {
      console.warn("[DEBUG] v1:snapshot received: " + (snapshot as Item[]).length + " items");
      setItems(snapshot as Item[]);
    });
    socket.on("v1:item:created", item => {
      console.warn("[DEBUG] v1:item:created received: " + (item as Item).id);
      setItems(current => [
        item as Item,
        ...current.filter(
          (existing: Item) => existing.id !== (item as Item).id,
        ),
      ]);
    });
    socket.on("v1:item:deleted", (data: { id: string }) => {
      console.warn("[DEBUG] v1:item:deleted received: " + data.id);
      setItems(current => current.filter(i => i.id !== data.id));
    });
    socket.on("device:trusted", () => {});
    socket.connect();
  }

  function initStore(result: { store: V1MobileStore }): void {
    setStore(result.store);
    setPhase("main");

    const handler = new ShareIntentHandler(result.store);
    handler.subscribe(() => {
      void result.store.listItems().then(setItems);
    });
    handler.startListening();
    shareHandlerRef.current = handler;

    const peer = new SyncPeerClient(result.store.syncEngine, {
      onStatusChange: setSyncStatus,
      onSyncComplete: () => {
        void result.store.listItems().then(setItems);
      },
    });
    syncPeer.current = peer;

    connectToServer(apiBase);
  }

  async function handleVaultUnlock(passphraseValue: string): Promise<void> {
    try {
      const result = await openV1MobileStore(passphraseValue);
      if (result.needsPassphrase) return;
      initStore(result);
    } catch (err: unknown) {
      console.warn("[DEBUG] handleVaultUnlock FAILED: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  useEffect(() => {
    if (phase !== "main" || !store || userManualConnect) return;
    const mdns = new MdnsBrowser(nodes => {
      for (const node of nodes) {
        const url = `http://${node.host}:${node.port}`;
        console.warn("[DEBUG] mDNS found: " + url);
        connectToServer(url);
        break;
      }
    });
    mdns.start();
    mdnsRef.current = mdns;
    return () => {
      mdns.stop();
      shareHandlerRef.current?.stopListening();
    };
  }, [phase, store, userManualConnect]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const fetchConflictCount = useCallback(async (): Promise<void> => {
    if (!store) return;
    try {
      const allItems = await store.listItems();
      let total = 0;
      for (const item of allItems) {
        const res = await fetch(
          `${apiBase}/v1/items/${item.id}/conflicts`,
        );
        if (res.ok) {
          const data = (await res.json()) as { conflicts: unknown[] };
          if (data.conflicts.length > 0) total += data.conflicts.length;
        }
      }
      setConflictCount(total);
    } catch {
      // ignore
    }
  }, [store, apiBase]);

  useEffect(() => {
    if (phase !== "main") return;
    void fetchConflictCount();
    const interval = setInterval(() => void fetchConflictCount(), 30000);
    return () => clearInterval(interval);
  }, [phase, fetchConflictCount]);

  if (phase === "vault") {
    return (
      <VaultScreen
        onUnlock={result => {
          void handleVaultUnlock(result.passphrase);
        }}
        onSkip={() => {
          void openV1MobileStore()
            .then(result => {
              if (result.needsPassphrase) return;
      void initStore(result);
            })
            .catch(() => {});
        }}
      />
    );
  }

  function handleSelectItem(item: Item): void {
    setSelectedItem(item);
    setScreen("detail");
  }

  const statusLabel = connected
    ? syncStatus === "ready"
      ? "Synced"
      : syncStatus === "syncing"
        ? "Syncing..."
        : "Connected"
    : "Disconnected";

  const isSyncing = connected && syncStatus === "syncing";

  const tabs: TabItem[] = [
    { id: "inbox", label: "Inbox", icon: "📥" },
    { id: "devices", label: "Devices", icon: "📱" },
    {
      id: "conflicts",
      label: "Conflicts",
      icon: "⚠",
      badge: conflictCount > 0 ? conflictCount : undefined,
      warn: conflictCount > 0,
    },
    { id: "pairing", label: "Pair", icon: "🔗" },
  ] as TabItem[];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.surface0} />

      {screen !== "pairing" && screen !== "conflicts" && (
        <>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.logoBox}>
                <Text style={styles.logoIcon}>📥</Text>
              </View>
              <Text style={styles.appName}>MyDrop</Text>
              {isSyncing ? <View style={styles.syncDot} /> : null}
            </View>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>

          {screen === "inbox" && (
            <>
              <View style={styles.connectionBar}>
                <TextInput
                  value={apiBaseInput}
                  onChangeText={setApiBaseInput}
                  style={styles.serverInput}
                  placeholder="Server IP:port"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.connectBtn, connected && styles.connectBtnOk]}
                  onPress={() => connectToServer(apiBaseInput)}
                >
                  <Text style={[styles.connectBtnText, connected && styles.connectBtnTextOk]}>
                    {connected ? "✓" : "Go"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.composer}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  style={styles.input}
                  multiline
                  placeholder="Share text..."
                  placeholderTextColor={theme.textMuted}
                />
                <View style={styles.composerActions}>
                  <TouchableOpacity
                    style={[styles.composerBtn, !connected && styles.composerBtnDisabled]}
                    disabled={!connected}
                    onPress={() => {
                      if (text.trim() && connected) {
                        void (async () => {
                          try {
                            await fetch(`${apiBase}/v1/items`, {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({
                                type: "text",
                                title: text.length > 48 ? `${text.slice(0, 45)}...` : text,
                                content: text,
                              }),
                            });
                            setText("");
                          } catch (err) {
                            console.warn("[DEBUG] Send failed: " + (err instanceof Error ? err.message : String(err)));
                          }
                        })();
                      }
                    }}
                  >
                    <Text style={styles.composerBtnText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </>
      )}

      <View style={styles.content}>
        {screen === "inbox" && (
          <InboxScreen
            items={items}
            onSelect={handleSelectItem}
          />
        )}
        {screen === "detail" && selectedItem && (
          <DetailScreen
            item={selectedItem}
            onBack={() => {
              setSelectedItem(null);
              setScreen("inbox");
            }}
            apiBase={apiBase}
            onDelete={(id) => {
              setItems(current => current.filter(i => i.id !== id));
              setSelectedItem(null);
              setScreen("inbox");
            }}
          />
        )}
        {screen === "devices" && (
          <DevicesScreen
            apiBase={apiBase}
            onPair={() => setScreen("pairing")}
          />
        )}
        {screen === "pairing" && (
          <PairingScreen
            apiBase={apiBase}
            onComplete={() => setScreen("devices")}
            onCancel={() => setScreen("devices")}
          />
        )}
        {screen === "conflicts" && (
          <ConflictsScreen
            apiBase={apiBase}
            items={items}
            onBack={() => setScreen("inbox")}
          />
        )}
      </View>

      {screen !== "detail" && (
        <TabBar
          tabs={tabs}
          active={screen}
          onSelect={id => setScreen(id as Screen)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.surface0,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBox: {
    width: 26,
    height: 26,
    backgroundColor: theme.bgAccent,
    borderWidth: 0.5,
    borderColor: theme.borderAccent,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: {
    fontSize: 13,
    color: theme.textAccent,
  },
  appName: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.textPrimary,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.fillSuccess,
    marginLeft: 6,
  },
  statusText: {
    fontSize: 11,
    color: theme.textMuted,
  },
  connectionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  serverInput: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: theme.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontFamily: "monospace",
    color: theme.textPrimary,
    backgroundColor: theme.surface1,
  },
  connectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: theme.borderAccent,
    backgroundColor: theme.bgAccent,
  },
  connectBtnOk: {
    borderColor: theme.borderSuccess,
    backgroundColor: theme.bgSuccess,
  },
  connectBtnText: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.textAccent,
  },
  connectBtnTextOk: {
    color: theme.textSuccess,
  },
  composer: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  input: {
    borderWidth: 0.5,
    borderColor: theme.borderStrong,
    borderRadius: 16,
    padding: 12,
    fontSize: 13,
    color: theme.textPrimary,
    backgroundColor: theme.surface1,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  composerActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  composerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: theme.borderAccent,
    backgroundColor: theme.bgAccent,
  },
  composerBtnDisabled: {
    opacity: 0.4,
  },
  composerBtnText: {
    fontSize: 12,
    color: theme.textAccent,
  },
  content: {
    flex: 1,
  },
});
