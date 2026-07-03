export function computeDelta(): never {
  throw new Error(
    "Delta sync not implemented in V1. " +
    "Files are re-transferred in full on update. " +
    "See PRD §9 — deferred to V2.",
  );
}

export function applyDelta(): never {
  throw new Error(
    "Delta sync not implemented in V1. " +
    "Files are re-transferred in full on update.",
  );
}
