import type { DatabaseClient } from "../../db/client.js";
import type { SyncEngine } from "../../sync/engine.js";
import type { ContentStore } from "../../files/content-store.js";
import { createItemHandlers } from "./items.js";
import { createDeviceHandlers } from "./devices.js";
import { createFileHandlers } from "./files.js";
import { createShareHandlers } from "./share.js";
import { createHealthHandlers } from "./health.js";

export interface ApiRouter {
  items: ReturnType<typeof createItemHandlers>;
  devices: ReturnType<typeof createDeviceHandlers>;
  files: ReturnType<typeof createFileHandlers>;
  share: ReturnType<typeof createShareHandlers>;
  health: ReturnType<typeof createHealthHandlers>;
}

export function createApiRouter(
  engine: SyncEngine,
  db: DatabaseClient,
  fileStore: ContentStore,
): ApiRouter {
  return {
    items: createItemHandlers(engine),
    devices: createDeviceHandlers(db),
    files: createFileHandlers(fileStore),
    share: createShareHandlers(engine),
    health: createHealthHandlers(db),
  };
}
