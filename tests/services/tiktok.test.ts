import { describe, expect, test, beforeEach, mock } from "bun:test";
import { WebSocketService } from "../../src/services/websocket.service";
import { TikTokService } from "../../src/services/tiktok.service";

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

// Mock tiktok-live-connector
let mockConnectResult: any = { roomId: "12345" };
let mockConnectShouldFail = false;
let mockConnectError = new Error("LIVE has ended");
const mockEventHandlers: Record<string, Function> = {};

mock.module("tiktok-live-connector", () => ({
  WebcastPushConnection: class {
    uniqueId: string;
    options: any;

    constructor(uniqueId: string, options: any) {
      this.uniqueId = uniqueId;
      this.options = options;
    }

    on(event: string, handler: Function) {
      mockEventHandlers[event] = handler;
    }

    async connect() {
      if (mockConnectShouldFail) {
        throw mockConnectError;
      }
      return mockConnectResult;
    }

    disconnect() {}
  },
}));

describe("TikTokService", () => {
  let wsService: WebSocketService;
  let tiktokService: TikTokService;
  let broadcastCalls: Array<{ event: string; data: any }>;

  beforeEach(() => {
    wsService = new WebSocketService();
    broadcastCalls = [];

    // Spy on broadcast
    const originalBroadcast = wsService.broadcast.bind(wsService);
    wsService.broadcast = (event: string, data: any) => {
      broadcastCalls.push({ event, data });
      originalBroadcast(event, data);
    };

    tiktokService = new TikTokService(wsService);
    mockConnectShouldFail = false;
    mockConnectResult = { roomId: "12345" };

    // Clear event handlers
    Object.keys(mockEventHandlers).forEach((key) => delete mockEventHandlers[key]);
  });

  // --- Connection ---

  test("starts not connected", () => {
    expect(tiktokService.isConnected()).toBe(false);
  });

  test("connect succeeds with valid username", async () => {
    const result = await tiktokService.connect("testuser");
    expect(result.success).toBe(true);
    expect(result.message).toContain("testuser");
    expect(tiktokService.isConnected()).toBe(true);
  });

  test("connect broadcasts connected event", async () => {
    await tiktokService.connect("testuser");
    const connectedEvent = broadcastCalls.find((c) => c.event === "connected");
    expect(connectedEvent).toBeDefined();
    expect(connectedEvent!.data.uniqueId).toBe("testuser");
    expect(connectedEvent!.data.roomId).toBe("12345");
  });

  test("connect cleans @ from username", async () => {
    const result = await tiktokService.connect("@testuser");
    expect(result.success).toBe(true);
    expect(result.message).toContain("testuser");
  });

  test("connect fails with empty username", async () => {
    const result = await tiktokService.connect("");
    expect(result.success).toBe(false);
    expect(result.message).toContain("valid username");
  });

  test("connect fails with just @", async () => {
    const result = await tiktokService.connect("@");
    expect(result.success).toBe(false);
  });

  test("connect handles LIVE ended error", async () => {
    mockConnectShouldFail = true;
    mockConnectError = new Error("LIVE has ended");
    const result = await tiktokService.connect("offlineuser");
    expect(result.success).toBe(false);
    expect(result.message).toContain("live stream has ended");
  });

  test("connect handles not found error", async () => {
    mockConnectShouldFail = true;
    mockConnectError = new Error("User not found 404");
    const result = await tiktokService.connect("fakeuser");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  test("connect rate limits rapid attempts", async () => {
    await tiktokService.connect("user1");
    const result = await tiktokService.connect("user2");
    expect(result.success).toBe(false);
    expect(result.message).toContain("wait");
  });

  // --- Disconnect ---

  test("disconnect sets isConnected to false", async () => {
    await tiktokService.connect("testuser");
    expect(tiktokService.isConnected()).toBe(true);
    tiktokService.disconnect();
    expect(tiktokService.isConnected()).toBe(false);
  });

  test("disconnect resets stats", async () => {
    await tiktokService.connect("testuser");
    tiktokService.disconnect();
    const stats = tiktokService.getStats();
    expect(stats.viewerCount).toBe(0);
    expect(stats.uniqueId).toBeNull();
    expect(stats.connectedSince).toBeNull();
  });

  test("disconnect when not connected does not throw", () => {
    expect(() => tiktokService.disconnect()).not.toThrow();
  });

  // --- Stats ---

  test("getStats returns default stats initially", () => {
    const stats = tiktokService.getStats();
    expect(stats.viewerCount).toBe(0);
    expect(stats.likeCount).toBe(0);
    expect(stats.diamondsCount).toBe(0);
    expect(stats.giftCount).toBe(0);
    expect(stats.chatCount).toBe(0);
    expect(stats.followerCount).toBe(0);
    expect(stats.shareCount).toBe(0);
    expect(stats.joinCount).toBe(0);
    expect(stats.connectedSince).toBeNull();
    expect(stats.uniqueId).toBeNull();
  });

  test("getStats returns copy not reference", () => {
    const stats1 = tiktokService.getStats();
    const stats2 = tiktokService.getStats();
    expect(stats1).toEqual(stats2);
    expect(stats1).not.toBe(stats2);
  });

  test("stats update on connect", async () => {
    await tiktokService.connect("testuser");
    const stats = tiktokService.getStats();
    expect(stats.uniqueId).toBe("testuser");
    expect(stats.connectedSince).not.toBeNull();
  });

  // --- Event Handlers ---

  test("chat event increments chatCount and broadcasts", async () => {
    await tiktokService.connect("testuser");

    mockEventHandlers["chat"]?.({
      uniqueId: "viewer1",
      nickname: "Viewer One",
      profilePictureUrl: "https://example.com/pic.jpg",
      comment: "Hello!",
      followRole: 0,
      userBadges: [],
      isModerator: false,
      isNewGifter: false,
      isSubscriber: false,
      topGifterRank: null,
      teamMemberLevel: 0,
      msgId: "msg1",
      createTime: "123456",
    });

    expect(tiktokService.getStats().chatCount).toBe(1);
    const chatBroadcast = broadcastCalls.find((c) => c.event === "chat");
    expect(chatBroadcast).toBeDefined();
    expect(chatBroadcast!.data.comment).toBe("Hello!");
  });

  test("gift event updates diamonds and giftCount", async () => {
    await tiktokService.connect("testuser");

    mockEventHandlers["gift"]?.({
      uniqueId: "gifter1",
      nickname: "Gifter",
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

    const stats = tiktokService.getStats();
    expect(stats.giftCount).toBe(1);
    expect(stats.diamondsCount).toBe(5);
  });

  test("like event updates likeCount", async () => {
    await tiktokService.connect("testuser");

    mockEventHandlers["like"]?.({
      uniqueId: "liker1",
      nickname: "Liker",
      profilePictureUrl: "",
      likeCount: 15,
      totalLikeCount: 100,
    });

    const stats = tiktokService.getStats();
    expect(stats.totalLikes).toBe(15);
    expect(stats.likeCount).toBe(100);
  });

  test("member event increments joinCount", async () => {
    await tiktokService.connect("testuser");

    mockEventHandlers["member"]?.({
      uniqueId: "joiner1",
      nickname: "Joiner",
      profilePictureUrl: "",
      actionId: 1,
    });

    expect(tiktokService.getStats().joinCount).toBe(1);
  });

  test("social follow event increments followerCount", async () => {
    await tiktokService.connect("testuser");

    mockEventHandlers["social"]?.({
      uniqueId: "follower1",
      nickname: "Follower",
      profilePictureUrl: "",
      displayType: "pm_mt_msg_viewer",
      label: "followed",
    });

    expect(tiktokService.getStats().followerCount).toBe(1);
    const followBroadcast = broadcastCalls.find((c) => c.event === "follow");
    expect(followBroadcast).toBeDefined();
  });

  test("social share event increments shareCount", async () => {
    await tiktokService.connect("testuser");

    mockEventHandlers["social"]?.({
      uniqueId: "sharer1",
      nickname: "Sharer",
      profilePictureUrl: "",
      displayType: "pm_mt_msg_share",
      label: "shared the live",
    });

    expect(tiktokService.getStats().shareCount).toBe(1);
    const shareBroadcast = broadcastCalls.find((c) => c.event === "share");
    expect(shareBroadcast).toBeDefined();
  });

  test("roomUser event updates viewerCount", async () => {
    await tiktokService.connect("testuser");

    mockEventHandlers["roomUser"]?.({
      viewerCount: 1500,
      topViewers: [],
    });

    expect(tiktokService.getStats().viewerCount).toBe(1500);
  });

  test("streamEnd broadcasts streamEnd", async () => {
    await tiktokService.connect("testuser");

    mockEventHandlers["streamEnd"]?.({ action: 3 });

    const endBroadcast = broadcastCalls.find((c) => c.event === "streamEnd");
    expect(endBroadcast).toBeDefined();
  });

  test("multiple chat events increment counter correctly", async () => {
    await tiktokService.connect("testuser");

    for (let i = 0; i < 5; i++) {
      mockEventHandlers["chat"]?.({
        uniqueId: `user${i}`,
        nickname: `User ${i}`,
        profilePictureUrl: "",
        comment: `Message ${i}`,
        followRole: 0,
        userBadges: [],
        msgId: `msg${i}`,
        createTime: "123456",
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

    const stats = tiktokService.getStats();
    expect(stats.giftCount).toBe(2);
    expect(stats.diamondsCount).toBe(10 + 29999);
  });
});
