# ADR-0003: Node Runtime Model

## Status

Accepted — formalizes PRD v2.0 §§6, 11, 17–18 and SDS v1.0 §§1, 4–5.

## Context

MyDrop uses a peer topology rather than client-to-server synchronization. Each full node must persist local state, accept inbound peer connections when its platform permits, initiate outbound connections, expose a local UI API, and manage a content-addressable file store. Desktop and mobile have different operating-system lifecycle constraints.

## Decision

Desktop and mobile are V1 full nodes. Each full node contains:

- a local SQLCipher database and FTS5 index;
- a local content-addressable file store;
- the shared `mydrop-core` sync engine;
- a server role for inbound peer HTTP/WS traffic;
- a client role for outbound peer connections;
- a local REST and UI-facing WS interface.

Node-to-node synchronization uses a server-to-server model with Fastify and `ws`, not Socket.IO. The UI-facing API uses local REST and a separate local-only WS channel; Express is the specified UI-facing HTTP stack.

The desktop full node is hosted by the Tauri application from V1. Mobile is a full node while foregrounded or recently active, subject to platform background limits. iOS uses bounded background execution and push-to-wake; Android may use an opt-in foreground service and otherwise falls back to push-to-wake.

LAN discovery uses mDNS/Bonjour and direct transport. Tailscale is the default V1 WAN path. The PWA remains a thin HTTPS client to a real node.

The SDS does not prescribe the internal process/sidecar arrangement used to host JavaScript services inside Tauri. This ADR deliberately leaves that implementation detail open.

## Consequences

- No device is designated as the authoritative server.
- Desktop is expected to provide the most reliable always-on peer availability.
- Mobile convergence may have a longer tail because background execution is constrained.
- Peer and UI WebSocket channels remain separate and serve different trust and protocol roles.
- WAN synchronization can use Tailscale without making Tailscale part of the data trust boundary.
- Web access depends on a reachable real node and cannot replace one.

## Alternatives Considered

- Browser-hosted V1 node: rejected due to listener, background, database, and filesystem limitations.
- Socket.IO client/server topology: rejected because every peer must act as both server and client.
- Central cloud synchronization service: rejected because it violates device equality and the local-first data plane.
- WebRTC as the V1 WAN transport: deferred to V4 by the PRD/SDS.

