import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { config } from "./config";
import { createApiRoutes } from "./routes/api";
import { TikTokService } from "./services/tiktok.service";
import { WebSocketService } from "./services/websocket.service";
import { logger } from "./utils/logger";
import { cleanUsername } from "./utils/sanitize";

// Initialize services
const wsService = new WebSocketService();
const tiktokService = new TikTokService(wsService);

// Create Hono app
const app = new Hono();

// API routes
const apiRoutes = createApiRoutes(tiktokService);
app.route("/api", apiRoutes);

// Static files
app.use("/*", serveStatic({ root: "./public" }));

// Start server with WebSocket support
const server = Bun.serve({
  port: config.port,
  fetch(req, server) {
    const url = new URL(req.url);

    // Upgrade WebSocket requests
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Handle Hono routes
    return app.fetch(req, server);
  },
  websocket: {
    open(ws: ServerWebSocket<any>) {
      wsService.addClient(ws);
    },
    message(_ws: ServerWebSocket<any>, message: string | ArrayBuffer | Buffer) {
      try {
        let raw: string;
        if (typeof message === "string") {
          raw = message;
        } else if (message instanceof ArrayBuffer) {
          raw = new TextDecoder().decode(message);
        } else {
          raw = message.toString();
        }

        const data = JSON.parse(raw);

        switch (data.action) {
          case "connect":
            if (data.uniqueId) {
              tiktokService.connect(data.uniqueId, data.options || {});
            }
            break;
          case "disconnect":
            tiktokService.disconnect();
            break;
          default:
            logger.warn(`Unknown WS action: ${data.action}`);
        }
      } catch (err) {
        logger.error(`Invalid WS message: ${err}`);
      }
    },
    close(ws: ServerWebSocket<any>) {
      wsService.removeClient(ws);
    },
  },
});

logger.success(`🚀 Server running at http://localhost:${server.port}`);
logger.info(`📡 WebSocket endpoint: ws://localhost:${server.port}/ws`);

// CLI Auto-connect Logic
const args = Bun.argv.slice(2);
if (args.length > 0) {
  const targetUser = cleanUsername(args[0]);
  if (targetUser) {
    logger.info(`CLI argument detected. Auto-connecting to @${targetUser} in 2 seconds...`);
    setTimeout(() => {
      tiktokService.connect(targetUser);
    }, 2000);
  }
}
