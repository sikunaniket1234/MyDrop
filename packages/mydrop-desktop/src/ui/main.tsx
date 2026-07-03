import type { AlphaItem, Item } from "@mydrop/core";
import {
  deriveVaultKeyFromPassphrase,
  generateVaultKey,
  vaultKeyToHex,
  bytesToHex,
} from "@mydrop/core";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./styles.css";

const env = import.meta.env as Readonly<Record<string, string | undefined>>;
const apiBase = env["VITE_MYDROP_ALPHA_API"] ?? "http://127.0.0.1:4317";
const sourceDevice = "desktop-alpha";
const VAULT_STORAGE_KEY = "mydrop-vault";

interface VaultState {
  mode: "auto" | "passphrase";
  passphraseSalt: string | null;
  vaultKeyHex: string | null;
}

type Tab = "inbox" | "devices" | "vault";

function readVaultState(): VaultState {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as VaultState;
  } catch { /* ignore */ }
  return { mode: "auto", passphraseSalt: null, vaultKeyHex: null };
}

function writeVaultState(state: VaultState): void {
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(state));
}

interface DeviceEntry {
  id: string;
  name: string;
  status: string;
  online: boolean;
  trustedAt: number | null;
  lastSeen: number | null;
}

interface ConflictedCopyView {
  id: string;
  content: string | null;
  losingDevice: string;
  createdAt: number;
}

