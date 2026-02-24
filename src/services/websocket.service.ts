import type { ServerWebSocket } from "bun";
import type { WSServerMessage } from "../types";
import { logger } from "../utils/logger";

export class WebSocketService {
  private clients: Set<ServerWebSocket<any>> = new Set();
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startPingInterval();
  }

  addClient(ws: ServerWebSocket<any>): void {
    this.clients.add(ws);
    logger.ws(`Client connected (total: ${this.clients.size})`);
  }

  removeClient(ws: ServerWebSocket<any>): void {
    this.clients.delete(ws);
    logger.ws(`Client disconnected (total: ${this.clients.size})`);
  }

  broadcast(event: string, data: any): void {
    const message: WSServerMessage = { event, data };
    const payload = JSON.stringify(message);
    const deadClients: ServerWebSocket<any>[] = [];

    for (const client of this.clients) {
      try {
        client.send(payload);
      } catch {
        deadClients.push(client);
      }
    }

    for (const dead of deadClients) {
      this.clients.delete(dead);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const deadClients: ServerWebSocket<any>[] = [];
      for (const client of this.clients) {
        try {
          client.send(JSON.stringify({ event: "ping", data: { time: Date.now() } }));
        } catch {
          deadClients.push(client);
        }
      }
      for (const dead of deadClients) {
        this.clients.delete(dead);
      }
    }, 30000);
  }

  destroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
