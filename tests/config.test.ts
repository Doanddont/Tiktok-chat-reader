import { describe, expect, test } from "bun:test";
import { config } from "../src/config";

describe("config", () => {
  test("has valid port number", () => {
    expect(typeof config.port).toBe("number");
    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThan(65536);
  });

  test("has tiktok config", () => {
    expect(config.tiktok).toBeDefined();
    expect(typeof config.tiktok.enableExtendedGiftInfo).toBe("boolean");
    expect(typeof config.tiktok.requestPollingIntervalMs).toBe("number");
    expect(config.tiktok.requestPollingIntervalMs).toBeGreaterThan(0);
  });

  test("has connection config", () => {
    expect(config.connection).toBeDefined();
    expect(typeof config.connection.cooldownMs).toBe("number");
    expect(typeof config.connection.maxReconnectAttempts).toBe("number");
    expect(typeof config.connection.reconnectDelayMs).toBe("number");
    expect(config.connection.cooldownMs).toBeGreaterThan(0);
    expect(config.connection.maxReconnectAttempts).toBeGreaterThan(0);
    expect(config.connection.reconnectDelayMs).toBeGreaterThan(0);
  });

  test("has limits config", () => {
    expect(config.limits).toBeDefined();
    expect(config.limits.maxChatMessages).toBeGreaterThan(0);
    expect(config.limits.maxEventMessages).toBeGreaterThan(0);
  });
});
