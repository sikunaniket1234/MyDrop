import { AppState, type AppStateStatus, NativeModules, Platform } from "react-native";
import type { V1MobileStore } from "../v1/mobile-v1-store.js";

interface ShareIntentData {
  type: "text" | "file" | "image";
  text?: string;
  uri?: string;
  mimeType?: string;
  fileName?: string;
}

type ShareCallback = (intent: ShareIntentData | null) => void;

const INTENT_MODULE = NativeModules.MyDropShareIntent as
  | { getPendingIntent: () => Promise<string | null>; clearPendingIntent: () => Promise<void> }
  | undefined;

export class ShareIntentHandler {
  readonly #store: V1MobileStore;
  #listeners: Set<ShareCallback> = new Set();
  #subscription: { remove: () => void } | null = null;

  public constructor(store: V1MobileStore) {
    this.#store = store;
  }

  subscribe(callback: ShareCallback): () => void {
    this.#listeners.add(callback);
    return () => { this.#listeners.delete(callback); };
  }

  startListening(): void {
    if (Platform.OS !== "android") return;

    this.#subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        void this.#checkPendingIntent();
      }
    });

    void this.#checkPendingIntent();
  }

  stopListening(): void {
    this.#subscription?.remove();
    this.#subscription = null;
  }

  async #checkPendingIntent(): Promise<void> {
    if (!INTENT_MODULE) return;
    try {
      const raw = await INTENT_MODULE.getPendingIntent();
      if (!raw) return;

      const intent = JSON.parse(raw) as ShareIntentData;
      for (const cb of this.#listeners) {
        try { cb(intent); } catch { /* ignore */ }
      }

      await this.#handleShareIntent(intent);
      await INTENT_MODULE.clearPendingIntent();
    } catch { /* ignore */ }
  }

  async #handleShareIntent(intent: ShareIntentData): Promise<void> {
    try {
      const title = intent.text
        ? intent.text.slice(0, 80)
        : intent.fileName ?? "Shared file";
      const content = intent.text ?? null;

      await this.#store.createItem({
        type: intent.type,
        title,
        content,
        fileId: null,
      });
    } catch { /* ignore */ }
  }
}
