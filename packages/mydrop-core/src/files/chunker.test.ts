import { describe, expect, it } from "vitest";
import {
  chunkData,
  reconstructFromChunks,
  getMissingIndices,
  CHUNK_SIZE_BYTES,
} from "../files/chunker.js";

describe("chunkData", () => {
  it("chunks small data into one chunk", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const chunks = chunkData(data, 10);
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.data).toEqual(data);
  });

  it("splits data across multiple chunks", () => {
    const data = new Uint8Array(25);
    data.fill(42);
    const chunks = chunkData(data, 10);
    expect(chunks.length).toBe(3);
    expect(chunks[0]!.data.length).toBe(10);
    expect(chunks[1]!.data.length).toBe(10);
    expect(chunks[2]!.data.length).toBe(5);
  });

  it("uses default chunk size", () => {
    const data = new Uint8Array(CHUNK_SIZE_BYTES * 2 + 100);
    const chunks = chunkData(data);
    expect(chunks.length).toBe(3);
    expect(chunks[2]!.data.length).toBe(100);
  });

  it("handles empty data", () => {
    const chunks = chunkData(new Uint8Array(0), 10);
    expect(chunks.length).toBe(0);
  });
});

describe("reconstructFromChunks", () => {
  it("reconstructs original data", () => {
    const original = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const chunks = chunkData(original, 4);
    const reconstructed = reconstructFromChunks(chunks);
    expect(reconstructed).toEqual(original);
  });

  it("handles out-of-order chunks", () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const chunks = chunkData(original, 3);
    // Reverse the chunks
    const shuffled = [...chunks].reverse();
    const reconstructed = reconstructFromChunks(shuffled);
    expect(reconstructed).toEqual(original);
  });

  it("handles empty chunks", () => {
    const reconstructed = reconstructFromChunks([]);
    expect(reconstructed.length).toBe(0);
  });
});

describe("getMissingIndices", () => {
  it("returns all indices when none present", () => {
    expect(getMissingIndices(new Set(), 5)).toEqual([0, 1, 2, 3, 4]);
  });

  it("returns empty when all present", () => {
    expect(getMissingIndices(new Set([0, 1, 2, 3, 4]), 5)).toEqual([]);
  });

  it("returns only missing indices", () => {
    expect(getMissingIndices(new Set([0, 2, 4]), 5)).toEqual([1, 3]);
  });
});
