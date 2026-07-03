import {
  hlcToCursor,
  parseSyncMessage,
  type HLC,
  type SyncEngine,
  type SyncProtocolMessage,
} from "@mydrop/core";

export type SyncPeerStatus = "disconnected" | "connecting" | "syncing" | "ready";

export interface SyncPeerCallbacks {
  onStatusChange?: (status: SyncPeerStatus) => void;
  onSyncComplete?: (applied: number, conflicted: number) => void;
  onError?: (error: Error) => void;
}

export class SyncPeerClient {
  readonly #engine: SyncEngine;
  readonly #callbacks: SyncPeerCallbacks;
  readonly #deviceId: string;
  #ws: WebSocket | null = null;
  #status: SyncPeerStatus = "disconnected";

  public constructor(engine: SyncEngine, callbacks: SyncPeerCallbacks = {}) {
    this.#engine = engine;
    this.#deviceId = engine.deviceId;
    this.#callbacks = callbacks;
  }

  get status(): SyncPeerStatus {
    return this.#status;
  }

  connect(apiBase: string): void {
    this.disconnect();

    const wsUrl = apiBase.replace(/^http/, "ws") + "/sync";
    this.#setStatus("connecting");

    this.#ws = new WebSocket(wsUrl);

    this.#ws.onopen = () => {
      void this.#sendHello();
    };

    this.#ws.onmessage = (event: MessageEvent) => {
      void this.#handleMessage(event.data as string);
    };

    this.#ws.onclose = () => {
      this.#setStatus("disconnected");
    };

    this.#ws.onerror = () => {
      this.#setStatus("disconnected");
    };
  }

  disconnect(): void {
    if (this.#ws) {
      this.#ws.onopen = null;
      this.#ws.onmessage = null;
      this.#ws.onclose = null;
      this.#ws.onerror = null;
      this.#ws.close();
      this.#ws = null;
    }
    this.#setStatus("disconnected");
  }

  #setStatus(status: SyncPeerStatus): void {
    this.#status = status;
    this.#callbacks.onStatusChange?.(status);
  }

  async #sendHello(): Promise<void> {
    this.#setStatus("syncing");

    const cursor = await this.#engine.getSyncCursor(this.#deviceId);
    this.#send({
      type: "sync.hello",
      deviceId: this.#deviceId,
      cursor: cursor ? hlcToCursor(cursor) : null,
    });
  }

  async #handleMessage(raw: string): Promise<void> {
    let msg: SyncProtocolMessage;
    try {
      msg = parseSyncMessage(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case "sync.request_since": {
        const cursor: HLC = {
          physical: msg.since.physical,
          counter: msg.since.counter,
          deviceId: this.#deviceId,
        };
        const events = await this.#engine.getEventsSince(cursor);
        if (events.length > 0) {
          this.#send({ type: "sync.events", events });
        }
        break;
      }
      case "sync.events": {
        const result = await this.#engine.applyRemoteEvents([
          ...msg.events,
        ]);
        this.#send({ type: "sync.ack", count: result.applied });
        this.#callbacks.onSyncComplete?.(result.applied, result.conflicted);
        break;
      }
      case "sync.hello": {
        const peerCursor = msg.cursor
          ? {
              physical: msg.cursor.physical,
              counter: msg.cursor.counter,
              deviceId: msg.deviceId,
            }
          : null;
        const ourEvents = await this.#engine.getEventsSince(peerCursor);
        if (ourEvents.length > 0) {
          this.#send({ type: "sync.events", events: ourEvents });
        }
        this.#setStatus("ready");
        break;
      }
      case "sync.ack":
        this.#setStatus("ready");
        break;
    }
  }

  #send(msg: SyncProtocolMessage): void {
    if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(msg));
    }
  }
}
