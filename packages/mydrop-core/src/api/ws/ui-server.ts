import type { SyncEngine } from "../../sync/engine.js";

export interface UiEvent {
  type: "item.created" | "item.updated" | "item.deleted" | "sync.status" | "conflict.detected";
  payload: Record<string, unknown>;
}

export type UiEventCallback = (event: UiEvent) => void;

export class UiEventServer {
  readonly #engine: SyncEngine;
  readonly #listeners: Set<UiEventCallback> = new Set();
  #pollTimer: ReturnType<typeof setInterval> | null = null;

  public constructor(engine: SyncEngine) {
    this.#engine = engine;
  }

  subscribe(callback: UiEventCallback): () => void {
    this.#listeners.add(callback);
    return () => { this.#listeners.delete(callback); };
  }

  broadcast(event: UiEvent): void {
    for (const listener of this.#listeners) {
      try { listener(event); } catch { /* ignore */ }
    }
  }

  startPolling(intervalMs = 2000): void {
    this.#pollTimer = setInterval(async () => {
      try {
        const count = await this.#engine.listItems().then(items => items.length);
        this.broadcast({
          type: "sync.status",
          payload: { itemCount: count, timestamp: Date.now() },
        });
      } catch { /* ignore */ }
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.#pollTimer) {
      clearInterval(this.#pollTimer);
      this.#pollTimer = null;
    }
  }
}
