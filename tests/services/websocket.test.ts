import { beforeEach, describe, expect, mock, test } from "bun:test";
import { WebSocketService } from "../../src/services/websocket.service";

function createMockWS(): any {
  return {
    send: mock(() => {}),
    close: mock(() => {}),
    readyState: 1,
  };
}

describe("WebSocketService", () => {
  let service: WebSocketService;

  beforeEach(() => {
    service = new WebSocketService();
  });

  test("addClient increases count", () => {
    const ws = createMockWS();
    service.addClient(ws);
    expect(service.getClientCount()).toBe(1);
  });

  test("removeClient decreases count", () => {
    const ws = createMockWS();
    service.addClient(ws);
    service.removeClient(ws);
    expect(service.getClientCount()).toBe(0);
  });

  test("broadcast sends to all clients", () => {
    const ws1 = createMockWS();
    const ws2 = createMockWS();
    service.addClient(ws1);
    service.addClient(ws2);

    service.broadcast("test", { foo: "bar" });

    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();

    const sent = JSON.parse(ws1.send.mock.calls[0][0]);
    expect(sent.event).toBe("test");
    expect(sent.data.foo).toBe("bar");
  });

  test("broadcast removes dead clients", () => {
    const ws1 = createMockWS();
    ws1.send = mock(() => { throw new Error("dead"); });
    service.addClient(ws1);

    service.broadcast("test", {});
    expect(service.getClientCount()).toBe(0);
  });

  test("handles multiple adds of same client", () => {
    const ws = createMockWS();
    service.addClient(ws);
    service.addClient(ws);
    expect(service.getClientCount()).toBe(1);
  });

  test("removeClient on non-existent is safe", () => {
    const ws = createMockWS();
    expect(() => service.removeClient(ws)).not.toThrow();
  });

  test("destroy cleans up", () => {
    expect(() => service.destroy()).not.toThrow();
  });
});