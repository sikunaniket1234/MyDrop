import type { SyncEngine } from "../../sync/engine.js";
import type { Item } from "../../sync/types.js";
import type { ApiResult } from "./types.js";
import { created, badRequest } from "./types.js";

export interface ShareInput {
  type: string;
  content?: string | null;
  fileBase64?: string | null;
  title?: string;
}

export interface ShareHandlers {
  share(body: ShareInput): Promise<ApiResult<Item>>;
}

export function createShareHandlers(engine: SyncEngine): ShareHandlers {
  async function share(body: ShareInput): Promise<ApiResult<Item>> {
    const validTypes = ["text", "link", "file", "image", "voice", "clipboard"] as const;
    if (!validTypes.includes(body.type as typeof validTypes[number])) {
      return badRequest(`Invalid type: ${body.type}`);
    }

    const item = await engine.createItem({
      type: body.type as Item["type"],
      title: body.title ?? body.content?.slice(0, 80) ?? "Shared",
      content: body.content ?? null,
      fileId: null,
    });

    return created(item);
  }

  return { share };
}
