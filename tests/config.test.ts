import { describe, expect, test } from "bun:test";
import { config } from "../src/config";

describe("config", () => {
  test("has required port", () => {
    expect(config.port).toBeGreaterThan(0);
  });

  test("has host", () => {
    expect(config.host).toBeTruthy();
  });

  test("has connector settings", () => {
    expect(config.connector).toBeDefined();
    expect(config.connector.enableExtendedGiftInfo).toBe(true);
  });

  test("has euler settings", () => {
    expect(config.euler).toBeDefined();
    expect(config.euler.wsUrl).toBeTruthy();
  });

  test("has connection settings", () => {
    expect(config.connection).toBeDefined();
    expect(config.connection.defaultType).toMatch(/^(auto|connector|euler)$/);
    expect(config.connection.connectorTimeoutMs).toBeGreaterThan(0);
    expect(config.connection.eulerTimeoutMs).toBeGreaterThan(0);
    expect(config.connection.maxReconnectAttempts).toBeGreaterThan(0);
  });

  test("has fallback enabled by default", () => {
    expect(config.connection.fallbackEnabled).toBe(true);
  });

  test("has limits", () => {
    expect(config.limits.maxChatMessages).toBeGreaterThan(0);
    expect(config.limits.maxEvents).toBeGreaterThan(0);
  });
});