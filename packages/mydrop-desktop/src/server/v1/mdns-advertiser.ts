import { hostname } from "node:os";
import multicastdns from "multicast-dns";

const SERVICE_NAME = "_mydrop._tcp.local";
const MDNS_TTL = 120;

export class MdnsAdvertiser {
  readonly #mdns: multicastdns.MulticastDNS;
  readonly #port: number;
  readonly #instanceName: string;
  #running = false;

  public constructor(port: number, instanceName?: string) {
    this.#port = port;
    this.#instanceName = instanceName ?? `MyDrop on ${hostname()}`;
    this.#mdns = multicastdns();
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;

    this.#mdns.on("query", (query) => {
      for (const q of query.questions ?? []) {
        if (
          q.type === "SRV" &&
          (q.name === SERVICE_NAME || q.name === `_mydrop._tcp.local`)
        ) {
          this.#respond();
        }
      }
    });

    this.#announce();
  }

  stop(): void {
    this.#running = false;
    this.#mdns.destroy();
  }

  #announce(): void {
    this.#mdns.respond({
      answers: [
        {
          name: SERVICE_NAME,
          type: "PTR",
          class: "IN",
          ttl: MDNS_TTL,
          data: `${this.#instanceName}.${SERVICE_NAME}`,
        },
        {
          name: `${this.#instanceName}.${SERVICE_NAME}`,
          type: "SRV",
          class: "IN",
          ttl: MDNS_TTL,
          data: {
            priority: 0,
            weight: 0,
            port: this.#port,
            target: hostname(),
          },
        },
        {
          name: `${this.#instanceName}.${SERVICE_NAME}`,
          type: "TXT",
          class: "IN",
          ttl: MDNS_TTL,
          data: [`device=${hostname()}`, `proto=v1`],
        },
      ],
    });
  }

  #respond(): void {
    this.#announce();
  }
}
