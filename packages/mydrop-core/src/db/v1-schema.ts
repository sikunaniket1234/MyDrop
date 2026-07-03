import { ALL_MIGRATIONS } from "./migrations.js";

export const V1_SCHEMA_SQL: string = ALL_MIGRATIONS
  .map(m => m.sql)
  .join("\n\n");
