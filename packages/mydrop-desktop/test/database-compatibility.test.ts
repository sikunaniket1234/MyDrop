import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { migrate, supportsFts5 } from "@mydrop/core";
import { BetterSqliteAdapter } from "../src/db/better-sqlite3-adapter.js";
import { FilesystemMigrationSource } from "../src/db/filesystem-migration-source.js";

const directories: string[] = [];
afterEach(async () =>
  Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true }))),
);

describe("better-sqlite3 compatibility", () => {
  it("creates, migrates, writes, reads, closes, and reopens with FTS5", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mydrop-db-"));
    directories.push(directory);
    const options = { name: "compatibility.sqlite", location: directory };
    const source = new FilesystemMigrationSource(
      join(dirname(fileURLToPath(import.meta.url)), "migrations"),
    );
    const adapter = new BetterSqliteAdapter();
    const first = await adapter.open(options);
    expect(await supportsFts5(first)).toBe(true);
    expect((await migrate(first, source, () => 1)).applied).toEqual([
      "0001_probe.sql",
      "0002_fts5.sql",
    ]);
    await first.exec("INSERT INTO compatibility_probe(value) VALUES (?)", ["durable"]);
    await first.close();

    const reopened = await adapter.open(options);
    expect(await reopened.query("SELECT value FROM compatibility_probe")).toEqual([
      { value: "durable" },
    ]);
    expect((await migrate(reopened, source)).skipped).toHaveLength(2);
    await reopened.close();
  });

  it("fails closed when the installed build lacks SQLCipher", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mydrop-db-"));
    directories.push(directory);
    await expect(
      new BetterSqliteAdapter().open({
        name: "encrypted.sqlite",
        location: directory,
        encryptionKey: "probe",
      }),
    ).rejects.toThrow("does not include SQLCipher");
  });
});
