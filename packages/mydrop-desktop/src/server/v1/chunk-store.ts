import { readFile, writeFile, unlink, access } from "node:fs/promises";
import { join } from "node:path";
import type { ChunkDataStore } from "@mydrop/core";

export class NodeChunkStore implements ChunkDataStore {
  readonly #dir: string;

  public constructor(dir: string) {
    this.#dir = dir;
  }

  async write(hash: string, data: Uint8Array): Promise<void> {
    const path = join(this.#dir, hash);
    await writeFile(path, data);
  }

  async read(hash: string): Promise<Uint8Array | null> {
    const path = join(this.#dir, hash);
    try {
      return await readFile(path);
    } catch {
      return null;
    }
  }

  async exists(hash: string): Promise<boolean> {
    const path = join(this.#dir, hash);
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  async delete(hash: string): Promise<void> {
    const path = join(this.#dir, hash);
    try {
      await unlink(path);
    } catch {
      // ignore
    }
  }
}
