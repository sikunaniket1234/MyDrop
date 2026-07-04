import type { Item } from "@mydrop/core";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const syncPeer = useRef<SyncPeerClient | null>(null);
  const mdnsRef = useRef<MdnsBrowser | null>(null);
  const shareHandlerRef = useRef<ShareIntentHandler | null>(null);

  const socket = useMemo(
    () => io(apiBase, { autoConnect: false, transports: ["websocket"] }),
    [apiBase],
  );

  async function initStore(result: { store: V1MobileStore }): Promise<void> {
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
  }

  async function handleVaultUnlock(passphraseValue: string): Promise<void> {
    try {
      const result = await openV1MobileStore(passphraseValue);
      if (result.needsPassphrase) return;
      await initStore(result);
    } catch {
      // error handled by VaultScreen
    }
  }

  useEffect(() => {
    if (phase !== "main" || !store) return;
    const mdns = new MdnsBrowser(nodes => {
      for (const node of nodes) {
        const url = `http://${node.host}:${node.port}`;
        setApiBase(url);
        setApiBaseInput(url);
        break;
      }
    });
    mdns.start();
    mdnsRef.current = mdns;
    return () => {
      mdns.stop();
      shareHandlerRef.current?.stopListening();
    };
  }, [phase, store]);

  useEffect(() => {
    if (phase !== "main" || !store) return;
    socket.connect();
    socket.on("connect", () => {
      setConnected(true);
      syncPeer.current?.connect(apiBase);
    });
    socket.on("disconnect", () => {
      setConnected(false);
      syncPeer.current?.disconnect();
    });
    socket.on("v1:snapshot", snapshot => {
      setItems(snapshot as Item[]);
    });
    socket.on("v1:item:created", item => {
      setItems(current => [
        item as Item,
        ...current.filter(
          (existing: Item) => existing.id !== (item as Item).id,
        ),
      ]);
    });
    socket.on("v1:item:deleted", (data: { id: string }) => {
      setItems(current => current.filter(i => i.id !== data.id));
    });
    socket.on("device:trusted", () => {
      // refresh device list if on devices screen
    });
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("v1:snapshot");
      socket.off("v1:item:created");
      socket.off("v1:item:deleted");
      socket.off("device:trusted");
      socket.disconnect();
      syncPeer.current?.disconnect();
    };
  }, [socket, store, apiBase, phase]);

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
            .then(async result => {
              if (result.needsPassphrase) return;
              await initStore(result);
            })
            .catch(() => {
              // error
            });
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
                  style={styles.composerBtn}
                  onPress={() => setApiBase(apiBaseInput.trim())}
                >
                  <Text style={styles.composerBtnText}>Connect</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.composerBtn}
                  onPress={() => {
                    if (text.trim() && store) {
                      void (async () => {
                        const item = await store.createItem({
                          type: "text",
                          title:
                            text.length > 48
                              ? `${text.slice(0, 45)}...`
                              : text,
                          content: text,
                          fileId: null,
                        });
                        setItems(current => [item, ...current]);
                        setText("");
                      })();
                    }
                  }}
                >
                  <Text style={styles.composerBtnText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  composer: {
    paddingHorizontal: 14,
    paddingTop: 8,
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
  composerBtnText: {
    fontSize: 12,
    color: theme.textAccent,
  },
  content: {
    flex: 1,
  },
});
