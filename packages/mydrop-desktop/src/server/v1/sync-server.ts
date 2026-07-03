import { SyncEngine } from "@mydrop/core";
import type { DatabaseClient } from "@mydrop/core";
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { SyncPeer } from "./sync-peer.js";

export type OnPeersChanged = (onlineIds: string[]) => void;

export class SyncServer {
  readonly #engine: SyncEngine;
  readonly #wss: WebSocketServer;
  readonly #peers = new Map<string, SyncPeer>();
  readonly #onPeersChangedCallbacks: OnPeersChanged[] = [];

  public constructor(
    httpServer: HttpServer,
    db: DatabaseClient,
    deviceId: string,
  ) {
    this.#engine = new SyncEngine(db, deviceId);
    this.#wss = new WebSocketServer({ server: httpServer, path: "/sync" });

    this.#wss.on("connection", (socket: WebSocket) => {
      const peer = new SyncPeer(socket, this.#engine, {
        onPeerReady: (peerId) => {
          console.log(`[sync] Peer connected: ${peerId}`);
          this.#peers.set(peerId, peer);
          this.#emitPeersChanged();
        },
        onPeerDisconnected: (peerId) => {
          console.log(`[sync] Peer disconnected: ${peerId}`);
          this.#peers.delete(peerId);
          this.#emitPeersChanged();
        },
      });
      peer.start();
    });
  }

  public get engine(): SyncEngine {
    return this.#engine;
  }

  get onlineDeviceIds(): string[] {
    return Array.from(this.#peers.keys());
  }

  public onPeersChanged(callback: OnPeersChanged): void {
    this.#onPeersChangedCallbacks.push(callback);
  }

  #emitPeersChanged(): void {
    const ids = this.onlineDeviceIds;
    for (const cb of this.#onPeersChangedCallbacks) {
      cb(ids);
    }
  }

  public async broadcastEvents(events: readonly import("@mydrop/core").SyncEvent[]): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const peer of this.#peers.values()) {
      promises.push(peer.sendEvents(events));
    }
    await Promise.all(promises);
  }

  public close(): void {
    for (const peer of this.#peers.values()) {
      peer.close();
    }
    this.#peers.clear();
    this.#wss.close();
  }
}
