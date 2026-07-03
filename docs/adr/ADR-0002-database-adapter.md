# ADR-0002: Cross-Platform Database Adapter

## Status

Accepted — formalizes PRD v2.0 §§6–8 and SDS v1.0 §§1–2.

## Context

SQLite is the source of truth on every full node. Desktop and mobile require different native bindings, but `mydrop-core` must expose identical persistence behavior on both platforms. The database must remain available offline and encrypted at rest.

## Decision

`mydrop-core` will access SQLite only through `db/client.ts`, using the same public adapter contract on every full-node platform. The SDS defines its baseline operations as `query`, `exec`, and `migrate`.

- Desktop uses a `better-sqlite3`-based adapter as specified by the SDS.
- Mobile uses an `op-sqlite` adapter.
- Production databases use SQLCipher, with the database key derived from the Vault Key through HKDF.
- Kysely table interfaces provide typed schema access; Kysely does not own migrations.
- Migrations are plain SQL files, applied in filename order by `migrator.ts` and recorded in `applied_migrations`.
- Migrations `0001` through `0005` are the SDS baseline.
- SQLite plus FTS5 remains the local data and search store.
- Local writes commit to the local database before synchronization is attempted.

This ADR does not expand or alter the SDS adapter contract. Transaction-shape details beyond the documented contract remain an implementation matter that must preserve atomicity and local-first behavior.

## Consequences

- Core storage logic can run against both native SQLite implementations.
- SQL and migrations must be portable across desktop and mobile bindings.
- ORM-managed migration DSLs are not used.
- SQLCipher and FTS5 support must be validated on a physical React Native device before relying on the mobile stack.
- Platform binding differences are isolated behind the adapter.
- Applied migration history is locally durable and auditable.

## Alternatives Considered

- ORM-managed migrations: rejected because the SDS mandates ordered plain SQL migrations for portability.
- Separate desktop and mobile schemas: rejected because peers must share one data and sync model.
- Browser storage or remote database as source of truth: rejected because writes must succeed locally and the web client is not a node.
- A centralized database: rejected because every device is an equal peer with its own local store.

