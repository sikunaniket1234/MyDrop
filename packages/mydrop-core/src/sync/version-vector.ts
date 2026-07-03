import type { ConflictClass, VersionVector } from "./types.js";

export function updateVersionVector(
  vv: VersionVector,
  deviceId: string,
): VersionVector {
  const next = { ...vv };
  next[deviceId] = (next[deviceId] ?? 0) + 1;
  return next;
}

export function mergeVersionVectors(
  a: VersionVector,
  b: VersionVector,
): VersionVector {
  const merged: VersionVector = { ...a };
  for (const [deviceId, counter] of Object.entries(b)) {
    merged[deviceId] = Math.max(merged[deviceId] ?? 0, counter);
  }
  return merged;
}

export function dominates(
  a: VersionVector,
  b: VersionVector,
): boolean {
  let hasStrictlyGreater = false;
  for (const [deviceId, counter] of Object.entries(a)) {
    const bCounter = b[deviceId] ?? 0;
    if (counter < bCounter) return false;
    if (counter > bCounter) hasStrictlyGreater = true;
  }
  for (const deviceId of Object.keys(b)) {
    if (!(deviceId in a)) return false;
  }
  return hasStrictlyGreater;
}

export function classifyConflict(
  local: VersionVector,
  remote: VersionVector,
): ConflictClass {
  const localDominates = dominates(local, remote);
  const remoteDominates = dominates(remote, local);
  if (localDominates && !remoteDominates) return "LOCAL_NEWER";
  if (remoteDominates && !localDominates) return "REMOTE_NEWER";
  if (!localDominates && !remoteDominates) {
    if (Object.keys(local).length === 0 && Object.keys(remote).length === 0) {
      return "IDENTICAL";
    }
    return "CONCURRENT";
  }
  return "IDENTICAL";
}

export function versionVectorEqual(
  a: VersionVector,
  b: VersionVector,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? 0) !== (b[key] ?? 0)) return false;
  }
  return true;
}
