declare module "react-native-zeroconf" {
  interface ZeroconfService {
    name: string;
    fullName: string;
    host: string;
    port: number;
    txt: Record<string, string>;
  }

  class Zeroconf {
    constructor();
    scan(type: string, protocol: string, domain?: string): void;
    stop(): void;
    removeDeviceListeners(): void;
    on(event: "resolved", callback: (service: ZeroconfService) => void): void;
    on(event: "error", callback: (error: Error) => void): void;
  }

  export default Zeroconf;
}
