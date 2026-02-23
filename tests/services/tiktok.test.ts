import { beforeEach, describe, expect, mock, test } from "bun:test";
import { TikTokService } from "../../src/services/tiktok.service";
import { WebSocketService } from "../../src/services/websocket.service";

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

let mockConnectResult: any = { roomId: "12345" };
let mockConnectShouldFail = false;
let mockConnectError = new Error("LIVE has ended");
const mockEventHandlers: Record<string, Function> = {};

mock.module("tiktok-live-connector", () => ({
  WebcastPushConnection: class {
    constructor(_uid: string, _opts: any) {}
    on(event: string, handler: Function) {
      mockEventHandlers[event] = handler;
    }
    async connect() {
      if (mockConnectShouldFail) throw mockConnectError;
      return mockConnectResult;
    }
    disconnect() {}
  },
}));

describe("TikTokService", () => {
  let wsService: WebSocketService;
  let tiktokService: TikTokService;
  let broadcasts: Array<{ event: string; data: any }>;

  beforeEach(() => {
    wsService = new WebSocketService();
    broadcasts = [];
    const orig = wsService.broadcast.bind(wsService);
    wsService.broadcast = (event: string, data: any) => {
      broadcasts.push({ event, data });
      orig(event, data);
    };
    tiktokService = new TikTokService(wsService);
    mockConnectShouldFail = false;
    mockConnectResult = { roomId: "12345" };
    Object.keys(mockEventHandlers).forEach((k) => delete mockEventHandlers[k]);
  });

  // Connection

  test("starts not connected", () => {
    expect(tiktokService.isConnected()).toBe(false);
  });

  test("connect succeeds with valid username", async () => {
    const r = await tiktokService.connect("testuser");
    expect(r.success).toBe(true);
    expect(r.message).toContain("testuser");
    expect(tiktokService.isConnected()).toBe(true);
  });

  test("connect broadcasts connected event", async () => {
    await tiktokService.connect("testuser");
    const e = broadcasts.find((c) => c.event === "connected");
    expect(e).toBeDefined();
    expect(e!.data.uniqueId).toBe("testuser");
    expect(e!.data.roomId).toBe("12345");
  });

  test("connect cleans @ from username", async () => {
    const r = await tiktokService.connect("@testuser");
    expect(r.success).toBe(true);
  });

  test("connect fails with empty username", async () => {
    const r = await tiktokService.connect("");
    expect(r.success).toBe(false);
    expect(r.message).toContain("valid username");
  });

  test("connect fails with just @", async () => {
    const r = await tiktokService.connect("@");
    expect(r.success).toBe(false);
  });

  test("connect handles LIVE ended error", async () => {
    mockConnectShouldFail = true;
    mockConnectError = new Error("LIVE has ended");
    const r = await tiktokService.connect("offlineuser");
    expect(r.success).toBe(false);
    expect(r.message).toContain("live stream has ended");
  });

  test("connect handles not found error", async () => {
    mockConnectShouldFail = true;
    mockConnectError = new Error("User not found 404");
    const r = await tiktokService.connect("fakeuser");
    expect(r.success).toBe(false);
    expect(r.message).toContain("not found");
  });

  test("connect rate limits rapid attempts", async () => {
    await tiktokService.connect("user1");
    const r = await tiktokService.connect("user2");
    expect(r.success).toBe(false);
    expect(r.message).toContain("wait");
  });

  // Disconnect

  test("disconnect sets isConnected to false", async () => {
    await tiktokService.connect("testuser");
    tiktokService.disconnect();
    expect(tiktokService.isConnected()).toBe(false);
  });

  test("disconnect resets stats", async () => {
    await tiktokService.connect("testuser");
    tiktokService.disconnect();
    const s = tiktokService.getStats();
    expect(s.viewerCount).toBe(0);
    expect(s.uniqueId).toBeNull();
    expect(s.connectedSince).toBeNull();
  });

  test("disconnect when not connected does not throw", () => {
    expect(() => tiktokService.disconnect()).not.toThrow();
  });

  // Stats

  test("getStats returns defaults initially", () => {
    const s = tiktokService.getStats();
    expect(s.viewerCount).toBe(0);
    expect(s.likeCount).toBe(0);
    expect(s.diamondsCount).toBe(0);
    expect(s.giftCount).toBe(0);
    expect(s.chatCount).toBe(0);
    expect(s.followerCount).toBe(0);
    expect(s.shareCount).toBe(0);
    expect(s.joinCount).toBe(0);
    expect(s.connectedSince).toBeNull();
    expect(s.uniqueId).toBeNull();
  });

  test("getStats returns copy not reference", () => {
    const a = tiktokService.getStats();
    const b = tiktokService.getStats();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  test("stats update on connect", async () => {
    await tiktokService.connect("testuser");
    const s = tiktokService.getStats();
    expect(s.uniqueId).toBe("testuser");
    expect(s.connectedSince).not.toBeNull();
  });

  // Events

  test("chat event increments chatCount and broadcasts", async () => {
    await tiktokService.connect("testuser");
    mockEventHandlers["chat"]?.({
      uniqueId: "v1",
      nickname: "V1",
      profilePictureUrl: "",
      comment: "Hello!",
      followRole: 0,
      userBadges: [],
      isModerator: false,
      isNewGifter: false,
      isSubscriber: false,
      topGifterRank: null,
      teamMemberLevel: 0,
      msgId: "m1",
      createTime: "0",
    });
    expect(tiktokService.getStats().chatCount).toBe(1);
    expect(broadcasts.find((c) => c.event === "chat")).toBeDefined();
  });

  test("gift event updates diamonds and giftCount", async () => {
    await tiktokService.connect("testuser");
    mockEventHandlers["gift"]?.({
      uniqueId: "g1",
      nickname: "G1",
      profilePictureUrl: "",
      giftId: 1,
      giftName: "Rose",
      giftPictureUrl: "",
      diamondCount: 1,
      repeatCount: 5,
      repeatEnd: true,
      giftType: 1,
      describe: "",
    });
    const s = tiktokService.getStats();
    expect(s.giftCount).toBe(1);
    expect(s.diamondsCount).toBe(5);
  });

  test("like event updates likeCount", async () => {
    await tiktokService.connect("testuser");
    mockEventHandlers["like"]?.({
      uniqueId: "l1",
      nickname: "L1",
      profilePictureUrl: "",
      likeCount: 15,
      totalLikeCount: 100,
    });
    const s = tiktokService.getStats();
    expect(s.totalLikes).toBe(15);
    expect(s.likeCount).toBe(100);
  });

  test("member event increments joinCount", async () => {
    await tiktokService.connect("testuser");
    mockEventHandlers["member"]?.({
      uniqueId: "j1",
      nickname: "J1",
      profilePictureUrl: "",
      actionId: 1,
    });
    expect(tiktokService.getStats().joinCount).toBe(1);
  });

  test("social follow increments followerCount", async () => {
    await tiktokService.connect("testuser");
    mockEventHandlers["social"]?.({
      uniqueId: "f1",
      nickname: "F1",
      profilePictureUrl: "",
      displayType: "pm_mt_msg_viewer",
      label: "followed",
    });
    expect(tiktokService.getStats().followerCount).toBe(1);
    expect(broadcasts.find((c) => c.event === "follow")).toBeDefined();
  });

  test("social share increments shareCount", async () => {
    await tiktokService.connect("testuser");
    mockEventHandlers["social"]?.({
      uniqueId: "s1",
      nickname: "S1",
      profilePictureUrl: "",
      displayType: "pm_mt_msg_share",
      label: "shared the live",
    });
    expect(tiktokService.getStats().shareCount).toBe(1);
    expect(broadcasts.find((c) => c.event === "share")).toBeDefined();
  });

  test("roomUser updates viewerCount", async () => {
    await tiktokService.connect("testuser");
    mockEventHandlers["roomUser"]?.({ viewerCount: 1500, topViewers: [] });
    expect(tiktokService.getStats().viewerCount).toBe(1500);
  });

  test("streamEnd broadcasts streamEnd", async () => {
    await tiktokService.connect("testuser");
    mockEventHandlers["streamEnd"]?.({ action: 3 });
    expect(broadcasts.find((c) => c.event === "streamEnd")).toBeDefined();
  });

  test("multiple chats increment correctly", async () => {
    await tiktokService.connect("testuser");
    for (let i = 0; i < 5; i++) {
      mockEventHandlers["chat"]?.({
        uniqueId: `u${i}`,
        nickname: `U${i}`,
        profilePictureUrl: "",
        comment: `msg${i}`,
        followRole: 0,
        userBadges: [],
        msgId: `m${i}`,
        createTime: "0",
      });
    }
    expect(tiktokService.getStats().chatCount).toBe(5);
  });

  test("multiple gifts accumulate diamonds", async () => {
    await tiktokService.connect("testuser");
    mockEventHandlers["gift"]?.({
      uniqueId: "g1",
      nickname: "G1",
      profilePictureUrl: "",
      giftId: 1,
      giftName: "Rose",
      diamondCount: 1,
      repeatCount: 10,
      repeatEnd: true,
      giftType: 1,
    });
    mockEventHandlers["gift"]?.({
      uniqueId: "g2",
      nickname: "G2",
      profilePictureUrl: "",
      giftId: 2,
      giftName: "Lion",
      diamondCount: 29999,
      repeatCount: 1,
      repeatEnd: true,
      giftType: 1,
    });
    const s = tiktokService.getStats();
    expect(s.giftCount).toBe(2);
    expect(s.diamondsCount).toBe(10 + 29999);
  });
});
