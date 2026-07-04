import type { CreateAlphaFileItem, CreateAlphaTextItem, ItemType } from "@mydrop/core";
import { ContentStore, sha256, createApiRouter } from "@mydrop/core";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import Database from "better-sqlite3";
import { Server } from "socket.io";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { AlphaDesktopStore } from "./alpha-store.js";
import { BetterSqlite3Client } from "./v1/adapter.js";
import { migrateV1 } from "./v1/migrate.js";
import { SyncServer } from "./v1/sync-server.js";
import { NodeChunkStore } from "./v1/chunk-store.js";
import { MdnsAdvertiser } from "./v1/mdns-advertiser.js";
import { PairingHandler } from "./v1/pairing-handler.js";
import { hasTlsCredentials, readTlsCredentials, tryGenerateSelfSignedCert } from "./v1/tls.js";

const port = Number.parseInt(process.env.MYDROP_ALPHA_PORT ?? "4317", 10);
const store = new AlphaDesktopStore();

const v1DbPath = process.env.MYDROP_V1_DB ?? join(homedir(), ".mydrop", "v1.sqlite");
const filesDir = process.env.MYDROP_FILES_DIR ?? join(homedir(), ".mydrop", "files");
mkdirSync(dirname(v1DbPath), { recursive: true });
mkdirSync(filesDir, { recursive: true });
const v1Db = new Database(v1DbPath);
const v1Client = new BetterSqlite3Client(v1Db);
await migrateV1(v1Client);
const deviceId = process.env.MYDROP_DEVICE_ID ?? `desktop_${Date.now().toString(36)}`;

const fileStore = new ContentStore(v1Client, new NodeChunkStore(filesDir), sha256);
const pairingHandler = new PairingHandler(v1Client);

// eslint-disable-next-line prefer-const -- handler is captured in closures before assignment
let handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

const useTls = process.env.MYDROP_TLS === "1" && hasTlsCredentials();
let server: ReturnType<typeof createHttpServer>;

if (useTls) {
  const creds = await readTlsCredentials();
  server = createHttpsServer({ key: creds.key, cert: creds.cert }, (req, res) => { void handler(req, res); });
  console.log("[tls] Using self-signed certificate");
} else {
  if (process.env.MYDROP_TLS === "1" && !hasTlsCredentials()) {
    console.log("[tls] No TLS credentials found, attempting to generate...");
    const ok = await tryGenerateSelfSignedCert();
    if (ok) {
      const creds = await readTlsCredentials();
      server = createHttpsServer({ key: creds.key, cert: creds.cert }, (req, res) => { void handler(req, res); });
      console.log("[tls] Generated self-signed certificate");
    } else {
      console.log("[tls] openssl not available, falling back to HTTP");
      server = createHttpServer((req, res) => { void handler(req, res); });
    }
  } else {
    server = createHttpServer((req, res) => { void handler(req, res); });
  }
}
const syncServer = new SyncServer(server, v1Client, deviceId);
const restRouter = createApiRouter(syncServer.engine, v1Client, fileStore);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", async (socket) => {
  socket.emit("items:snapshot", store.listItems());
  socket.emit("v1:snapshot", await syncServer.engine.listItems());
  socket.emit("devices:online", syncServer.onlineDeviceIds);
});

syncServer.onPeersChanged((onlineIds) => {
  io.emit("devices:online", onlineIds);
});

const V1_FILE_RE = new RegExp("^/v1/files/([^/]+)$");
const V1_FILE_CHUNKS_RE = new RegExp("^/v1/files/([^/]+)/chunks$");
const V1_FILE_CHUNK_RE = new RegExp("^/v1/files/([^/]+)/chunks/(\\d+)$");
const V1_FILE_DOWNLOAD_RE = new RegExp("^/v1/files/([^/]+)/download$");
const V1_FILE_COMPLETE_RE = new RegExp("^/v1/files/([^/]+)/complete$");
const V1_ITEM_CONFLICTS_RE = new RegExp("^/v1/items/([^/]+)/conflicts$");
const V1_ITEM_RESOLVE_RE = new RegExp("^/v1/items/([^/]+)/resolve$");

