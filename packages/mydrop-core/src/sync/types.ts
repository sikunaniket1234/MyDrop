export interface HLC {
  readonly physical: number;
  readonly counter: number;
  readonly deviceId: string;
}

export type VersionVector = Record<string, number>;

export type SyncEventType = "create" | "update" | "delete" | "rename";

export interface SyncEvent {
  readonly id: string;
  readonly itemId: string;
  readonly eventType: SyncEventType;
  readonly payload: Readonly<Record<string, unknown>> | null;
  readonly hlc: HLC;
  readonly deviceId: string;
  readonly createdAt: number;
  readonly itemVersionVector: VersionVector;
}

export type ItemType = "text" | "link" | "file" | "image" | "voice" | "clipboard";

export interface Item {
  readonly id: string;
  readonly type: ItemType;
  readonly title: string;
  readonly content: string | null;
  readonly fileId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly createdBy: string;
  readonly versionVector: VersionVector;
  readonly deleted: boolean;
}

export interface ConflictedCopy {
  readonly id: string;
  readonly itemId: string;
  readonly content: string | null;
  readonly fileId: string | null;
  readonly losingDevice: string;
  readonly hlc: HLC;
  readonly createdAt: number;
}

export interface Device {
  readonly id: string;
  readonly name: string;
  readonly publicKey: string;
  readonly appVersion: string | null;
  readonly protocolVersion: number;
  readonly trustedAt: number | null;
  readonly lastSeen: number | null;
  readonly storageUsedBytes: number;
  readonly status: "pending" | "trusted" | "revoked";
}

export interface Tombstone {
  readonly itemId: string;
  readonly hlc: HLC;
  readonly deviceId: string;
  readonly expiresAt: number;
}

export type ConflictClass =
  | "LOCAL_NEWER"
  | "REMOTE_NEWER"
  | "IDENTICAL"
  | "CONCURRENT";

export interface SyncCursor {
  readonly peerDeviceId: string;
  readonly lastHlcPhysical: number | null;
  readonly lastHlcCounter: number | null;
}
