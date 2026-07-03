# ADR-0004: Cryptographic Provider and Algorithms

## Status

Accepted — formalizes PRD v2.0 §§3 and 10, SDS v1.0 §§1, 3, and 6, and `ai/SECURITY.md`.

## Context

MyDrop synchronizes private user data between equal devices over LAN and WAN transports. Transport security alone does not protect data at rest, authenticate sync events, or securely transfer the Vault Key during pairing. The project explicitly prohibits custom cryptography.

## Decision

MyDrop will use audited cryptographic implementations supplied through libsodium, with WebCrypto only where the PRD permits it. No cryptographic primitive will be implemented by MyDrop.

The mandated algorithms and roles are:

- Ed25519 for device identity signatures and signed sync envelopes.
- X25519 for authenticated pairing key agreement.
- AES-256-GCM for item/file data encryption, including per-chunk file encryption.
- HKDF for deriving the SQLCipher database key from the Vault Key.
- SHA-256 for full-file and chunk content hashes.
- SQLCipher for database encryption at rest.

Each device generates its identity locally. Private identity keys never leave the device unencrypted. The first device creates the Vault Key; later devices receive it only after QR bootstrap, X25519 session establishment, user code confirmation, and authenticated encrypted transfer.

Every inbound node-to-node envelope is signature-verified against the stored trusted device key before its payload is processed. Failed signatures are dropped and logged without returning a verification error. Revoked or unknown devices are not trusted peers.

This ADR does not select a specific language binding, secure-storage product, Ed25519/X25519 key-conversion method, nonce-allocation scheme, or Vault Key rotation UX. Those details are not fixed by the PRD/SDS and must not be invented here. V4 owns the complete offline-device key-rotation UX.

## Consequences

- Platform bindings must demonstrate support for every mandated algorithm.
- Key and nonce lifecycle behavior requires security-focused testing.
- Pairing cannot establish trust until the human verification step succeeds.
- Payload parsing/dispatch occurs only after sender authentication.
- Database and file content remain encrypted independently of WireGuard or TLS transport protection.
- If a platform cannot support the mandated cryptography, that is a blocker rather than permission to introduce a custom or weaker fallback.

## Alternatives Considered

- Custom cryptographic implementations: rejected explicitly by the security rules.
- Transport-only encryption: rejected because it does not protect local storage, relays, or event authenticity.
- Shared passwords or a central key server: rejected because they weaken pairing and introduce central dependence.
- Last-write or unsigned event acceptance: rejected because authenticity must be established before event processing.

