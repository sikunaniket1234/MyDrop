import type { DatabaseClient } from "./client.js";

export async function supportsFts5(client: DatabaseClient): Promise<boolean> {
  try {
    await client.exec("CREATE VIRTUAL TABLE temp.mydrop_fts5_probe USING fts5(content)");
    await client.exec("DROP TABLE temp.mydrop_fts5_probe");
    return true;
  } catch {
    return false;
  }
}
