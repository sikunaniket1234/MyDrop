# Database Compatibility Report

**Phase:** Sprint 0 Phase 0.4  
**Date:** 2026-06-20  
**Architecture:** ADR-0002

## Outcome

The shared adapter contract and migration architecture are feasible at the TypeScript boundary. The desktop lifecycle and FTS5 gates pass with `better-sqlite3`. The overall cross-platform gate remains **blocked** until SQLCipher-enabled desktop and physical-device mobile runs pass.

## Implemented validation surface

- Platform-neutral `DatabaseAdapter` and `DatabaseClient` interfaces in `@mydrop/core`.
- Opaque encrypted-open option; core does not derive or manage keys.
- Injectable migration discovery and filename-ordered migration runner.
- `applied_migrations` tracking, idempotent reruns, and per-migration rollback.
- Desktop filesystem migration discovery.
- Desktop `better-sqlite3` adapter prototype.
- Mobile `@op-engineering/op-sqlite` adapter prototype.
- Mobile physical-device compatibility gate entry point.
- Test-only migrations for a durable table and FTS5 virtual table.

## Results

| Gate | Desktop / Windows | Mobile / physical device |
|---|---:|---:|
| Adapter compiles | Pass | Pass |
| Create database | Pass | Not run |
| Discover/apply migrations | Pass | Not run |
| Write/read | Pass | Not run |
| Close/reopen durability | Pass | Not run |
| Idempotent migration rerun | Pass | Not run |
| FTS5 | Pass | Not run |
| Encrypted open | Blocked | Not run |

### Desktop evidence

The Vitest integration suite creates a temporary file database, discovers and applies two SQL migrations, confirms FTS5, writes a durable row, closes the database, reopens it, reads the row, and confirms both migrations are skipped on a second run.

The stock `better-sqlite3` package does not expose `PRAGMA cipher_version`. The adapter rejects an `encryptionKey` request and closes the database rather than opening an unencrypted database silently. A SQLCipher-enabled `better-sqlite3` build is still required by ADR-0002.

### Mobile evidence

The prototype compiles against the package's native API and maps `open({ name, location, encryptionKey })`, `execute`, and `closeAsync` to the shared contract. The package documents that `encryptionKey` is effective only when compiled against its SQLCipher variant.

This Windows environment has no Android Debug Bridge, React Native native project, iOS toolchain, or attached physical device. Consequently, mobile creation, FTS5, background/resume behavior, close/reopen durability, wrong-key rejection, and SQLCipher are unverified.

## Required follow-up before Phase 0.4 can pass

1. Select and build the SQLCipher-enabled desktop binding required by ADR-0002.
2. Run the existing desktop lifecycle suite against that build and add correct-key reopen and wrong-key rejection cases.
3. Create a custom React Native development build configured for the SQLCipher variant of `op-sqlite`.
4. Invoke `runMobileDatabaseCompatibilityGate` on a physical Android device and a physical iOS device.
5. Repeat the mobile gate after backgrounding, force-close, and process restart.
6. Record OS, device, package, SQLite, SQLCipher, and FTS5 versions.

## Scope confirmation

No production schema, repositories, sync engine, HLC, version vectors, event log, pairing, key derivation, or business features were implemented.
