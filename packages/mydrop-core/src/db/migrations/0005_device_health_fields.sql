ALTER TABLE devices ADD COLUMN app_version TEXT;
ALTER TABLE devices ADD COLUMN protocol_version INTEGER DEFAULT 1;
ALTER TABLE devices ADD COLUMN storage_used_bytes INTEGER DEFAULT 0;
