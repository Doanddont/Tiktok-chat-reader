import { describe, expect, test, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import { createApiRoutes } from "../../src/routes/api";

// Suppress logger
mock.module("../../src/utils/logger", () => ({
  logger: {
    info: () => {},
    success: () => {},
    warn: () => {},
    error: () => {},
    tiktok: () => {},
    ws: () => {},
  },
}));

// Mock TikTokService
function createMockTikTokService(overrides: Partial<any> = {}) {
  return {
    connect: mock(async (uniqueId: string) => ({
      success: true,
      message: `Connected to @${uniqueId}`,
    })),
    disconnect: mock(() => {}),
    isConnected: mock(() => false),
    getStats: mock(() => ({
      viewerCount: 0,
      likeCount: 0,
      totalLikes: 0,
      diamondsCount: 0,
      giftCount: 0,
      chatCount: 0,
      followerCount: 0,
      shareCount: 0,
      joinCount: 0,
      connectedSince: null,
      uniqueId: null,
    })),
    ...overrides,
  };
}

function createTestApp(tiktokService: any) {
  const app = new Hono();
  const apiRoutes = createApiRoutes(tiktokService);
  app.route("/api", apiRoutes);
  return app;
}

describe("API Routes", () => {
  // --- POST /api/connect ---

  describe("POST /api/connect", () => {
    test("connects with valid uniqueId", async () => {
      const service = createMockTikTokService();
      const app = createTestApp(service);

      const res = await app.request("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uniqueId: "testuser" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(service.connect).toHaveBeenCalledWith("testuser", {});
    });

    test("returns 400 when uniqueId is missing", async () => {
      const service = createMockTikTokService();
      const app = createTestApp(service);

      const res = await app.request("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain("uniqueId");
    });

    test("returns 400 when uniqueId is not a string", async () => {
      const service = createMockTikTokService();
      const app = createTestApp(service);

      const res = await app.request("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uniqueId: 123 }),
      });

      expect(res.status).toBe(400);
    });

    test("passes options to connect", async () => {
      const service = createMockTikTokService();
      const app = createTestApp(service);

      await app.request("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uniqueId: "testuser",
          options: { sessionId: "abc123" },
        }),
      });

      expect(service.connect).toHaveBeenCalledWith("testuser", { sessionId: "abc123" });
    });

    test("returns failure when connect fails", async () => {
      const service = createMockTikTokService({
        connect: mock(async () => ({
          success: false,
          message: "User not found",
        })),
      });
      const app = createTestApp(service);

      const res = await app.request("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uniqueId: "fakeuser" }),
      });

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain("not found");
    });
  });

  // --- POST /api/disconnect ---

  describe("POST /api/disconnect", () => {
    test("calls disconnect and returns success", async () => {
      const service = createMockTikTokService();
      const app = createTestApp(service);

      const res = await app.request("/api/disconnect", { method: "POST" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(service.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  // --- GET /api/stats ---

  describe("GET /api/stats", () => {
    test("returns stats when not connected", async () => {
      const service = createMockTikTokService();
      const app = createTestApp(service);

      const res = await app.request("/api/stats");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.connected).toBe(false);
      expect(body.stats).toBeDefined();
      expect(body.stats.viewerCount).toBe(0);
    });

    test("returns stats when connected", async () => {
      const service = createMockTikTokService({
        isConnected: mock(() => true),
        getStats: mock(() => ({
          viewerCount: 5000,
          likeCount: 10000,
          totalLikes: 10000,
          diamondsCount: 500,
          giftCount: 25,
          chatCount: 300,
          followerCount: 10,
          shareCount: 5,
          joinCount: 200,
          connectedSince: "2024-01-01T00:00:00.000Z",
          uniqueId: "streamer",
        })),
      });
      const app = createTestApp(service);

      const res = await app.request("/api/stats");
      const body = await res.json();

      expect(body.connected).toBe(true);
      expect(body.stats.viewerCount).toBe(5000);
      expect(body.stats.uniqueId).toBe("streamer");
    });
  });

  // --- GET /api/health ---

  describe("GET /api/health", () => {
    test("returns health status", async () => {
      const service = createMockTikTokService();
      const app = createTestApp(service);

      const res = await app.request("/api/health");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(typeof body.uptime).toBe("number");
      expect(body.connected).toBe(false);
    });
  });
});
