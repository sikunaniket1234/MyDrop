import Zeroconf from "react-native-zeroconf";

const SERVICE_TYPE = "_mydrop._tcp.local.";

export interface DiscoveredNode {
  readonly name: string;
  readonly host: string;
  readonly port: number;
  readonly fullName: string;
}

export type MdnsBrowserCallback = (nodes: DiscoveredNode[]) => void;

export class MdnsBrowser {
  readonly #zeroconf: Zeroconf;
  readonly #onFound: MdnsBrowserCallback;
  #started = false;

  public constructor(onFound: MdnsBrowserCallback) {
    this.#onFound = onFound;
    this.#zeroconf = new Zeroconf();
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;

    this.#zeroconf.on("resolved", (service) => {
      const node: DiscoveredNode = {
        name: service.name,
        host: service.host,
        port: service.port,
        fullName: service.fullName,
      };
      this.#onFound([node]);
    });

    this.#zeroconf.on("error", () => {
      // silently ignore — user has manual IP fallback
    });

    this.#zeroconf.scan(SERVICE_TYPE, "tcp", "local");
  }

  stop(): void {
    this.#started = false;
    try {
      this.#zeroconf.stop();
      this.#zeroconf.removeDeviceListeners();
    } catch {
      // ignore
    }
  }
}
