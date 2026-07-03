export type AlphaItemKind = "text" | "file";

export interface AlphaItem {
  readonly id: string;
  readonly kind: AlphaItemKind;
  readonly title: string;
  readonly body: string | null;
  readonly fileName: string | null;
  readonly fileUri: string | null;
  readonly fileDataUrl: string | null;
  readonly fileSize: number | null;
  readonly mimeType: string | null;
  readonly createdAt: number;
  readonly sourceDevice: string;
}

export interface CreateAlphaTextItem {
  readonly body: string;
  readonly sourceDevice: string;
}

export interface CreateAlphaFileItem {
  readonly fileName: string;
  readonly fileUri: string;
  readonly fileDataUrl?: string | null;
  readonly fileSize?: number | null;
  readonly mimeType?: string | null;
  readonly sourceDevice: string;
}

export interface AlphaRealtimeEvents {
  readonly "item:created": AlphaItem;
  readonly "items:snapshot": readonly AlphaItem[];
}

export function createAlphaItemId(now: number, random: () => number = Math.random): string {
  const entropy = Math.floor(random() * Number.MAX_SAFE_INTEGER).toString(36);
  return `alpha_${now.toString(36)}_${entropy}`;
}

export function titleForAlphaText(body: string): string {
  const normalized = body.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return "Untitled text";
  }

  return normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized;
}
