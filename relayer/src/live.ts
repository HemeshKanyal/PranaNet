// WS /live: pushes { type: "reading" | "flag" | "slash", data } to every connected client.
import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { log } from "./log.ts";

export type LiveMessage =
  | { type: "reading"; data: unknown }
  | { type: "flag"; data: unknown }
  | { type: "slash"; data: { device: string; ens: string; tx: string } };

export class LiveHub {
  private wss?: WebSocketServer;

  attach(server: Server, allowOrigin: (origin: string | undefined) => boolean) {
    this.wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (req, socket, head) => {
      const path = new URL(req.url ?? "/", "http://x").pathname;
      if (path !== "/live" || !allowOrigin(req.headers.origin)) {
        socket.destroy();
        return;
      }
      this.wss!.handleUpgrade(req, socket, head, (ws) => this.wss!.emit("connection", ws, req));
    });
    this.wss.on("connection", (ws) => {
      log("live", `client connected (${this.wss!.clients.size})`);
      ws.on("error", () => ws.terminate());
    });
    // Keepalive so tunnels/proxies don't drop idle sockets.
    setInterval(() => this.wss?.clients.forEach((c) => c.readyState === WebSocket.OPEN && c.ping()), 25_000).unref();
  }

  broadcast(msg: LiveMessage) {
    if (!this.wss) return;
    const data = JSON.stringify(msg, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    for (const c of this.wss.clients) if (c.readyState === WebSocket.OPEN) c.send(data);
  }
}
