# ADR-0001: Monorepo Boundaries

## Status

Accepted — formalizes PRD v2.0 §17.1 and SDS v1.0 §1.

## Context

MyDrop must share synchronization behavior across desktop and mobile while preserving device equality and preventing platform UI code from becoming a second implementation of the domain. The web client is not capable of operating as a full peer, and the narrowly scoped serverless facilities must never become a centralized data plane.

## Decision

MyDrop will use a pnpm-workspace monorepo with Turborepo build orchestration. It has these package boundaries:

- `mydrop-core`: pure TypeScript shared logic for SQLite access abstractions, synchronization, events, cryptography, files, discovery, and local REST/WS contracts. It contains no platform-specific code.
- `mydrop-desktop`: the Tauri V1 full node. It owns desktop-native integration, the React webview, the local database and file-store adapters, and node hosting.
- `mydrop-mobile`: the React Native/Expo V1 full node. It owns mobile-native integration, share handlers, background lifecycle integration, and mobile adapters.
- `mydrop-web`: a thin PWA client. It connects to a real node over HTTPS and never holds the Vault Key, runs peer synchronization, or acts as a full node.
- `mydrop-serverless`: limited to wake signals/device metadata and optional Headscale documentation. It must never receive plaintext items, files, Vault Keys, or become required for data synchronization.

All synchronization business logic belongs in `mydrop-core`. UI layers render state and invoke core/local API operations; they do not implement conflict resolution, clocks, version vectors, tombstones, or sync policy. Platform-specific capabilities are supplied through adapters at package boundaries.

## Consequences

- Desktop and mobile use one synchronization implementation.
- Platform packages remain responsible for native lifecycle and operating-system integration.
- The web package cannot be used as a fallback peer.
- Serverless infrastructure remains optional and outside the data plane.
- Cross-package build orchestration and dependency-boundary enforcement are required.
- Features that cannot use the common core database interface on both full-node platforms belong in a platform package rather than being hidden inside core.

## Alternatives Considered

- Separate repositories: rejected because they encourage drift in shared core behavior and complicate atomic protocol changes.
- Platform-specific sync engines: rejected because the SDS requires shared core logic and device equality.
- Web-first/browser peer: rejected because browsers cannot provide a persistent listener, unrestricted file storage, or full background execution.
- Central synchronization service: rejected because it violates the local-first peer architecture.

