import { Hono } from "hono";
import type { TikTokService } from "../services/tiktok.service";

export function createApiRoutes(tiktokService: TikTokService): Hono {
  const api = new Hono();

  // Connect to a TikTok stream
  api.post("/connect", async (c) => {
    const body = await c.req.json();
    const { uniqueId, options } = body;

    if (!uniqueId || typeof uniqueId !== "string") {
      return c.json({ success: false, message: "uniqueId is required" }, 400);
    }

    const result = await tiktokService.connect(uniqueId, options || {});
    return c.json(result);
  });

  // Disconnect
  api.post("/disconnect", (c) => {
    tiktokService.disconnect();
    return c.json({ success: true, message: "Disconnected" });
  });

  // Get stats
  api.get("/stats", (c) => {
    return c.json({
      connected: tiktokService.isConnected(),
      stats: tiktokService.getStats(),
    });
  });

  // Health check
  api.get("/health", (c) => {
    return c.json({
      status: "ok",
      uptime: process.uptime(),
      connected: tiktokService.isConnected(),
    });
  });

  return api;
}
