import type { HLC } from "./types.js";

export function hlcNow(
  deviceId: string,
  last: HLC | null,
  now: () => number = Date.now,
): HLC {
  const wall = now();
  if (last === null) {
    return { physical: wall, counter: 0, deviceId };
  }
  const pt = Math.max(wall, last.physical);
  if (pt === last.physical) {
    return { physical: pt, counter: last.counter + 1, deviceId };
  }
  return { physical: pt, counter: 0, deviceId };
}

export function hlcCompare(a: HLC, b: HLC): number {
  if (a.physical !== b.physical) {
    return a.physical - b.physical;
  }
  if (a.counter !== b.counter) {
    return a.counter - b.counter;
  }
  if (a.deviceId < b.deviceId) return -1;
  if (a.deviceId > b.deviceId) return 1;
  return 0;
}

export function hlcMax(a: HLC, b: HLC): HLC {
  return hlcCompare(a, b) >= 0 ? a : b;
}

export function hlcSerialize(hlc: HLC): string {
  return `${hlc.physical.toString(36)}_${hlc.counter.toString(36)}_${hlc.deviceId}`;
}

export function hlcDeserialize(raw: string): HLC {
  const parts = raw.split("_");
  if (parts.length < 3) {
    throw new Error(`Invalid HLC serialization: ${raw}`);
  }
  const physicalStr = parts[0];
  const counterStr = parts[1];
  const deviceId = parts.slice(2).join("_");
  if (physicalStr === undefined || counterStr === undefined) {
    throw new Error(`Invalid HLC serialization: ${raw}`);
  }
  const physical = Number.parseInt(physicalStr, 36);
  const counter = Number.parseInt(counterStr, 36);
  return { physical, counter, deviceId };
}
