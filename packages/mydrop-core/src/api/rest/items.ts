import type { SyncEngine } from "../../sync/engine.js";
import type { Item } from "../../sync/types.js";
import type { ApiResult } from "./types.js";
import { badRequest, created, notFound, ok, toConflictedCopyResponse, toItemResponse } from "./types.js";

export interface ItemHandlers {
  list(query: { type?: string; tag?: string; q?: string; cursor?: string }): Promise<ApiResult<{ items: Item[]; nextCursor: string | null }>>;
  create(body: { type: string; content?: string | null; fileId?: string | null; title?: string }): Promise<ApiResult<Item>>;
  update(id: string, body: { content?: string; tags?: string[] }): Promise<ApiResult<Item>>;
  remove(id: string): Promise<ApiResult<{ deleted: boolean }>>;
  listConflicts(id: string): Promise<ApiResult<{ conflicts: ReturnType<typeof toConflictedCopyResponse>[] }>>;
  resolve(id: string, body: { keep: "local" | "remote" | "both" }): Promise<ApiResult<Item>>;
}

export function createItemHandlers(engine: SyncEngine): ItemHandlers {
  async function list(query: { type?: string; tag?: string; q?: string; cursor?: string }): Promise<ApiResult<{ items: Item[]; nextCursor: string | null }>> {
    const allItems = await engine.listItems();
    let filtered = allItems;

    if (query.type) {
      filtered = filtered.filter(i => i.type === query.type);
    }

    if (query.q) {
      const lower = query.q.toLowerCase();
      filtered = filtered.filter(i =>
        (i.title ?? "").toLowerCase().includes(lower) ||
        (i.content ?? "").toLowerCase().includes(lower),
      );
    }

    const items = filtered.map(toItemResponse);
    return ok({ items: items as unknown as Item[], nextCursor: null });
  }

  async function create(body: { type: string; content?: string | null; fileId?: string | null; title?: string }): Promise<ApiResult<Item>> {
    const validTypes = ["text", "link", "file", "image", "voice", "clipboard"] as const;
    if (!validTypes.includes(body.type as typeof validTypes[number])) {
      return badRequest(`Invalid type: ${body.type}. Must be one of: ${validTypes.join(", ")}`);
    }

    const item = await engine.createItem({
      type: body.type as Item["type"],
      title: body.title ?? "",
      content: body.content ?? null,
      fileId: body.fileId ?? null,
    });

    return created(item);
  }

  async function update(id: string, body: { content?: string; tags?: string[] }): Promise<ApiResult<Item>> {
    try {
      const item = await engine.updateItem(id, body);
      return ok(item);
    } catch {
      return notFound("Item not found");
    }
  }

  async function remove(id: string): Promise<ApiResult<{ deleted: boolean }>> {
    try {
      await engine.deleteItem(id);
      return ok({ deleted: true });
    } catch {
      return notFound("Item not found");
    }
  }

  async function listConflicts(id: string): Promise<ApiResult<{ conflicts: ReturnType<typeof toConflictedCopyResponse>[] }>> {
    const copies = await engine.getConflictedCopies(id);
    return ok({ conflicts: copies.map(toConflictedCopyResponse) });
  }

  async function resolve(id: string, body: { keep: "local" | "remote" | "both" }): Promise<ApiResult<Item>> {
    const copies = await engine.getConflictedCopies(id);
    if (copies.length === 0) {
      return notFound("No conflicts for this item");
    }

    if (body.keep === "local") {
      const item = await engine.getItem(id);
      if (!item) return notFound("Item not found");
      await engine.resolveConflict(id, copies[0]!.id, false);
      return ok(item);
    }

    if (body.keep === "both") {
      const item = await engine.getItem(id);
      if (!item) return notFound("Item not found");
      await engine.resolveConflict(id, copies[0]!.id, true);
      return ok(item);
    }

    const winner = copies[0];
    if (!winner) return notFound("No conflicted copy to promote");
    await engine.resolveConflict(id, winner.id, false);
    const updated = await engine.getItem(id);
    if (!updated) return notFound("Item not found after resolution");
    return ok(updated);
  }

  return { list, create, update, remove, listConflicts, resolve };
}
