import type { HLC, SyncEngine, SyncEvent } from "@mydrop/core";
import type WebSocket from "ws";
import {
  hlcToCursor,
  parseSyncMessage,
  type SyncProtocolMessage,
} from "@mydrop/core";

export interface PeerEventHandlers {
  readonly onPeerReady: (peerId: string) => void;
  readonly onPeerDisconnected: (peerId: string) => void;
}

export class SyncPeer {
  readonly #socket: WebSocket;
  readonly #engine: SyncEngine;
  readonly #handlers: PeerEventHandlers;
  #peerDeviceId: string | null = null;
  #ready = false;

  public constructor(
    socket: WebSocket,
    engine: SyncEngine,
    handlers: PeerEventHandlers,
  ) {
    this.#socket = socket;
    this.#engine = engine;
    this.#handlers = handlers;
  }

  public get peerDeviceId(): string | null {
    return this.#peerDeviceId;
  }

  public get ready(): boolean {
    return this.#ready;
  }

  public start(): void {
    this.#socket.on("message", (data) => {
      void this.#handleMessage(data.toString());
    });

    this.#socket.on("close", () => {
      if (this.#peerDeviceId) {
        this.#handlers.onPeerDisconnected(this.#peerDeviceId);
      }
    });

    this.#socket.on("error", () => {
      if (this.#peerDeviceId) {
        this.#handlers.onPeerDisconnected(this.#peerDeviceId);
      }
    });

    void this.#sendHello();
  }

  public async sendEvents(events: readonly SyncEvent[]): Promise<void> {
    if (!this.#ready || events.length === 0) return;
    this.#send({ type: "sync.events", events });
  }

  public close(): void {
    try {
      this.#socket.close();
    } catch {
      // ignore close errors
    }
  }

  async #sendHello(): Promise<void> {
    const cursor = await this.#engine.getSyncCursor(this.#engine.deviceId);
    this.#send({
      type: "sync.hello",
      deviceId: this.#engine.deviceId,
      cursor: cursor ? hlcToCursor(cursor) : null,
    });
  }

  async #handleMessage(raw: string): Promise<void> {
    let msg: SyncProtocolMessage;
    try {
      msg = parseSyncMessage(raw);
    } catch (_err) {
      return;
    }

    switch (msg.type) {
      case "sync.hello":
        await this.#handleHello(msg);
        break;
      case "sync.events":
        await this.#handleEvents(msg);
        break;
      case "sync.request_since":
        await this.#handleRequestSince(msg);
        break;
      case "sync.ack":
        break;
    }
  }

  async #handleHello(
    msg: SyncProtocolMessage & { type: "sync.hello" },
  ): Promise<void> {
    this.#peerDeviceId = msg.deviceId;

    const ourCursor = await this.#engine.getSyncCursor(msg.deviceId);
    if (ourCursor) {
      this.#send({
        type: "sync.request_since",
        since: hlcToCursor(ourCursor),
      });
    } else {
      this.#send({
        type: "sync.request_since",
        since: { physical: 0, counter: 0 },
      });
    }

    this.#ready = true;
    this.#handlers.onPeerReady(msg.deviceId);

    const peerCursor = msg.cursor
      ? {
          physical: msg.cursor.physical,
          counter: msg.cursor.counter,
          deviceId: this.#engine.deviceId,
        }
      : null;
    const ourEvents = await this.#engine.getEventsSince(peerCursor);
    if (ourEvents.length > 0) {
      this.#send({ type: "sync.events", events: ourEvents });
    }
  }

  async #handleEvents(
    msg: SyncProtocolMessage & { type: "sync.events" },
  ): Promise<void> {
    const result = await this.#engine.applyRemoteEvents([
      ...msg.events,
    ]);
    this.#send({ type: "sync.ack", count: result.applied });
  }

  async #handleRequestSince(
    msg: SyncProtocolMessage & { type: "sync.request_since" },
  ): Promise<void> {
    const cursor: HLC = {
      physical: msg.since.physical,
      counter: msg.since.counter,
      deviceId: this.#engine.deviceId,
    };
    const events = await this.#engine.getEventsSince(cursor);
    if (events.length > 0) {
      this.#send({ type: "sync.events", events });
    }
  }

  #send(msg: SyncProtocolMessage): void {
    if (this.#socket.readyState === this.#socket.OPEN) {
      this.#socket.send(JSON.stringify(msg));
    }
  }
}
