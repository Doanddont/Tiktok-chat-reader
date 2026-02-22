import { describe, expect, test, beforeEach, mock } from "bun:test";
import { WebSocketService } from "../../src/services/websocket.service";

function createMockWS(): any {
  return {
    send: mock(() => {}),
    readyState: 1,
  };
}

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

describe("WebSocketService", () => {
  let service: WebSocketService;

  beforeEach(() => {
    service = new WebSocketService();
  });

  test("starts with 0 clients", () => {
    expect(service.getClientCount()).toBe(0);
  });

  test("addClient increases client count", () => {
    service.addClient(createMockWS());
    expect(service.getClientCount()).toBe(1);
  });

  test("addClient handles multiple clients", () => {
    service.addClient(createMockWS());
    service.addClient(createMockWS());
    service.addClient(createMockWS());
    expect(service.getClientCount()).toBe(3);
  });

  test("removeClient decreases client count", () => {
    const ws = createMockWS();
    service.addClient(ws);
    service.removeClient(ws);
    expect(service.getClientCount()).toBe(0);
  });

  test("removeClient ignores unknown client", () => {
    service.addClient(createMockWS());
    service.removeClient(createMockWS());
    expect(service.getClientCount()).toBe(1);
  });

  test("broadcast sends to all clients", () => {
    const ws1 = createMockWS();
    const ws2 = createMockWS();
    service.addClient(ws1);
    service.addClient(ws2);

    service.broadcast("chat", { message: "hello" });

    expect(ws1.send).toHaveBeenCalledTimes(1);
    expect(ws2.send).toHaveBeenCalledTimes(1);

    const sent = JSON.parse(ws1.send.mock.calls[0][0]);
    expect(sent.event).toBe("chat");
    expect(sent.data.message).toBe("hello");
  });

  test("broadcast removes clients that throw", () => {
    const good = createMockWS();
    const bad = createMockWS();
    bad.send = mock(() => { throw new Error("closed"); });

    service.addClient(good);
    service.addClient(bad);

    service.broadcast("test", {});

    expect(service.getClientCount()).toBe(1);
  });

  test("broadcast with no clients does not throw", () => {
    expect(() => service.broadcast("test", {})).not.toThrow();
  });

  test("broadcast sends correct JSON format", () => {
    const ws = createMockWS();
    service.addClient(ws);

    service.broadcast("gift", { giftName: "Rose", diamonds: 1 });

    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent).toEqual({
      event: "gift",
      data: { giftName: "Rose", diamonds: 1 },
    });
  });

  test("duplicate addClient handled by Set", () => {
    const ws = createMockWS();
    service.addClient(ws);
    service.addClient(ws);
    expect(service.getClientCount()).toBe(1);
  });
});
