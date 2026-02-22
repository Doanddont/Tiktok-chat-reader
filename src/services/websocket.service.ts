import type { ServerWebSocket } from "bun";
import type { WSServerMessage } from "../types";
import { logger } from "../utils/logger";

export class WebSocketService {
  private clients: Set<ServerWebSocket<any>> = new Set();

  addClient(ws: ServerWebSocket<any>): void {
    this.clients.add(ws);
    logger.ws(`Client connected (${this.clients.size} total)`);
  }

  removeClient(ws: ServerWebSocket<any>): void {
    this.clients.delete(ws);
    logger.ws(`Client disconnected (${this.clients.size} total)`);
  }

  broadcast(event: string, data: any): void {
    const message: WSServerMessage = { event, data };
    const payload = JSON.stringify(message);

    for (const client of this.clients) {
      try {
        client.send(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
