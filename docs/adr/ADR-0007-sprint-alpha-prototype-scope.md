# ADR-0007: Sprint Alpha Prototype Scope

## Status

Proposed

## Context

The locked PRD v2.0 and SDS v1.0 define the production MyDrop architecture: encrypted local-first storage, HLCs, version vectors, append-only event logs, pairing, conflict preservation, and peer synchronization correctness.

Sprint Alpha has a different goal: produce a usable desktop-and-Android prototype quickly enough to validate the product loop before implementing the full synchronization architecture.

## Decision

Sprint Alpha is a prototype lane only.

The following production features are frozen for Sprint Alpha:

- SQLCipher
- Encryption
- HLC
- Version vectors
- Event log
- Device pairing
- Conflict resolution
- AI search
- OCR
- iOS support

Sprint Alpha assumes:

- A single trusted user.
- Desktop and Android only.
- Plain SQLite.
- Local network or Tailscale connectivity.
- Socket.IO transport.

Sprint Alpha may implement:

- Launchable Tauri desktop shell.
- Launchable React Native Android shell.
- Inbox screen.
- Text sharing.
- File sharing metadata capture.
- Local SQLite persistence.
- Socket.IO realtime communication.

## Consequences

- Sprint Alpha must not be treated as production synchronization architecture.
- Sprint Alpha data may be plaintext and unauthenticated.
- Sprint Alpha transport may assume trust on the local network.
- Production work must return to PRD/SDS guarantees before V1 hardening.
- Any attempt to promote Sprint Alpha decisions into production requires a follow-up ADR.

## Alternatives Considered

- Continue blocking on SQLCipher and mobile storage verification before product work. Rejected for Sprint Alpha because it delays product-loop validation.
- Implement production sync immediately. Rejected because it conflicts with the explicit Alpha objective of a fast usable prototype.
- Build desktop-only first. Rejected because the prototype needs a real desktop-to-Android loop.