// REST router dispatch
async function dispatchRestRouter(
  router: ReturnType<typeof createApiRouter>,
  method: string,
  path: string,
  query: Record<string, string>,
  request: IncomingMessage,
): Promise<{ status: number; body?: unknown; error?: { code: string; message: string } } | null> {
  try {
    // Items
    if (path === "/api/items" && method === "GET") {
      const q: Record<string, string> = {};
      if (query.type) q.type = query.type;
      if (query.tag) q.tag = query.tag;
      if (query.q) q.q = query.q;
      if (query.cursor) q.cursor = query.cursor;
      return await router.items.list(q);
    }
    if (path === "/api/items" && method === "POST") {
      const body = await readJson(request);
      return await router.items.create(body as { type: string; content?: string | null; fileId?: string | null; title?: string });
    }
    if (path.startsWith("/api/items/") && method === "PATCH") {
      const id = path.split("/")[3]!;
      const body = await readJson(request);
      return await router.items.update(id, body as { content?: string; tags?: string[] });
    }
    if (path.startsWith("/api/items/") && method === "DELETE") {
      const id = path.split("/")[3]!;
      return await router.items.remove(id);
    }
    if (path.startsWith("/api/items/") && path.endsWith("/conflicts") && method === "GET") {
      const id = path.split("/")[3]!;
      return await router.items.listConflicts(id);
    }
    if (path.startsWith("/api/items/") && path.endsWith("/resolve") && method === "POST") {
      const id = path.split("/")[3]!;
      const body = await readJson(request);
      return await router.items.resolve(id, body as { keep: "local" | "remote" | "both" });
    }

    // Devices
    if (path === "/api/devices" && method === "GET") {
      return await router.devices.list();
    }
    if (path === "/api/devices/pairing" && method === "POST") {
      const body = await readJson(request);
      return await router.devices.initiatePairing(body as { deviceName: string });
    }
    if (path.startsWith("/api/devices/") && path.endsWith("/pairing/confirm") && method === "POST") {
      const deviceId = path.split("/")[3]!;
      const body = await readJson(request);
      return await router.devices.confirmPairing(deviceId, body as { pairingCode: string; deviceName: string });
    }
    if (path.startsWith("/api/devices/") && path.endsWith("/revoke") && method === "POST") {
      const deviceId = path.split("/")[3]!;
      return await router.devices.revoke(deviceId);
    }

    // Files
    if (path.startsWith("/api/files/") && method === "GET") {
      const fileId = path.split("/")[3]!;
      return await router.files.getFile(fileId);
    }
    if (path.startsWith("/api/files/") && path.match(/\/chunks\/\d+$/) && method === "GET") {
      const parts = path.split("/");
      const fileId = parts[3]!;
      const chunkIndex = Number.parseInt(parts[5]!, 10);
      return await router.files.getChunk(fileId, chunkIndex);
    }

    // Share
    if (path === "/api/share" && method === "POST") {
      const body = await readJson(request);
      return await router.share.share(body as { type: string; content?: string; fileId?: string; title?: string });
    }

    // Health
    if (path === "/api/health" && method === "GET") {
      return await router.health.getHealth();
    }

    return null;
  } catch {
    return null;
  }
}

