import type { EventLog } from "../../events/event-log.js";
import type { HLC } from "../../sync/types.js";

export type SyncMessageType =
  | "sync.hello"
  | "sync.events"
  | "sync.request_since"
  | "sync.ack"
  | "file.chunk_available"
  | "file.chunk_request"
  | "device.trusted"
  | "device.revoked"
  | "heartbeat.ping"
  | "heartbeat.pong";

export interface SyncEnvelope<T = unknown> {
  v: 1;
  type: SyncMessageType;
  msgId: string;
  deviceId: string;
  signature: string;
  payload: T;
}

export interface SyncHelloPayload {
  deviceId: string;
  appVersion: string;
  protocolVersion: number;
  cursor: HLC | null;
}

export interface SyncEventsPayload {
  events: unknown[];
  hasMore: boolean;
}

export interface SyncRequestSincePayload {
  since: HLC | null;
  limit?: number;
}

export interface SyncAckPayload {
  acknowledgedMsgId: string;
  appliedEventIds: string[];
}

export interface FileChunkAvailablePayload {
  fileId: string;
  chunkIndex: number;
  chunkHash: string;
}

export interface DeviceTrustedPayload {
  deviceId: string;
  publicKey: string;
  signedBy: string;
  trustSignature: string;
}

export interface DeviceRevokedPayload {
  deviceId: string;
  signedBy: string;
  revokeSignature: string;
  newVaultKeyEpoch: number;
}

export type MessageHandler = (envelope: SyncEnvelope, respond: (msg: SyncEnvelope) => void) => Promise<void>;

export class SyncProtocolServer {
  readonly #eventLog: EventLog;
  readonly #handlers = new Map<SyncMessageType, MessageHandler>();

  public constructor(eventLog: EventLog, deviceId: string) {
    this.#eventLog = eventLog;
    void deviceId;
  }

  on(type: SyncMessageType, handler: MessageHandler): void {
    this.#handlers.set(type, handler);
  }

  async handleMessage(raw: string, respond: (msg: SyncEnvelope) => void): Promise<void> {
    let envelope: SyncEnvelope;
    try {
      envelope = JSON.parse(raw) as SyncEnvelope;
    } catch {
      return;
    }

    const handler = this.#handlers.get(envelope.type);
    if (!handler) return;

    await handler(envelope, respond);
  }

  async handleHello(deviceId: string, cursor: HLC | null): Promise<SyncEventsPayload> {
    void deviceId;
    const events = await this.#eventLog.getEventsSince(cursor);
    return {
      events: events.slice(0, 500),
      hasMore: events.length > 500,
    };
  }

  async handleRequestSince(since: HLC | null, limit = 500): Promise<SyncEventsPayload> {
    const events = await this.#eventLog.getEventsSince(since);
    return {
      events: events.slice(0, limit),
      hasMore: events.length > limit,
    };
  }
}
