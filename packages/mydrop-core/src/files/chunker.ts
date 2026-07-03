export const CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

export interface Chunk {
  readonly index: number;
  readonly data: Uint8Array;
}

export function chunkData(
  data: Uint8Array,
  chunkSize: number = CHUNK_SIZE_BYTES,
): Chunk[] {
  const chunks: Chunk[] = [];
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, data.length);
    chunks.push({ index: chunks.length, data: data.slice(offset, end) });
  }
  return chunks;
}

export function reconstructFromChunks(chunks: Chunk[]): Uint8Array {
  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  const total = sorted.reduce((sum, c) => sum + c.data.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of sorted) {
    result.set(chunk.data, offset);
    offset += chunk.data.length;
  }
  return result;
}

export function getMissingIndices(
  present: Set<number>,
  totalChunks: number,
): number[] {
  const missing: number[] = [];
  for (let i = 0; i < totalChunks; i++) {
    if (!present.has(i)) missing.push(i);
  }
  return missing;
}
