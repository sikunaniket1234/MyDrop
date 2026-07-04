import { describe, expect, it } from "vitest";
import {
  updateVersionVector,
  mergeVersionVectors,
  dominates,
  classifyConflict,
  versionVectorEqual,
} from "../sync/version-vector.js";

describe("updateVersionVector", () => {
  it("creates new entry", () => {
    const vv = updateVersionVector({}, "dev1");
    expect(vv).toEqual({ dev1: 1 });
  });

  it("increments existing entry", () => {
    const vv = updateVersionVector({ dev1: 3 }, "dev1");
    expect(vv).toEqual({ dev1: 4 });
  });
});

describe("mergeVersionVectors", () => {
  it("merges two vectors taking max", () => {
    const a = { dev1: 3, dev2: 1 };
    const b = { dev1: 1, dev2: 5, dev3: 2 };
    const merged = mergeVersionVectors(a, b);
    expect(merged).toEqual({ dev1: 3, dev2: 5, dev3: 2 });
  });
});

describe("dominates", () => {
  it("a dominates b when strictly greater on all keys", () => {
    const a = { dev1: 3, dev2: 2 };
    const b = { dev1: 2, dev2: 2 };
    expect(dominates(a, b)).toBe(true);
    expect(dominates(b, a)).toBe(false);
  });

  it("returns false for concurrent", () => {
    const a = { dev1: 3, dev2: 1 };
    const b = { dev1: 1, dev2: 3 };
    expect(dominates(a, b)).toBe(false);
    expect(dominates(b, a)).toBe(false);
  });

  it("returns false when a has fewer keys than b", () => {
    const a = { dev1: 5 };
    const b = { dev1: 3, dev2: 1 };
    expect(dominates(a, b)).toBe(false);
  });

  it("returns true when a has more keys and higher counters", () => {
    const a = { dev1: 5, dev2: 3 };
    const b = { dev1: 3 };
    expect(dominates(a, b)).toBe(true);
  });
});

describe("classifyConflict", () => {
  it("LOCAL_NEWER when local dominates", () => {
    const local = { dev1: 5, dev2: 3 };
    const remote = { dev1: 3, dev2: 3 };
    expect(classifyConflict(local, remote)).toBe("LOCAL_NEWER");
  });

  it("REMOTE_NEWER when remote dominates", () => {
    const local = { dev1: 3 };
    const remote = { dev1: 5 };
    expect(classifyConflict(local, remote)).toBe("REMOTE_NEWER");
  });

  it("CONCURRENT for conflicting", () => {
    const local = { dev1: 3, dev2: 1 };
    const remote = { dev1: 1, dev2: 3 };
    expect(classifyConflict(local, remote)).toBe("CONCURRENT");
  });

  it("CONCURRENT for equal non-empty vectors (no strict dominance)", () => {
    const local = { dev1: 3, dev2: 2 };
    const remote = { dev1: 3, dev2: 2 };
    expect(classifyConflict(local, remote)).toBe("CONCURRENT");
  });

  it("IDENTICAL for both empty", () => {
    expect(classifyConflict({}, {})).toBe("IDENTICAL");
  });
});

describe("versionVectorEqual", () => {
  it("returns true for equal vectors", () => {
    expect(versionVectorEqual({ dev1: 3, dev2: 2 }, { dev1: 3, dev2: 2 })).toBe(true);
  });

  it("returns false for different vectors", () => {
    expect(versionVectorEqual({ dev1: 3 }, { dev1: 4 })).toBe(false);
  });

  it("treats missing keys as 0", () => {
    expect(versionVectorEqual({ dev1: 3 }, { dev1: 3, dev2: 0 })).toBe(true);
  });
});
