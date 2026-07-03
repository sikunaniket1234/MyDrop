import type { ContentStore } from "../../files/content-store.js";
import type { ApiResult } from "./types.js";
import { notFound, ok } from "./types.js";

export interface FileHandlers {
  getChunk(fileId: string, chunkIndex: number): Promise<ApiResult<{ data: Uint8Array; mimeType: string | null }>>;
  getFile(fileId: string): Promise<ApiResult<{ id: string; size: number; mimeType: string | null; chunkCount: number; fullySynced: boolean }>>;
}

export function createFileHandlers(store: ContentStore): FileHandlers {
  async function getChunk(fileId: string, chunkIndex: number): Promise<ApiResult<{ data: Uint8Array; mimeType: string | null }>> {
    const data = await store.getChunkData(fileId, chunkIndex);
    if (!data) return notFound("Chunk not found");
    const file = await store.getFile(fileId);
    return ok({ data, mimeType: file?.mimeType ?? null });
  }

  async function getFile(fileId: string): Promise<ApiResult<{ id: string; size: number; mimeType: string | null; chunkCount: number; fullySynced: boolean }>> {
    const file = await store.getFile(fileId);
    if (!file) return notFound("File not found");
    return ok({
      id: file.id,
      size: file.size,
      mimeType: file.mimeType,
      chunkCount: file.chunkCount,
      fullySynced: file.fullySynced,
    });
  }

  return { getChunk, getFile };
}
