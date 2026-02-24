import { Hono } from "hono";
import type { ConnectionManager } from "../services/connection.manager";

export function createApiRoutes(connectionManager: ConnectionManager): Hono {
  const api = new Hono();

  api.get("/status", (c) => {
    const info = connectionManager.getConnectionInfo();
    return c.json({
      connected: connectionManager.isConnected(),
      connection: info.state,
      stats: info.stats,
      connectorVersion: info.connectorVersion,
    });
  });

  api.get("/stats", (c) => {
    return c.json(connectionManager.getStats());
  });

  api.post("/connect", async (c) => {
    try {
      const body = await c.req.json();
      const { uniqueId, connectionType, options } = body;

      if (!uniqueId) {
        return c.json({ error: "uniqueId is required" }, 400);
      }

      await connectionManager.connect(uniqueId, connectionType, options || {});

      return c.json({
        success: true,
        connection: connectionManager.getState(),
      });
    } catch (err: any) {
      return c.json({ error: err.message || "Connection failed" }, 500);
    }
  });

  api.post("/disconnect", (c) => {
    connectionManager.disconnect();
    return c.json({ success: true });
  });

  return api;
}