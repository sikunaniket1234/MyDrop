import type { HLC, SyncEvent } from "@mydrop/core";

export type SyncProtocolMessage =
  | SyncHelloMessage
  | SyncEventsMessage
  | SyncRequestSinceMessage
  | SyncAckMessage
  | FileChunkAvailableMessage
  | DeviceTrustedMessage
  | DeviceRevokedMessage;

export interface SyncHelloMessage {
  readonly type: "sync.hello";
  readonly deviceId: string;
  readonly cursor: HlcCursor | null;
}

export interface SyncEventsMessage {
  readonly type: "sync.events";
  readonly events: readonly SyncEvent[];
}

export interface SyncRequestSinceMessage {
  readonly type: "sync.request_since";
  readonly since: HlcCursor;
}

export interface SyncAckMessage {
  readonly type: "sync.ack";
  readonly count: number;
}

export interface FileChunkAvailableMessage {
  readonly type: "file.chunk_available";
  readonly fileId: string;
  readonly chunkIndex: number;
}

export interface DeviceTrustedMessage {
  readonly type: "device.trusted";
  readonly deviceId: string;
  readonly pubkey: string;
  readonly signedBy: string;
}

export interface DeviceRevokedMessage {
  readonly type: "device.revoked";
  readonly deviceId: string;
  readonly signedBy: string;
}

export interface HlcCursor {
  readonly physical: number;
  readonly counter: number;
}

export function parseSyncMessage(data: string): SyncProtocolMessage {
  const parsed = JSON.parse(data) as Record<string, unknown>;
  if (typeof parsed.type !== "string") {
    throw new Error("Missing message type");
  }
  return parsed as unknown as SyncProtocolMessage;
}

export function hlcToCursor(hlc: HLC): HlcCursor {
  return { physical: hlc.physical, counter: hlc.counter };
}
