import { beforeEach, describe, expect, mock, test } from "bun:test";
import { TikTokService } from "../../src/services/tiktok.service";
import { WebSocketService } from "../../src/services/websocket.service";

// Mock WebcastPushConnection
class MockConnection {
  handlers: Record<string, Function> = {};
  connected = false;

  constructor(_uid: string, _opts: any) {}

  on(event: string, handler: Function) {
    this.handlers[event] = handler;
  }

  async connect() {
    this.connected = true;
    return { roomId: "123" };
  }

  disconnect() {
    this.connected = false;
  }
}

describe("TikTokService", () => {
  let wsService: WebSocketService;
  let service: TikTokService;

  beforeEach(() => {
    wsService = new WebSocketService();
    service = new TikTokService(wsService);
  });

  test("starts disconnected", () => {
    expect(service.isConnected()).toBe(false);
  });

  test("getStats returns default stats", () => {
    const stats = service.getStats();
    expect(stats.viewerCount).toBe(0);
    expect(stats.chatCount).toBe(0);
    expect(stats.uniqueId).toBeNull();
  });

  test("disconnect when not connected is safe", () => {
    expect(() => service.disconnect()).not.toThrow();
  });

  test("getConnectorVersion returns string or null", () => {
    const version = service.getConnectorVersion();
    expect(version === null || typeof version === "string").toBe(true);
  });
});