function App(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("inbox");
  const [alphaItems, setAlphaItems] = useState<AlphaItem[]>([]);
  const [v1Items, setV1Items] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Map<string, ConflictedCopyView[]>>(new Map());
  const [vaultState, setVaultState] = useState<VaultState>(() => readVaultState());
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [vaultConfirmPassphrase, setVaultConfirmPassphrase] = useState("");
  const [vaultMessage, setVaultMessage] = useState<string | null>(null);

  const socket = useMemo(() => io(apiBase, { transports: ["websocket"] }), []);

  useEffect(() => {
    void refreshItems();
    void refreshDevices();

    socket.on("connect", () => setStatus("Connected"));
    socket.on("disconnect", () => setStatus("Disconnected"));

    socket.on("items:snapshot", (snapshot: AlphaItem[]) => setAlphaItems(snapshot));
    socket.on("item:created", (item: AlphaItem) => {
      setAlphaItems(current => [item, ...current.filter(e => e.id !== item.id)]);
    });

    socket.on("v1:snapshot", (snapshot: Item[]) => setV1Items(snapshot));
    socket.on("v1:item:created", (item: Item) => {
      setV1Items(current => [item, ...current.filter(e => e.id !== item.id)]);
    });

    socket.on("devices:online", (ids: string[]) => {
      setOnlineIds(new Set(ids));
    });

    socket.on("device:trusted", () => { void refreshDevices(); });
    socket.on("device:revoked", () => { void refreshDevices(); });

    return () => { socket.disconnect(); };
  }, [socket]);

  async function refreshItems(): Promise<void> {
    const [alphaRes, v1Res] = await Promise.all([
      fetch(`${apiBase}/items`),
      fetch(`${apiBase}/v1/items`),
    ]);
    const [alphaData, v1Data] = await Promise.all([
      alphaRes.json() as Promise<AlphaItem[]>,
      v1Res.json() as Promise<Item[]>,
    ]);
    setAlphaItems(alphaData);
    setV1Items(v1Data);
  }

  async function refreshDevices(): Promise<void> {
    try {
      const res = await fetch(`${apiBase}/v1/devices`);
      const data = (await res.json()) as { devices: DeviceEntry[] };
      setDevices(data.devices);
    } catch { /* ignore */ }
  }

  async function checkConflicts(itemId: string): Promise<ConflictedCopyView[] | null> {
    try {
      const res = await fetch(`${apiBase}/v1/items/${itemId}/conflicts`);
      if (!res.ok) return null;
      const data = (await res.json()) as { conflicts: ConflictedCopyView[] };
      return data.conflicts;
    } catch { return null; }
  }

  async function resolveConflict(itemId: string, copyId: string, keepBoth: boolean): Promise<void> {
    try {
      await fetch(`${apiBase}/v1/items/${itemId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ copyId, keepBoth }),
      });
      setConflicts(prev => { const next = new Map(prev); next.delete(itemId); return next; });
      void refreshItems();
    } catch { /* ignore */ }
  }

  async function enableVaultPassphrase(): Promise<void> {
    setVaultMessage(null);
    if (vaultPassphrase.length < 4) {
      setVaultMessage("Passphrase must be at least 4 characters");
      return;
    }
    if (vaultPassphrase !== vaultConfirmPassphrase) {
      setVaultMessage("Passphrases do not match");
      return;
    }

    try {
      const saltBytes = new Uint8Array(16);
      crypto.getRandomValues(saltBytes);
      await deriveVaultKeyFromPassphrase(vaultPassphrase, saltBytes);

      const newState: VaultState = {
        mode: "passphrase",
        passphraseSalt: bytesToHex(saltBytes),
        vaultKeyHex: null,
      };
      writeVaultState(newState);
      setVaultState(newState);
      setVaultMessage("Vault passphrase enabled");
      setVaultPassphrase("");
      setVaultConfirmPassphrase("");
    } catch (err: unknown) {
      setVaultMessage(err instanceof Error ? err.message : "Failed to enable vault");
    }
  }

  function disableVaultPassphrase(): void {
    const newState: VaultState = {
      mode: "auto",
      passphraseSalt: null,
      vaultKeyHex: vaultState.vaultKeyHex ?? null,
    };
    if (!newState.vaultKeyHex) {
      const vk = generateVaultKey();
      newState.vaultKeyHex = vaultKeyToHex(vk);
    }
    writeVaultState(newState);
    setVaultState(newState);
    setVaultMessage("Vault passphrase disabled (using auto-generated key)");
  }

  async function shareText(): Promise<void> {
    const body = text.trim();
    if (body.length === 0) return;
    await postJson("/items/text", { body, sourceDevice });
    setText("");
  }

  async function shareFile(file: File): Promise<void> {
    const fileDataUrl = await readFileAsDataUrl(file);
    await postJson("/items/file", {
      fileName: file.name,
      fileUri: `desktop://${file.name}`,
      fileDataUrl,
      fileSize: file.size,
      mimeType: file.type || null,
      sourceDevice,
    });
  }

  function isFileItem(item: Item): boolean {
    return item.type === "file" || item.type === "image";
  }

  async function showConflicts(item: Item): Promise<void> {
    const copies = await checkConflicts(item.id);
    if (!copies || copies.length === 0) return;
    setConflicts(prev => new Map(prev).set(item.id, copies));
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">MyDrop</p>
          <h1>{tab === "inbox" ? "Inbox" : tab === "devices" ? "Devices" : "Vault"}</h1>
          <p>{status} · {v1Items.length + alphaItems.length} items</p>
        </div>
        <div className="actions">
          <button type="button" className={tab === "inbox" ? "active" : ""} onClick={() => setTab("inbox")}>
            Inbox
          </button>
          <button type="button" className={tab === "devices" ? "active" : ""} onClick={() => setTab("devices")}>
            Devices ({devices.filter(d => onlineIds.has(d.id)).length}/{devices.length})
          </button>
          <button type="button" className={tab === "vault" ? "active" : ""} onClick={() => setTab("vault")}>
            Vault
          </button>
        </div>
      </section>

      {tab === "inbox" ? (
        <>
          <section className="composer">
            <textarea
              value={text}
              onChange={event => setText(event.target.value)}
              placeholder="Share text to your devices..."
            />
            <div className="actions">
              <label className="fileButton">
                Share file
                <input
                  type="file"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) { void shareFile(file); }
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button type="button" onClick={() => void shareText()}>Share text</button>
            </div>
          </section>

          <section className="inbox">
            {v1Items.length === 0 && alphaItems.length === 0 ? (
              <p className="empty">No items yet. Drop something in.</p>
            ) : null}
            {v1Items.map(item => (
              <ConflictAwareItem
                key={item.id}
                item={item}
                conflicts={conflicts.get(item.id)}
                onShowConflicts={() => void showConflicts(item)}
                onResolve={(copyId, keepBoth) => void resolveConflict(item.id, copyId, keepBoth)}
                renderContent={() => (
                  <>
                    <span className="kind">{item.type}</span>
                    <h2>{item.title}</h2>
                    <p>{isFileItem(item) ? item.title : item.content}</p>
                    <small>{item.createdBy} · {new Date(item.createdAt).toLocaleString()}</small>
                    {isFileItem(item) && item.content?.startsWith("data:") ? (
                      <a href={item.content} download={item.title ?? "mydrop-file"}>Download</a>
                    ) : null}
                  </>
                )}
              />
            ))}
            {alphaItems.map(item => (
              <article className="item" key={item.id}>
                <div>
                  <span className="kind">{item.kind}</span>
                  <h2>{item.title}</h2>
                  <p>{item.body ?? item.fileName}</p>
                  <small>{item.sourceDevice} · {new Date(item.createdAt).toLocaleString()}</small>
                </div>
                {item.fileDataUrl ? (
                  <a href={item.fileDataUrl} download={item.fileName ?? "mydrop-file"}>Download</a>
                ) : null}
              </article>
            ))}
          </section>
        </>
      ) : tab === "devices" ? (
        <section className="devices">
          {devices.length === 0 ? <p className="empty">No paired devices.</p> : null}
          {devices.map(d => (
            <article className="item" key={d.id}>
              <div>
                <span className={`statusDot ${onlineIds.has(d.id) ? "online" : "offline"}`} />
                <h2>{d.name}</h2>
                <p className={onlineIds.has(d.id) ? "statusOnline" : "statusOffline"}>
                  {onlineIds.has(d.id) ? "Online" : "Offline"}
                </p>
                <small>
                  {d.status} · {d.trustedAt ? `trusted ${new Date(d.trustedAt).toLocaleDateString()}` : ""}
                  {d.lastSeen ? ` · last seen ${new Date(d.lastSeen).toLocaleString()}` : ""}
                </small>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="vault">
          <div className="composer">
            <h2>Vault Settings</h2>
            <p>
              Status: <strong>{vaultState.mode === "passphrase" ? "Passphrase-protected" : "Auto-generated key"}</strong>
            </p>
            {vaultMessage ? <p className="vaultMessage">{vaultMessage}</p> : null}

            {vaultState.mode === "passphrase" ? (
              <div className="vaultActions">
                <p>Your vault is secured with a passphrase. To switch to an auto-generated key:</p>
                <button type="button" onClick={() => void disableVaultPassphrase()}>
                  Disable passphrase
                </button>
              </div>
            ) : (
              <div className="vaultActions">
                <p>Set a passphrase to encrypt your local vault:</p>
                <input
                  type="password"
                  placeholder="New passphrase (min 4 chars)"
                  value={vaultPassphrase}
                  onChange={e => setVaultPassphrase(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Confirm passphrase"
                  value={vaultConfirmPassphrase}
                  onChange={e => setVaultConfirmPassphrase(e.target.value)}
                />
                <button type="button" onClick={() => void enableVaultPassphrase()}>
                  Enable Passphrase
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function ConflictAwareItem(props: {
  item: Item;
  conflicts: ConflictedCopyView[] | undefined;
  onShowConflicts: () => void;
  onResolve: (copyId: string, keepBoth: boolean) => void;
  renderContent: () => React.ReactNode;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={`item ${props.conflicts ? "conflicted" : ""}`}>
      <div>
        {props.conflicts ? (
          <span className="conflictBadge">⚠ {props.conflicts.length} conflict{props.conflicts.length > 1 ? "s" : ""}</span>
        ) : null}
        {props.renderContent()}
      </div>
      {props.conflicts ? (
        <div>
          <button type="button" onClick={() => { props.onShowConflicts(); setExpanded(!expanded); }}>
            {expanded ? "Hide" : "Resolve"}
          </button>
          {expanded ? (
            <div className="conflictSheet">
              {props.conflicts.map(c => (
                <div key={c.id} className="conflictCopy">
                  <p>{c.content ?? "(file)"}</p>
                  <small>from {c.losingDevice}</small>
                  <div className="actions">
                    <button type="button" onClick={() => props.onResolve(c.id, false)}>Accept</button>
                    <button type="button" onClick={() => props.onResolve(c.id, true)}>Keep both</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

async function postJson(path: string, body: unknown): Promise<void> {
  await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") { resolve(reader.result); return; }
      reject(new Error("FileReader did not return a data URL."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("File read failed.")));
    reader.readAsDataURL(file);
  });
}

createRoot(document.querySelector("#root")!).render(<App />);
