# ADR-0006: Multi-Node Test Topology

## Status

Accepted — formalizes PRD v2.0 §§7, 9–10, 18, and 21, SDS v1.0 §8, and `ai/TESTING.md`.

## Context

MyDrop's correctness depends on behavior that single-process happy-path tests cannot establish: offline writes, concurrent edits, skewed clocks, duplicate delivery, interrupted networks, failed pairing, resumable files, and differing mobile lifecycle behavior. V1 exit criteria additionally require two real devices and one week of daily offline/online cycling with zero data loss.

## Decision

Testing will cover both deterministic isolated-node scenarios and real-device end-to-end qualification.

Each logical test node is independent and has its own:

- SQLite database and migration history;
- device identity and trust state;
- HLC state and version vectors;
- local content store;
- peer cursor state;
- inbound and outbound transport endpoints.

Core synchronization tests exercise multiple nodes through controllable connectivity so they can represent partitions, reconnection, duplication, interruption, and independent clocks. Tests must cover:

- writes and reads while offline;
- catch-up after reconnection;
- concurrent edits with every losing version recoverable in `conflicted_copies`;
- physical clock skew and HLC ordering;
- idempotent duplicate event application;
- tombstone propagation and resurrection prevention;
- signature rejection before payload processing;
- pairing mismatch, token expiry, and interrupted bootstrap;
- interrupted file transfer resuming from missing chunks;
- network interruption recovery.

Integration qualification uses at least two real devices. The SQLCipher/`op-sqlite` spike runs on a physical React Native device, not only a simulator. The V1 exit test performs one week of daily offline/online cycling and begins early enough to complete before sign-off; the SDS recommends starting it on Day 11.

## Consequences

- Tests require isolated storage and identity fixtures rather than a shared test database.
- Clock and connectivity control must be available to core tests.
- Simulators and in-process tests improve determinism but cannot replace native-device qualification.
- The full V1 sign-off has a real elapsed-time dependency of one week.
- File and sync tests must assert final data and retained conflicts, not merely successful message exchange.
- CI can run deterministic suites, while some hardware and lifecycle tests require a documented device test process.

## Alternatives Considered

- Single-node unit tests only: rejected because they cannot demonstrate convergence or conflict preservation.
- Network-only happy-path tests: rejected because interruption and offline recovery are mandatory.
- Simulator-only mobile validation: rejected explicitly by the SDS SQLCipher spike requirement.
- Compressing the one-week cycling test into Day 19: rejected because it would not meet the PRD exit criterion or SDS guidance.
