import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Migration, MigrationSource } from "@mydrop/core";

export class FilesystemMigrationSource implements MigrationSource {
  public constructor(private readonly directory: string) {}

  public async discover(): Promise<readonly Migration[]> {
    const filenames = (await readdir(this.directory))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    return Promise.all(
      filenames.map(async (filename) => ({
        filename,
        sql: await readFile(join(this.directory, filename), "utf8"),
      })),
    );
  }
}
