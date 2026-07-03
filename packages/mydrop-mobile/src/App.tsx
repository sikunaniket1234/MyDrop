import type { Item } from "@mydrop/core";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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

const TABS: TabItem[] = [
  { id: "inbox", label: "Inbox", icon: "📥" },
  { id: "devices", label: "Devices", icon: "📱" },
  { id: "conflicts", label: "Conflicts", icon: "⚠", badge: 1, warn: true },
  { id: "pairing", label: "Pair", icon: "🔗" },
];

export function MyDropAlphaApp(): React.ReactElement {
  const [phase, setPhase] = useState<AppPhase>("vault");
  const [passphrase, setPassphrase] = useState("");
  const [screen, setScreen] = useState<Screen>("inbox");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [apiBase, setApiBase] = useState("http://10.0.2.2:4317");
  const [apiBaseInput, setApiBaseInput] = useState(apiBase);
  const [items, setItems] = useState<Item[]>([]);
  const [store, setStore] = useState<V1MobileStore | null>(null);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncPeerStatus>("disconnected");
  const syncPeer = useRef<SyncPeerClient | null>(null);
  const mdnsRef = useRef<MdnsBrowser | null>(null);
  const shareHandlerRef = useRef<ShareIntentHandler | null>(null);

  const socket = useMemo(
    () => io(apiBase, { autoConnect: false, transports: ["websocket"] }),
    [apiBase],
  );

  async function handleVaultUnlock(): Promise<void> {
    const result = await openV1MobileStore(passphrase);
    if (result.needsPassphrase) return;
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
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("v1:snapshot");
      socket.off("v1:item:created");
      socket.disconnect();
      syncPeer.current?.disconnect();
    };
  }, [socket, store, apiBase, phase]);

  if (phase === "vault") {
    return (
      <VaultScreen
        onUnlock={result => {
          setPassphrase(result.passphrase);
          void handleVaultUnlock();
        }}
        onSkip={() => {
          void openV1MobileStore().then(result => {
            if (result.needsPassphrase) return;
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
            onComplete={() => setScreen("devices")}
            onCancel={() => setScreen("devices")}
          />
        )}
        {screen === "conflicts" && selectedItem && (
          <ConflictsScreen
            item={selectedItem}
            copies={[
              {
                id: "a",
                version: "A",
                device: "Laptop",
                time: "10:42 AM",
                content: "Meeting notes\n— API rate limits\n— OSWAS module",
              },
              {
                id: "b",
                version: "B",
                device: "Phone",
                time: "10:44 AM",
                content:
                  "Meeting notes\n— API rate limits\n— OSWAS module\n— Action: Redis config",
              },
            ]}
            onResolve={() => {}}
            onBack={() => setScreen("inbox")}
          />
        )}
      </View>

      {screen !== "detail" && (
        <TabBar
          tabs={TABS}
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
