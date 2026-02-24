import { describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import { createApiRoutes } from "../../src/routes/api";

function mockConnectionManager(overrides: any = {}) {
  return {
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
    getConnectionInfo: mock(() => ({
      state: {
        type: "auto",
        activeMethod: null,
        status: "disconnected",
        uniqueId: null,
        connectedSince: null,
        failureReason: null,
        fallbackUsed: false,
      },
      stats: {
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
      },
      connectorVersion: "1.1.3",
    })),
    getState: mock(() => ({
      type: "auto",
      activeMethod: null,
      status: "disconnected",
      uniqueId: null,
      connectedSince: null,
      failureReason: null,
      fallbackUsed: false,
    })),
    connect: mock(async () => {}),
    disconnect: mock(() => {}),
    ...overrides,
  };
}

function makeApp(mgr: any) {
  const app = new Hono();
  app.route("/api", createApiRoutes(mgr));
  return app;
}

describe("API routes", () => {
  test("GET /api/status returns status", async () => {
    const mgr = mockConnectionManager();
    const app = makeApp(mgr);
    const res = await app.request("/api/status");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.connected).toBe(false);
    expect(json.connectorVersion).toBe("1.1.3");
  });

  test("GET /api/stats returns stats", async () => {
    const mgr = mockConnectionManager();
    const app = makeApp(mgr);
    const res = await app.request("/api/stats");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.viewerCount).toBe(0);
  });

  test("POST /api/connect requires uniqueId", async () => {
    const mgr = mockConnectionManager();
    const app = makeApp(mgr);
    const res = await app.request("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/connect calls manager", async () => {
    const mgr = mockConnectionManager();
    const app = makeApp(mgr);
    const res = await app.request("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uniqueId: "testuser", connectionType: "auto" }),
    });
    expect(res.status).toBe(200);
    expect(mgr.connect).toHaveBeenCalled();
  });

  test("POST /api/disconnect calls manager", async () => {
    const mgr = mockConnectionManager();
    const app = makeApp(mgr);
    const res = await app.request("/api/disconnect", { method: "POST" });
    expect(res.status).toBe(200);
    expect(mgr.disconnect).toHaveBeenCalled();
  });
});
