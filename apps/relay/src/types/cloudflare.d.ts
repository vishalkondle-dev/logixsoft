declare module 'cloudflare:workers' {
  export abstract class DurableObject {
    protected ctx: {
      acceptWebSocket(ws: WebSocket): void;
      getWebSockets(): WebSocket[];
      [key: string]: any;
    };
    protected env: any;
    constructor(ctx: any, env: any);
  }
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
  [index: number]: WebSocket;
}
