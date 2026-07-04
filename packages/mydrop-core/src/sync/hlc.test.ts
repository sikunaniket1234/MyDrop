import { describe, expect, it } from "vitest";
import {
  hlcNow,
  hlcCompare,
  hlcMax,
  hlcSerialize,
  hlcDeserialize,
} from "../sync/hlc.js";

describe("hlcNow", () => {
  it("returns initial clock when last is null", () => {
    const clock = hlcNow("dev1", null, () => 1000);
    expect(clock).toEqual({ physical: 1000, counter: 0, deviceId: "dev1" });
  });

  it("increments counter when wall time equals last physical", () => {
    const last = { physical: 1000, counter: 5, deviceId: "dev1" };
    const clock = hlcNow("dev1", last, () => 1000);
    expect(clock).toEqual({ physical: 1000, counter: 6, deviceId: "dev1" });
  });

  it("resets counter when wall time is ahead of last physical", () => {
    const last = { physical: 1000, counter: 5, deviceId: "dev1" };
    const clock = hlcNow("dev1", last, () => 2000);
    expect(clock).toEqual({ physical: 2000, counter: 0, deviceId: "dev1" });
  });

  it("uses last physical when wall time is behind", () => {
    const last = { physical: 2000, counter: 3, deviceId: "dev1" };
    const clock = hlcNow("dev1", last, () => 500);
    expect(clock).toEqual({ physical: 2000, counter: 4, deviceId: "dev1" });
  });
});

describe("hlcCompare", () => {
  it("compares by physical time", () => {
    const a = { physical: 100, counter: 0, deviceId: "a" };
    const b = { physical: 200, counter: 0, deviceId: "a" };
    expect(hlcCompare(a, b)).toBeLessThan(0);
    expect(hlcCompare(b, a)).toBeGreaterThan(0);
  });

  it("compares by counter when physical is equal", () => {
    const a = { physical: 100, counter: 1, deviceId: "a" };
    const b = { physical: 100, counter: 2, deviceId: "a" };
    expect(hlcCompare(a, b)).toBeLessThan(0);
  });

  it("compares by deviceId when physical and counter are equal", () => {
    const a = { physical: 100, counter: 0, deviceId: "aaa" };
    const b = { physical: 100, counter: 0, deviceId: "zzz" };
    expect(hlcCompare(a, b)).toBeLessThan(0);
  });

  it("returns 0 for identical clocks", () => {
    const a = { physical: 100, counter: 5, deviceId: "dev1" };
    expect(hlcCompare(a, a)).toBe(0);
  });
});

describe("hlcMax", () => {
  it("returns the larger clock", () => {
    const a = { physical: 100, counter: 0, deviceId: "a" };
    const b = { physical: 200, counter: 0, deviceId: "b" };
    expect(hlcMax(a, b)).toBe(b);
    expect(hlcMax(b, a)).toBe(b);
  });
});

describe("hlcSerialize/deserialize", () => {
  it("roundtrips", () => {
    const clock = { physical: 12345, counter: 42, deviceId: "dev_abc" };
    const serialized = hlcSerialize(clock);
    const deserialized = hlcDeserialize(serialized);
    expect(deserialized).toEqual(clock);
  });

  it("throws on invalid format", () => {
    expect(() => hlcDeserialize("invalid")).toThrow("Invalid HLC serialization");
  });
});