handler = async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "content-type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE,PATCH");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  // Try REST router first
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  const path = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());

  const restResult = await dispatchRestRouter(restRouter, request.method ?? "GET", path, query, request);
  if (restResult) {
    sendJson(response, restResult.status, "body" in restResult ? restResult.body : { error: restResult.error });
    return;
  }

  try {
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "mydrop-alpha",
        itemCount: store.listItems().length,
        v1ItemCount: (await syncServer.engine.listItems()).length,
        deviceId,
      });
      return;
    }

    if (request.method === "GET" && request.url === "/items") {
      sendJson(response, 200, store.listItems());
      return;
    }

    if (request.method === "GET" && request.url === "/v1/items") {
      sendJson(response, 200, await syncServer.engine.listItems());
      return;
    }

    if (request.method === "POST" && request.url === "/v1/items") {
      const input = (await readJson(request)) as Record<string, unknown>;
      const item = await syncServer.engine.createItem({
        type: (input.type as ItemType) ?? "text",
        title: (input.title as string) ?? "",
        content: (input.content as string | null) ?? null,
        fileId: (input.fileId as string | null) ?? null,
      });
      io.emit("v1:item:created", item);
      sendJson(response, 201, item);
      return;
    }

    if (request.method === "POST" && request.url === "/items/text") {
      const input = (await readJson(request)) as CreateAlphaTextItem;
      const item = store.createTextItem(input);
      io.emit("item:created", item);
      sendJson(response, 201, item);
      return;
    }

    if (request.method === "POST" && request.url === "/items/file") {
      const input = (await readJson(request)) as CreateAlphaFileItem;
      const item = store.createFileItem(input);
      io.emit("item:created", item);
      sendJson(response, 201, item);
      return;
    }

    // ===== File Chunking Endpoints =====

    if (request.method === "POST" && request.url === "/v1/files") {
      const data = await readBody(request);
      const mimeType = request.headers["content-type"] ?? undefined;
      const file = await fileStore.storeFile(data, mimeType === "application/octet-stream" ? undefined : mimeType);
      sendJson(response, 201, file);
      return;
    }

    const getMatch = request.url ? V1_FILE_RE.exec(request.url) : null;
    if (request.method === "GET" && getMatch) {
      const fileId = getMatch[1]!;
      const file = await fileStore.getFile(fileId);
      if (!file) { sendJson(response, 404, { error: "File not found" }); return; }
      sendJson(response, 200, file);
      return;
    }

    const chunksMatch = request.url ? V1_FILE_CHUNKS_RE.exec(request.url) : null;
    if (request.method === "GET" && chunksMatch) {
      const fileId = chunksMatch[1]!;
      const allChunks = await fileStore.getChunks(fileId);
      const missing = await fileStore.getMissingChunks(fileId);
      sendJson(response, 200, { chunks: allChunks, missingIndexes: missing });
      return;
    }

    const chunkMatch = request.url ? V1_FILE_CHUNK_RE.exec(request.url) : null;
    if (chunkMatch) {
      const fileId = chunkMatch[1]!;
      const chunkIndex = Number.parseInt(chunkMatch[2]!, 10);

      if (request.method === "GET") {
        const data = await fileStore.getChunkData(fileId, chunkIndex);
        if (!data) { sendJson(response, 404, { error: "Chunk not found" }); return; }
        response.writeHead(200, { "content-type": "application/octet-stream" });
        response.end(Buffer.from(data));
        return;
      }

      if (request.method === "POST") {
        const data = await readBody(request);
        await fileStore.storeChunk(fileId, chunkIndex, data);
        sendJson(response, 200, { ok: true });
        return;
      }
    }

    const downloadMatch = request.url ? V1_FILE_DOWNLOAD_RE.exec(request.url) : null;
    if (request.method === "GET" && downloadMatch) {
      const fileId = downloadMatch[1]!;
      const data = await fileStore.reconstructFile(fileId);
      if (!data) { sendJson(response, 404, { error: "File not found or incomplete" }); return; }
      const file = await fileStore.getFile(fileId);
      response.writeHead(200, {
        "content-type": file?.mimeType ?? "application/octet-stream",
        "content-length": data.length,
      });
      response.end(Buffer.from(data));
      return;
    }

    const completeMatch = request.url ? V1_FILE_COMPLETE_RE.exec(request.url) : null;
    if (request.method === "POST" && completeMatch) {
      const fileId = completeMatch[1]!;
      await fileStore.markComplete(fileId);
      sendJson(response, 200, { ok: true });
      return;
    }

    // ===== Conflict Resolution Endpoints =====

    const conflictsMatch = request.url ? V1_ITEM_CONFLICTS_RE.exec(request.url) : null;
    if (request.method === "GET" && conflictsMatch) {
      const itemId = conflictsMatch[1]!;
      const copies = await syncServer.engine.getConflictedCopies(itemId);
      sendJson(response, 200, { conflicts: copies.map(c => ({
        id: c.id,
        content: c.content,
        losingDevice: c.losingDevice,
        createdAt: c.createdAt,
      })) });
      return;
    }

    const resolveMatch = request.url ? V1_ITEM_RESOLVE_RE.exec(request.url) : null;
    if (request.method === "POST" && resolveMatch) {
      const itemId = resolveMatch[1]!;
      const input = (await readJson(request)) as { copyId: string; keepBoth: boolean };
      await syncServer.engine.resolveConflict(itemId, input.copyId, input.keepBoth);
      sendJson(response, 200, { ok: true });
      return;
    }

    // ===== Pairing Endpoints =====

    if (request.method === "POST" && request.url === "/v1/pairing/request") {
      const input = (await readJson(request)) as { deviceId: string; deviceName: string };
      const result = await pairingHandler.initiatePairing(input.deviceId, input.deviceName);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && request.url === "/v1/pairing/confirm") {
      const input = (await readJson(request)) as {
        deviceId: string;
        pairingCode: string;
        deviceName: string;
      };
      const ok = await pairingHandler.confirmPairing(
        input.deviceId,
        input.pairingCode,
        input.deviceName,
      );
      if (!ok) {
        sendJson(response, 400, { error: "Invalid or expired pairing code" });
        return;
      }
      io.emit("device:trusted", { deviceId: input.deviceId, deviceName: input.deviceName });
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && request.url === "/v1/devices") {
      const devices = await pairingHandler.listDevices();
      const onlineIds = new Set(syncServer.onlineDeviceIds);
      const devicesWithStatus = devices.map((d) => ({
        ...d,
        online: onlineIds.has(d.id),
      }));
      sendJson(response, 200, { devices: devicesWithStatus });
      return;
    }

    if (request.method === "POST" && request.url?.startsWith("/v1/devices/") && request.url.endsWith("/revoke")) {
      const deviceId = request.url.split("/")[3]!;
      const ok = await pairingHandler.revokeDevice(deviceId);
      if (!ok) { sendJson(response, 404, { error: "Device not found or already revoked" }); return; }
      io.emit("device:revoked", { deviceId });
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    sendJson(response, 500, { error: message });
  }
};

const GC_INTERVAL_MS = 60 * 60 * 1000;
let gcTimer: ReturnType<typeof setInterval> | null = null;

const mdns = new MdnsAdvertiser(port);
server.listen(port, "0.0.0.0", () => {
  console.log(`MyDrop Alpha API listening on http://0.0.0.0:${port}`);
  mdns.start();
  console.log(`[mdns] Advertising _mydrop._tcp.local on port ${port}`);
  gcTimer = setInterval(() => {
    void syncServer.engine.gcTombstones().then(count => {
      if (count > 0) console.log(`[gc] Reclaimed ${count} tombstones`);
    });
  }, GC_INTERVAL_MS);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown(): void {
  if (gcTimer) clearInterval(gcTimer);
  mdns.stop();
  void io.close();
  syncServer.close();
  server.close();
  store.close();
  v1Db.close();
  process.exit(0);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const body = await readBody(request);
  return body.length === 0 ? {} : JSON.parse(Buffer.from(body).toString("utf8"));
}

async function readBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    const piece = chunk as string | Uint8Array;
    chunks.push(typeof piece === "string" ? Buffer.from(piece, "utf8") : piece);
  }
  return Buffer.concat(chunks);
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}
