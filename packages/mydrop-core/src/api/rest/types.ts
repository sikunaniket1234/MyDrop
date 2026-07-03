import type { ConflictedCopy, Device, Item } from "../../sync/types.js";

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiSuccess<T> {
  status: number;
  body: T;
}

export type ApiResult<T> = ApiSuccess<T> | { status: number; error: ApiError };

export function ok<T>(body: T): ApiSuccess<T> {
  return { status: 200, body };
}

export function created<T>(body: T): ApiSuccess<T> {
  return { status: 201, body };
}

export function notFound(message = "Not found"): { status: number; error: ApiError } {
  return { status: 404, error: { code: "NOT_FOUND", message } };
}

export function badRequest(message: string): { status: number; error: ApiError } {
  return { status: 400, error: { code: "BAD_REQUEST", message } };
}

export function serverError(message: string): { status: number; error: ApiError } {
  return { status: 500, error: { code: "INTERNAL_ERROR", message } };
}

export interface ItemResponse {
  id: string;
  type: string;
  content: string | null;
  fileId: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  tags: string[];
}

export function toItemResponse(item: Item): ItemResponse {
  return {
    id: item.id,
    type: item.type,
    content: item.content,
    fileId: item.fileId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdBy: item.createdBy,
    tags: [],
  };
}

export interface DeviceHealthResponse {
  id: string;
  name: string;
  status: "pending" | "trusted" | "revoked";
  appVersion: string | null;
  protocolVersion: number;
  lastSeen: number | null;
  pendingEventCount: number;
  storageUsedBytes: number;
}

export function toDeviceHealthResponse(d: Device, pendingEventCount: number): DeviceHealthResponse {
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    appVersion: d.appVersion,
    protocolVersion: d.protocolVersion,
    lastSeen: d.lastSeen,
    pendingEventCount,
    storageUsedBytes: d.storageUsedBytes,
  };
}

export interface ConflictedCopyResponse {
  id: string;
  itemId: string;
  content: string | null;
  losingDevice: string;
  hlcTimestamp: string;
  createdAt: number;
}

export function toConflictedCopyResponse(c: ConflictedCopy): ConflictedCopyResponse {
  return {
    id: c.id,
    itemId: c.itemId,
    content: c.content,
    losingDevice: c.losingDevice,
    hlcTimestamp: `${c.hlc.physical}:${c.hlc.counter}:${c.hlc.deviceId}`,
    createdAt: c.createdAt,
  };
}

export interface HealthResponse {
  devices: DeviceHealthResponse[];
  localStorageBytes: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}
