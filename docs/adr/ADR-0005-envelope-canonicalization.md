# ADR-0005: Sync Envelope Serialization and Signature Input

## Status

Accepted — formalizes SDS v1.0 §3 without changing its V1 wire contract.

## Context

All node-to-node messages must be authenticated before payload processing. Peers require an exact, interoperable definition of the signed envelope and signature input. V1 prioritizes protocol debuggability over a more compact binary encoding.

## Decision

The V1 wire format is JSON. Every node-to-node message uses the SDS `SyncEnvelope` fields:

- `v`
- `type`
- `msgId`
- `deviceId`
- `signature`
- `payload`

The Ed25519 signature input is exactly the SDS-defined UTF-8 string:

```text
${type}:${msgId}:${JSON.stringify(payload)}
```

The signature is represented as base64. `msgId` is a UUID used for deduplication and acknowledgement correlation. Protocol version `v` is `1`, and devices compare it with their stored protocol version.

Receivers verify the signature using the sender's stored public key before touching the payload. A failed signature produces a silent drop and a log entry, not a protocol error response.

Despite the ADR name, the source documents do not define an additional canonical-JSON algorithm. This ADR therefore does not introduce one. All V1 producers must serialize the payload according to the exact SDS contract. Any change to canonicalization or the signed fields is a wire-protocol change requiring a separate architecture decision and protocol-version handling.

## Consequences

- V1 traffic is human-readable and easier to diagnose.
- Both sides must reproduce the SDS signature input exactly.
- The envelope metadata outside the documented signature input is not newly added to the signed material by this ADR.
- Payload serialization changes can affect signature interoperability and therefore require compatibility tests.
- MessagePack remains a future optimization only if traffic measurements justify it.

## Alternatives Considered

- MessagePack for V1: rejected by the SDS in favor of JSON debuggability.
- Signing an independently invented canonical-JSON representation: not selected because the SDS defines `JSON.stringify(payload)` and this ADR may not alter architecture.
- Processing before verification: rejected explicitly by the SDS and security rules.
- Returning detailed signature failures: rejected to avoid providing a verification oracle.

