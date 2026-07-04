import type { AlphaItem, Item } from "@mydrop/core";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./styles.css";
import type { QuickShareItem } from "./QuickShare.js";
import { useQuickShare } from "./QuickShare.js";

const env = import.meta.env as Readonly<Record<string, string | undefined>>;
const apiBase = env["VITE_MYDROP_ALPHA_API"] ?? "http://127.0.0.1:4317";
const sourceDevice = "desktop-alpha";

type Page = "inbox" | "devices";

interface DeviceEntry {
  id: string;
  name: string;
  status: string;
  online: boolean;
  trustedAt: number | null;
  lastSeen: number | null;
}

interface PairingSession {
  deviceId: string;
  pairingCode: string;
}

interface ConflictedCopyView {
  id: string;
  content: string | null;
  losingDevice: string;
  createdAt: number;
}

type ItemTypeLabel = "text" | "link" | "file" | "image" | "voice";
const TYPE_ORDER: ItemTypeLabel[] = ["text", "link", "file", "image", "voice"];

function App(): React.ReactElement {
  const [page, setPage] = useState<Page>("inbox");
  const [alphaItems, setAlphaItems] = useState<AlphaItem[]>([]);
  const [v1Items, setV1Items] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Map<string, ConflictedCopyView[]>>(new Map());
  const [filterType, setFilterType] = useState<ItemTypeLabel | "all">("all");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [pairing, setPairing] = useState<PairingSession | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  const socket = useMemo(() => io(apiBase, { transports: ["websocket", "polling"] }), []);

  const quickShare = useQuickShare(
    (text) => { void shareText(text); },
    (file) => { void shareFile(file); },
  );

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

  async function initiatePairing(): Promise<void> {
    setPairingLoading(true);
    try {
      const res = await fetch(`${apiBase}/v1/pairing/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: `desktop_${Date.now().toString(36)}`,
          deviceName: "Desktop",
        }),
      });
      if (!res.ok) throw new Error("Pairing request failed");
      const data = (await res.json()) as { pairingCode: string };
      setPairing({
        deviceId: `desktop_${Date.now().toString(36)}`,
        pairingCode: data.pairingCode,
      });
    } catch {
      // ignore
    } finally {
      setPairingLoading(false);
    }
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

  async function shareText(overrideText?: string): Promise<void> {
    const body = (overrideText ?? text).trim();
    if (body.length === 0) return;
    await postJson("/items/text", { body, sourceDevice });
    if (!overrideText) setText("");
  }

  async function shareFile(file: QuickShareItem | File): Promise<void> {
    let fileName: string;
    let fileSize: number;
    let mimeType: string | null;
    let fileDataUrl: string;

    if ("dataUrl" in file && "fileName" in file) {
      fileName = file.fileName;
      fileSize = file.fileSize;
      mimeType = file.mimeType;
      fileDataUrl = file.dataUrl;
    } else {
      fileName = file.name;
      fileSize = file.size;
      mimeType = file.type || null;
      fileDataUrl = await readFileAsDataUrl(file);
    }
    await postJson("/items/file", {
      fileName,
      fileUri: `desktop://${fileName}`,
      fileDataUrl,
      fileSize,
      mimeType,
      sourceDevice,
    });
  }

  async function showConflicts(item: Item): Promise<void> {
    const copies = await checkConflicts(item.id);
    if (!copies || copies.length === 0) return;
    setConflicts(prev => new Map(prev).set(item.id, copies));
  }

  const allItems: Item[] = [...v1Items, ...alphaItems.map(a => ({
    id: a.id,
    type: a.kind,
    title: a.title ?? "",
    content: a.body ?? a.fileName ?? null,
    fileId: null,
    createdAt: a.createdAt,
    createdBy: a.sourceDevice,
    updatedAt: a.createdAt,
    versionVector: {},
    deleted: false,
  }))];

  const filteredItems = filterType === "all"
    ? allItems
    : allItems.filter(i => i.type === filterType);

  function handleSelectItem(item: Item): void {
    setSelectedItem(item);
  }

  function formatDate(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  }

  return (
    <div className={`shell${selectedItem ? " hasDetail" : ""}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebarLogo">
          <div className="logoIcon">📥</div>
          <span>MyDrop</span>
        </div>
        <nav className="sidebarNav">
          <button
            type="button"
            className={`navBtn${page === "inbox" ? " active" : ""}`}
            onClick={() => { setPage("inbox"); setSelectedItem(null); }}
          >
            <span className="navIcon">📥</span>
            <span>Inbox</span>
          </button>
          <button
            type="button"
            className={`navBtn${page === "devices" ? " active" : ""}`}
            onClick={() => setPage("devices")}
          >
            <span className="navIcon">📱</span>
            <span>Devices</span>
            <span className="navBadge">{devices.filter(d => onlineIds.has(d.id)).length}/{devices.length}</span>
          </button>
        </nav>
        <div className="sidebarFooter">
          <div className={`statusDot ${status === "Connected" ? "online" : "offline"}`} />
          <span className="statusLabel">{status}</span>
          <button type="button" className="shareShortcut" onClick={quickShare.show} title="Quick share (Ctrl+Shift+M)">+</button>
        </div>
      </aside>

      {/* Inbox panel */}
      {page === "inbox" && (
        <div className="inboxPanel">
          {/* Header */}
          <div className="panelHeader">
            <h1 className="panelTitle">Inbox</h1>
            <span className="panelCount">{allItems.length} items</span>
          </div>

          {/* Filter pills */}
          <div className="filterRow">
            {(["all", ...TYPE_ORDER] as const).map(t => (
              <button
                key={t}
                type="button"
                className={`filterPill${filterType === t ? " active" : ""}`}
                onClick={() => setFilterType(t)}
              >
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Composer */}
          <div className="composer">
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
              <button type="button" className="btnPrimary" onClick={() => void shareText()}>Share text</button>
            </div>
          </div>

          {/* Item list */}
          <div className="itemList">
            {filteredItems.length === 0 ? (
              <p className="emptyState">No items yet. Drop something in.</p>
            ) : null}
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`itemRow${selectedItem?.id === item.id ? " selected" : ""}${conflicts.has(item.id) ? " conflicted" : ""}`}
                onClick={() => handleSelectItem(item)}
              >
                <div className="itemBadgeWrap">
                  <span className={`itemBadge ${item.type}`}>
                    {item.type === "text" ? "T" : item.type === "link" ? "L" : item.type === "file" ? "F" : item.type === "image" ? "I" : item.type === "voice" ? "V" : "?"}
                  </span>
                </div>
                <div className="itemBody">
                  <div className="itemTitleRow">
                    <span className="itemTitle">{item.title || "(untitled)"}</span>
                    {conflicts.has(item.id) && <span className="conflictTag">Conflict</span>}
                  </div>
                  <div className="itemMeta">
                    <span className="itemType">{item.type}</span>
                    <span className="itemDot">·</span>
                    <span className="itemTime">{formatDate(item.createdAt)}</span>
                    <span className="itemDot">·</span>
                    <span className="itemFrom">{item.createdBy}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail panel */}
      {page === "inbox" && selectedItem && (
        <DetailPanel
          item={selectedItem}
          conflicts={conflicts.get(selectedItem.id)}
          onResolve={(copyId, keepBoth) => void resolveConflict(selectedItem.id, copyId, keepBoth)}
          onBack={() => setSelectedItem(null)}
          onShowConflicts={() => void showConflicts(selectedItem)}
        />
      )}

      {quickShare.popup}

      {/* Devices page */}
      {page === "devices" && (
        <div className="inboxPanel">
          <div className="panelHeader">
            <h1 className="panelTitle">Devices</h1>
            <span className="panelCount">{devices.length} paired</span>
          </div>
          <div className="deviceGrid">
            {devices.length === 0 ? <p className="emptyState">No paired devices.</p> : null}
            {devices.map(d => (
              <div key={d.id} className="deviceCard">
                <div className="deviceCardHeader">
                  <span className={`statusDot ${onlineIds.has(d.id) ? "online" : "offline"}`} />
                  <span className="deviceName">{d.name}</span>
                </div>
                <div className="deviceStats">
                  <div className="stat">
                    <span className="statValue">{onlineIds.has(d.id) ? "Online" : "Offline"}</span>
                    <span className="statLabel">Status</span>
                  </div>
                  <div className="stat">
                    <span className="statValue">{d.status}</span>
                    <span className="statLabel">Version</span>
                  </div>
                  <div className="stat">
                    <span className="statValue">{d.trustedAt ? new Date(d.trustedAt).toLocaleDateString() : "—"}</span>
                    <span className="statLabel">Trusted</span>
                  </div>
                </div>
              </div>
            ))}
            <div
              className="deviceCard addDevice"
              onClick={() => void initiatePairing()}
              style={{ cursor: pairingLoading ? "wait" : "pointer" }}
            >
              <span className="addDeviceIcon">{pairingLoading ? "..." : "+"}</span>
              <span>{pairingLoading ? "Starting..." : "Pair new device"}</span>
            </div>
          </div>

          {pairing && (
            <div className="pairingModal" onClick={() => setPairing(null)}>
              <div className="pairingModalContent" onClick={e => e.stopPropagation()}>
                <div className="pairingModalHeader">
                  <h2>Pair New Device</h2>
                  <button type="button" className="closeBtn" onClick={() => setPairing(null)}>×</button>
                </div>
                <p className="pairingInstructions">
                  Enter this 6-digit code on your mobile device to complete pairing.
                </p>
                <div className="pairingCodeDisplay">
                  {pairing.pairingCode.split("").map((digit, i) => (
                    <span key={i} className="pairingDigit">{digit}</span>
                  ))}
                </div>
                <p className="pairingExpiry">Code expires in 5 minutes</p>
                <button
                  type="button"
                  className="btnSecondary"
                  onClick={() => { navigator.clipboard.writeText(pairing.pairingCode); }}
                >
                  Copy code
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailPanel(props: {
  item: Item;
  conflicts: ConflictedCopyView[] | undefined;
  onResolve: (copyId: string, keepBoth: boolean) => void;
  onBack: () => void;
  onShowConflicts: () => void;
}): React.ReactElement {
  const [resolved, setResolved] = useState(false);

  function handleResolve(copyId: string, keepBoth: boolean): void {
    props.onResolve(copyId, keepBoth);
    setResolved(true);
  }

  return (
    <div className="detailPanel">
      <button type="button" className="backBtn" onClick={props.onBack}>← Back</button>

      <div className="detailIconArea">
        <div className="detailIcon">
          {props.item.type === "text" ? "T" : props.item.type === "link" ? "L" : props.item.type === "file" ? "F" : props.item.type === "image" ? "I" : "V"}
        </div>
      </div>

      <div className="detailMeta">
        <div className="metaGrid">
          <div className="metaItem">
            <span className="metaLabel">Title</span>
            <span className="metaValue">{props.item.title}</span>
          </div>
          <div className="metaItem">
            <span className="metaLabel">Type</span>
            <span className="metaValue">{props.item.type}</span>
          </div>
          <div className="metaItem">
            <span className="metaLabel">From</span>
            <span className="metaValue">{props.item.createdBy}</span>
          </div>
          <div className="metaItem">
            <span className="metaLabel">Time</span>
            <span className="metaValue">{new Date(props.item.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="detailContent">
        <p>{props.item.content || "(no content)"}</p>
      </div>

      <div className="detailActions">
        <button type="button" className="btnPrimary">Download</button>
        <button type="button" className="btnSecondary">Share</button>
        <button type="button" className="btnDanger">Delete</button>
      </div>

      {props.conflicts && !resolved ? (
        <div className="conflictSection">
          <div className="conflictBanner">⚠ Conflict — {props.conflicts.length} conflicting versions</div>
          <div className="conflictCards">
            {props.conflicts.map(c => (
              <div key={c.id} className="conflictCard">
                <div className="conflictCardHeader">
                  <span className="conflictVersion">v{c.id}</span>
                  <span className="conflictDevice">{c.losingDevice}</span>
                </div>
                <p className="conflictContent">{c.content || "(file)"}</p>
                <div className="conflictCardActions">
                  <button type="button" className="btnSmall" onClick={() => handleResolve(c.id, false)}>Keep this</button>
                  <button type="button" className="btnSmallSecondary" onClick={() => handleResolve(c.id, true)}>Keep both</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : props.conflicts && resolved ? (
        <div className="resolvedBanner">✓ Resolved</div>
      ) : null}
    </div>
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
