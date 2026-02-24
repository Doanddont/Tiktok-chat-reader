import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { config } from "./config";
import { createApiRoutes } from "./routes/api";
import { ConnectionManager } from "./services/connection.manager";
import { WebSocketService } from "./services/websocket.service";
import { logger } from "./utils/logger";
import { cleanUsername, isValidUsername } from "./utils/sanitize";

const app = new Hono();
const wsService = new WebSocketService();
const connectionManager = new ConnectionManager(wsService);

// API routes
const apiRoutes = createApiRoutes(connectionManager);
app.route("/api", apiRoutes);

// Static files
app.use("/*", serveStatic({ root: "./public" }));

// Start server
const server = Bun.serve({
  port: config.port,
  hostname: config.host,

  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const success = server.upgrade(req);
      if (success) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return app.fetch(req);
  },

  websocket: {
    open(ws: ServerWebSocket<any>) {
      wsService.addClient(ws);
      // Send current state on connect
      const info = connectionManager.getConnectionInfo();
      ws.send(
        JSON.stringify({
          event: "init",
          data: {
            connected: connectionManager.isConnected(),
            connection: info.state,
            stats: info.stats,
            connectorVersion: info.connectorVersion,
          },
        }),
      );
    },

    message(ws: ServerWebSocket<any>, message: string | ArrayBuffer | Buffer) {
      try {
        const str = typeof message === "string" ? message : new TextDecoder().decode(message as ArrayBuffer);
        const msg = JSON.parse(str);

        if (!msg || typeof msg !== "object" || !msg.action) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Invalid message format" } }));
          return;
        }

        switch (msg.action) {
          case "connect": {
            const uniqueId = msg.uniqueId ? cleanUsername(String(msg.uniqueId)) : "";
            if (!isValidUsername(uniqueId)) {
              ws.send(JSON.stringify({ event: "error", data: { message: "Invalid username" } }));
              return;
            }

            const connectionType = msg.connectionType || "auto";
            const validTypes = ["connector", "euler", "auto"];
            if (!validTypes.includes(connectionType)) {
              ws.send(JSON.stringify({ event: "error", data: { message: "Invalid connection type" } }));
              return;
            }

            connectionManager.connect(uniqueId, connectionType, msg.options || {}).catch((err) => {
              wsService.broadcast("error", { message: err.message || "Connection failed" });
            });
            break;
          }

          case "disconnect": {
            connectionManager.disconnect();
            break;
          }

          case "getStatus": {
            const info = connectionManager.getConnectionInfo();
            ws.send(
              JSON.stringify({
                event: "status",
                data: {
                  connected: connectionManager.isConnected(),
                  connection: info.state,
                  stats: info.stats,
                  connectorVersion: info.connectorVersion,
                },
              }),
            );
            break;
          }

          default:
            ws.send(JSON.stringify({ event: "error", data: { message: `Unknown action: ${msg.action}` } }));
        }
      } catch (err: any) {
        logger.error(`WebSocket message error: ${err.message}`);
        try {
          ws.send(JSON.stringify({ event: "error", data: { message: "Invalid message" } }));
        } catch {}
      }
    },

    close(ws: ServerWebSocket<any>) {
      wsService.removeClient(ws);
    },
  },
});

// Log startup info
const connectorVersion = connectionManager.getConnectionInfo().connectorVersion;
logger.success(`Server running on http://${config.host}:${config.port}`);
logger.info(`TikTok-Live-Connector version: ${connectorVersion || "unknown"}`);
logger.info(`Default connection mode: ${config.connection.defaultType}`);
logger.info(`Fallback enabled: ${config.connection.fallbackEnabled}`);
