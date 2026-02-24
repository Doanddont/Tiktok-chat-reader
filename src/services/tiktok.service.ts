import { WebcastPushConnection } from "tiktok-live-connector";
import { config } from "../config";
import type { ConnectionType, StreamStats } from "../types";
import { logger } from "../utils/logger";
import { cleanUsername, parseError } from "../utils/sanitize";
import type { WebSocketService } from "./websocket.service";

export class TikTokService {
  private connection: WebcastPushConnection | null = null;
  private wsService: WebSocketService;
  private connected = false;
  private currentUniqueId: string | null = null;
  private stats: StreamStats = this.defaultStats();
  private connectLock = false;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  async connect(uniqueId: string, options: Record<string, any> = {}): Promise<void> {
    if (this.connectLock) {
      throw new Error("Connection already in progress");
    }

    this.connectLock = true;

    try {
      if (this.connected) {
        this.disconnectInternal();
      }

      const cleaned = cleanUsername(uniqueId);
      if (!cleaned) {
        throw new Error("Invalid username");
      }

      this.stats = this.defaultStats();
      this.stats.uniqueId = cleaned;
      this.currentUniqueId = cleaned;

      logger.tiktok(`Connecting to @${cleaned} via TikTok-Live-Connector...`);

      this.connection = new WebcastPushConnection(cleaned, {
        ...config.connector,
        ...options,
      });

      this.registerEvents(cleaned);

      const state = await Promise.race([
        this.connection.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), config.connection.connectorTimeoutMs),
        ),
      ]);

      this.connected = true;
      this.stats.connectedSince = new Date().toISOString();

      logger.success(`Connected to @${cleaned} via TikTok-Live-Connector`);
      logger.tiktok(`Room state:`, state);

      this.wsService.broadcast("connected", {
        uniqueId: cleaned,
        method: "connector",
        state,
      });
    } finally {
      this.connectLock = false;
    }
  }

  disconnect(): void {
    this.disconnectInternal();
  }

  getStats(): StreamStats {
    return { ...this.stats };
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectorVersion(): string | null {
    try {
      const pkg = require("tiktok-live-connector/package.json");
      return pkg.version || null;
    } catch {
      return null;
    }
  }

  private disconnectInternal(): void {
    if (this.connection) {
      try {
        this.connection.disconnect();
      } catch (err) {
        logger.warn(`Disconnect error: ${parseError(err)}`);
      }
      this.connection = null;
    }

    const wasConnected = this.connected;
    this.connected = false;

    if (wasConnected && this.currentUniqueId) {
      logger.tiktok(`Disconnected from @${this.currentUniqueId}`);
      this.wsService.broadcast("disconnected", {
        method: "connector",
        uniqueId: this.currentUniqueId,
      });
    }

    this.currentUniqueId = null;
    this.stats = this.defaultStats();
  }

  private registerEvents(uniqueId: string): void {
    if (!this.connection) return;

    this.connection.on("chat", (data: any) => {
      this.stats.chatCount++;
      this.wsService.broadcast("chat", {
        type: "chat",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        comment: data.comment,
        followRole: data.followRole || 0,
        userBadges: data.userBadges || [],
        isModerator: data.isModerator || false,
        isNewGifter: data.isNewGifter || false,
        isSubscriber: data.isSubscriber || false,
        topGifterRank: data.topGifterRank || null,
        teamMemberLevel: data.teamMemberLevel || 0,
        msgId: data.msgId || crypto.randomUUID(),
        createTime: data.createTime || new Date().toISOString(),
      });
    });

    this.connection.on("gift", (data: any) => {
      if (data.giftType === 1 && !data.repeatEnd) return;
      this.stats.giftCount++;
      this.stats.diamondsCount += (data.diamondCount || 0) * (data.repeatCount || 1);
      this.wsService.broadcast("gift", {
        type: "gift",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        giftId: data.giftId,
        giftName: data.giftName || "Gift",
        giftPictureUrl: data.giftPictureUrl || "",
        diamondCount: data.diamondCount || 0,
        repeatCount: data.repeatCount || 1,
        repeatEnd: data.repeatEnd || true,
        giftType: data.giftType || 1,
        describe: data.describe || "",
      });
    });

    this.connection.on("like", (data: any) => {
      this.stats.totalLikes += data.likeCount || 1;
      this.stats.likeCount = data.totalLikeCount || this.stats.totalLikes;
      this.wsService.broadcast("like", {
        type: "like",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        likeCount: data.likeCount || 1,
        totalLikeCount: data.totalLikeCount || 0,
      });
    });

    this.connection.on("member", (data: any) => {
      this.stats.joinCount++;
      this.wsService.broadcast("member", {
        type: "member",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        action: data.actionId || 1,
      });
    });

    this.connection.on("social", (data: any) => {
      if (data.displayType?.includes("follow")) {
        this.stats.followerCount++;
        this.wsService.broadcast("follow", {
          type: "follow",
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
        });
      } else if (data.displayType?.includes("share")) {
        this.stats.shareCount++;
        this.wsService.broadcast("share", {
          type: "share",
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
        });
      }
    });

    this.connection.on("subscribe", (data: any) => {
      this.wsService.broadcast("subscribe", {
        type: "subscribe",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        subMonth: data.subMonth || 0,
      });
    });

    this.connection.on("questionNew", (data: any) => {
      this.wsService.broadcast("question", {
        type: "question",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        questionText: data.questionText || "",
      });
    });

    this.connection.on("roomUser", (data: any) => {
      this.stats.viewerCount = data.viewerCount || 0;
      this.wsService.broadcast("roomUser", {
        type: "roomUser",
        viewerCount: data.viewerCount || 0,
        topViewers: data.topViewers || [],
      });
    });

    this.connection.on("streamEnd", (data: any) => {
      this.handleDisconnect(uniqueId, "Stream ended");
      this.wsService.broadcast("streamEnd", {
        type: "streamEnd",
        action: data?.action || 3,
      });
    });

    this.connection.on("error", (err: any) => {
      logger.error(`TikTok-Live-Connector error: ${parseError(err)}`);
      this.wsService.broadcast("error", {
        message: parseError(err),
        method: "connector",
      });
    });

    this.connection.on("disconnected", () => {
      this.handleDisconnect(uniqueId, "Disconnected by server");
    });
  }

  private handleDisconnect(uniqueId: string, reason: string): void {
    logger.tiktok(`Disconnected from @${uniqueId}: ${reason}`);
    this.connected = false;
    this.connection = null;
    this.wsService.broadcast("disconnected", {
      uniqueId,
      reason,
      method: "connector",
    });
  }

  private defaultStats(): StreamStats {
    return {
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
    };
  }
}
