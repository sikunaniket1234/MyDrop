import type { Item } from "@mydrop/core";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import RNFS from "react-native-fs";
import { io } from "socket.io-client";
import { openV1MobileStore, type V1MobileStore } from "./v1/mobile-v1-store.js";
import { VaultScreen } from "./v1/VaultScreen.js";
import { SyncPeerClient, type SyncPeerStatus } from "./sync/sync-peer-client.js";
import { MdnsBrowser } from "./sync/mdns-browser.js";
import { pickAnyFile } from "./native/file-picker.js";

type AppPhase = "vault" | "main";

export function MyDropAlphaApp(): React.ReactElement {
  const [phase, setPhase] = useState<AppPhase>("vault");
  const [passphrase, setPassphrase] = useState("");
  const [, setVaultMode] = useState<"auto" | "passphrase">("auto");
  const [apiBase, setApiBase] = useState("http://10.0.2.2:4317");
  const [apiBaseInput, setApiBaseInput] = useState(apiBase);
  const [items, setItems] = useState<Item[]>([]);
  const [store, setStore] = useState<V1MobileStore | null>(null);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncPeerStatus>("disconnected");
  const syncPeer = useRef<SyncPeerClient | null>(null);
  const mdnsRef = useRef<MdnsBrowser | null>(null);

  const socket = useMemo(() => io(apiBase, { autoConnect: false, transports: ["websocket"] }), [apiBase]);

  async function handleVaultUnlock(): Promise<void> {
    const result = await openV1MobileStore(passphrase);
    if (result.needsPassphrase) return;

    setStore(result.store);
    setPhase("main");

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

    const mdns = new MdnsBrowser((nodes) => {
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
    };
  }, [phase, store]);

  useEffect(() => {
    if (phase !== "main" || !store) return;

    void socket.connect();
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
      setItems(current => [item as Item, ...current.filter(existing => existing.id !== (item as Item).id)]);
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
          setVaultMode(result.vaultMode);
          setPassphrase(result.passphrase);
          void handleVaultUnlock();
        }}
        onSkip={() => {
          void openV1MobileStore().then(result => {
            if (result.needsPassphrase) return;
            setStore(result.store);
            setVaultMode(result.vaultMode);
            setPhase("main");

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

  async function shareText(): Promise<void> {
    const body = text.trim();
    if (!body || !store) return;

    const title = body.length > 48 ? `${body.slice(0, 45)}...` : body;
    const item = await store.createItem({
      type: "text",
      title,
      content: body,
      fileId: null,
    });
    setItems(current => [item, ...current]);
    setText("");

    try {
      await fetch(`${apiBase}/v1/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "text", title, content: body }),
      });
    } catch {
      // will sync via WebSocket later
    }
  }

  async function shareImage(): Promise<void> {
    if (!store) return;

    try {
      const result = await launchImageLibrary({ mediaType: "mixed", selectionLimit: 1 });
      if (result.didCancel || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!asset.uri) return;

      const filePath = asset.uri;
      const mimeType = asset.type ?? "application/octet-stream";
      const fileName = asset.fileName ?? `file-${Date.now()}`;

      const base64 = await RNFS.readFile(filePath, "base64");
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      let fileId: string | null = null;
      try {
        const uploadRes = await fetch(`${apiBase}/v1/files`, {
          method: "POST",
          headers: { "content-type": mimeType },
          body: bytes,
        });
        if (uploadRes.ok) {
          const fileRecord = (await uploadRes.json()) as { id: string };
          fileId = fileRecord.id;
        }
      } catch {
        // fallback: embed as data URL content
      }

      if (fileId) {
        const item = await store.createItem({
          type: "file",
          title: fileName,
          content: null,
          fileId,
        });
        setItems(current => [item, ...current]);
      } else {
        const dataUrl = `data:${mimeType};base64,${base64}`;
        const item = await store.createItem({
          type: "file",
          title: fileName,
          content: dataUrl,
          fileId: null,
        });
        setItems(current => [item, ...current]);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        Alert.alert("File error", error.message);
      }
    }
  }

  async function pickAndShareFile(): Promise<void> {
    if (!store) return;

    try {
      const picked = await pickAnyFile();
      if (!picked) return;

      const binaryStr = atob(picked.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      let fileId: string | null = null;
      try {
        const uploadRes = await fetch(`${apiBase}/v1/files`, {
          method: "POST",
          headers: { "content-type": picked.mimeType },
          body: bytes,
        });
        if (uploadRes.ok) {
          const fileRecord = (await uploadRes.json()) as { id: string };
          fileId = fileRecord.id;
        }
      } catch {
        const dataUrl = `data:${picked.mimeType};base64,${picked.base64}`;
        const item = await store.createItem({
          type: "file",
          title: picked.fileName,
          content: dataUrl,
          fileId: null,
        });
        setItems(current => [item, ...current]);
        return;
      }

      if (fileId) {
        const item = await store.createItem({
          type: "file",
          title: picked.fileName,
          content: null,
          fileId,
        });
        setItems(current => [item, ...current]);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        Alert.alert("Picker error", error.message);
      }
    }
  }

  async function downloadFile(item: Item): Promise<void> {
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
            { text: "Open", onPress: () => void Linking.openURL(`file://${dest}`) },
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
        Alert.alert("Downloaded", `Saved to Downloads/${fileName}`, [
          { text: "Open", onPress: () => void Linking.openURL(`file://${dest}`) },
          { text: "OK" },
        ]);
        return;
      }

      Alert.alert("Cannot download", "No file data available");
    } catch (error: unknown) {
      Alert.alert("Download failed", error instanceof Error ? error.message : "Unknown error");
    }
  }

  function isFileItem(item: Item): boolean {
    return item.type === "file" || item.type === "image";
  }

  const statusLabel = connected
    ? syncStatus === "ready"
      ? "Synced"
      : syncStatus === "syncing"
        ? "Syncing..."
        : "Connected"
    : "Disconnected";

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MyDrop Alpha</Text>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.status}>{statusLabel}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Desktop node URL</Text>
        <TextInput value={apiBaseInput} onChangeText={setApiBaseInput} style={styles.input} autoCapitalize="none" />
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setApiBase(apiBaseInput.trim())}
        >
          <Text style={styles.secondaryButtonText}>Connect</Text>
        </TouchableOpacity>
        <TextInput
          value={text}
          onChangeText={setText}
          style={[styles.input, styles.textarea]}
          multiline
          placeholder="Share text..."
        />
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void shareImage()}>
            <Text style={styles.secondaryButtonText}>Media</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void pickAndShareFile()}>
            <Text style={styles.secondaryButtonText}>Pick file</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void shareText()}>
            <Text style={styles.primaryButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No items yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.kind}>{item.type}</Text>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemBody}>
              {isFileItem(item) ? item.title : item.content}
            </Text>
            <Text style={styles.meta}>
              {item.createdBy} · {new Date(item.createdAt).toLocaleString()}
            </Text>
            {isFileItem(item) ? (
              <TouchableOpacity style={styles.downloadButton} onPress={() => void downloadFile(item)}>
                <Text style={styles.downloadButtonText}>Download</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    gap: 12,
    margin: 16,
    padding: 16,
  },
  empty: {
    color: "#64748b",
    padding: 24,
    textAlign: "center",
  },
  eyebrow: {
    color: "#5570a7",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  header: {
    padding: 20,
  },
  input: {
    borderColor: "#cbd5e1",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  item: {
    backgroundColor: "white",
    borderRadius: 18,
    gap: 4,
    padding: 16,
  },
  itemBody: {
    color: "#334155",
  },
  itemTitle: {
    color: "#172033",
    fontSize: 18,
    fontWeight: "800",
  },
  kind: {
    color: "#5570a7",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  label: {
    color: "#334155",
    fontWeight: "700",
  },
  list: {
    gap: 12,
    padding: 16,
  },
  meta: {
    color: "#64748b",
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: "#275efe",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "800",
  },
  root: {
    backgroundColor: "#f5f7fb",
    flex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#172033",
    fontWeight: "800",
  },
  status: {
    color: "#64748b",
  },
  downloadButton: {
    backgroundColor: "#275efe",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  downloadButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 13,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  title: {
    color: "#172033",
    fontSize: 34,
    fontWeight: "900",
  },
});
