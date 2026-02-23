import { describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import { createApiRoutes } from "../../src/routes/api";

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

function mockService(overrides: any = {}) {
  return {
    connect: mock(async (uid: string) => ({ success: true, message: `Connected to @${uid}` })),
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

function makeApp(svc: any) {
  const app = new Hono();
  app.route("/api", createApiRoutes(svc));
  return app;
}

describe("POST /api/connect", () => {
  test("connects with valid uniqueId", async () => {
    const svc = mockService();
    const app = makeApp(svc);
    const res = await app.request("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniqueId: "testuser" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(svc.connect).toHaveBeenCalledWith("testuser", {});
  });

  test("returns 400 when uniqueId missing", async () => {
    const app = makeApp(mockService());
    const res = await app.request("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test("returns 400 when uniqueId not string", async () => {
    const app = makeApp(mockService());
    const res = await app.request("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniqueId: 123 }),
    });
    expect(res.status).toBe(400);
  });

  test("passes options to connect", async () => {
    const svc = mockService();
    const app = makeApp(svc);
    await app.request("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniqueId: "testuser", options: { sessionId: "abc" } }),
    });
    expect(svc.connect).toHaveBeenCalledWith("testuser", { sessionId: "abc" });
  });

  test("returns failure when connect fails", async () => {
    const svc = mockService({
      connect: mock(async () => ({ success: false, message: "User not found" })),
    });
    const app = makeApp(svc);
    const res = await app.request("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniqueId: "fakeuser" }),
    });
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe("POST /api/disconnect", () => {
  test("calls disconnect and returns success", async () => {
    const svc = mockService();
    const app = makeApp(svc);
    const res = await app.request("/api/disconnect", { method: "POST" });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(svc.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/stats", () => {
  test("returns stats when not connected", async () => {
    const app = makeApp(mockService());
    const res = await app.request("/api/stats");
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.stats.viewerCount).toBe(0);
  });

  test("returns stats when connected", async () => {
    const svc = mockService({
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
    const app = makeApp(svc);
    const body = await (await app.request("/api/stats")).json();
    expect(body.connected).toBe(true);
    expect(body.stats.viewerCount).toBe(5000);
  });
});

describe("GET /api/health", () => {
  test("returns health status", async () => {
    const app = makeApp(mockService());
    const res = await app.request("/api/health");
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });
});
