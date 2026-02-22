import { WebcastPushConnection } from "tiktok-live-connector";
import { config } from "../config";
import type { StreamStats } from "../types";
import type { WebSocketService } from "./websocket.service";
import { cleanUsername, parseError } from "../utils/sanitize";
import { logger } from "../utils/logger";

export class TikTokService {
  private connection: any = null;
  private wsService: WebSocketService;
  private isConnecting = false;
  private lastConnectionAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  public stats: StreamStats = this.defaultStats();

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  // =============================================
  // Public Methods
  // =============================================

  async connect(uniqueId: string, options: Record<string, any> = {}): Promise<{ success: boolean; message: string }> {
    // Rate limiting
    const now = Date.now();
    if (now - this.lastConnectionAttempt < config.connection.cooldownMs) {
      return { success: false, message: "Please wait before reconnecting." };
    }
    this.lastConnectionAttempt = now;

    if (this.isConnecting) {
      return { success: false, message: "Already connecting. Please wait." };
    }

    // Cleanup previous connection
    this.disconnect();

    uniqueId = cleanUsername(uniqueId);
    if (!uniqueId) {
      return { success: false, message: "Please provide a valid username." };
    }

    this.isConnecting = true;
    this.reconnectAttempts = 0;

    try {
      const connectionOptions: Record<string, any> = {
        enableExtendedGiftInfo: config.tiktok.enableExtendedGiftInfo,
        requestPollingIntervalMs: config.tiktok.requestPollingIntervalMs,
        ...options,
      };

      if (config.tiktok.sessionId) {
        connectionOptions.sessionId = config.tiktok.sessionId;
      }

      this.connection = new WebcastPushConnection(uniqueId, connectionOptions);
      this.registerEvents(uniqueId);

      const state = await this.connection.connect();

      logger.tiktok(`Connected to @${uniqueId} | Room ID: ${state.roomId}`);

      this.stats.connectedSince = new Date().toISOString();
      this.stats.uniqueId = uniqueId;
      this.isConnecting = false;

      this.wsService.broadcast("connected", {
        uniqueId,
        roomId: state.roomId,
      });

      return { success: true, message: `Connected to @${uniqueId}` };
    } catch (err: any) {
      this.isConnecting = false;
      const errorMessage = parseError(err);
      logger.error(`Connection failed for @${uniqueId}: ${errorMessage}`);

      this.wsService.broadcast("disconnected", {
        uniqueId,
        message: errorMessage,
      });

      return { success: false, message: errorMessage };
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connection) {
      try {
        this.connection.disconnect();
      } catch {}
      this.connection = null;
    }

    this.stats = this.defaultStats();
    this.isConnecting = false;
  }

  getStats(): StreamStats {
    return { ...this.stats };
  }

  isConnected(): boolean {
    return this.connection !== null && !this.isConnecting;
  }

  // =============================================
  // Private Methods
  // =============================================

  private registerEvents(uniqueId: string): void {
    if (!this.connection) return;

    // Chat
    this.connection.on("chat", (data: any) => {
      this.stats.chatCount++;
      this.wsService.broadcast("chat", {
        type: "chat",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        comment: data.comment,
        followRole: data.followRole,
        userBadges: data.userBadges || [],
        isModerator: data.isModerator || false,
        isNewGifter: data.isNewGifter || false,
        isSubscriber: data.isSubscriber || false,
        topGifterRank: data.topGifterRank || null,
        teamMemberLevel: data.teamMemberLevel || 0,
        msgId: data.msgId,
        createTime: data.createTime,
      });
    });

    // Gift
    this.connection.on("gift", (data: any) => {
      if (data.diamondCount) {
        this.stats.diamondsCount += data.diamondCount * (data.repeatCount || 1);
      }
      this.stats.giftCount++;

      this.wsService.broadcast("gift", {
        type: "gift",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        giftId: data.giftId,
        giftName: data.giftName || "Unknown Gift",
        giftPictureUrl: data.giftPictureUrl,
        diamondCount: data.diamondCount || 0,
        repeatCount: data.repeatCount || 1,
        repeatEnd: data.repeatEnd,
        giftType: data.giftType,
        describe: data.describe,
      });
    });

    // Like
    this.connection.on("like", (data: any) => {
      this.stats.totalLikes += data.likeCount || 0;
      this.stats.likeCount = data.totalLikeCount || this.stats.totalLikes;

      this.wsService.broadcast("like", {
        type: "like",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        likeCount: data.likeCount,
        totalLikeCount: data.totalLikeCount,
      });
    });

    // Member join
    this.connection.on("member", (data: any) => {
      this.stats.joinCount++;

      this.wsService.broadcast("member", {
        type: "member",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        action: data.actionId,
      });
    });

    // Social (follow & share)
    this.connection.on("social", (data: any) => {
      const isFollow =
        data.displayType === "pm_mt_msg_viewer" ||
        (data.label && data.label.toLowerCase().includes("follow"));

      if (isFollow) {
        this.stats.followerCount++;
        this.wsService.broadcast("follow", {
          type: "follow",
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
        });
      } else {
        this.stats.shareCount++;
        this.wsService.broadcast("share", {
          type: "share",
          uniqueId: data.uniqueId,
          nickname: data.nickname,
          profilePictureUrl: data.profilePictureUrl,
          label: data.label,
        });
      }
    });

    // Subscribe
    this.connection.on("subscribe", (data: any) => {
      this.wsService.broadcast("subscribe", {
        type: "subscribe",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        subMonth: data.subMonth,
      });
    });

    // Room user count
    this.connection.on("roomUser", (data: any) => {
      this.stats.viewerCount = data.viewerCount || 0;

      this.wsService.broadcast("roomUser", {
        type: "roomUser",
        viewerCount: data.viewerCount,
        topViewers: data.topViewers || [],
      });
    });

    // Question
    this.connection.on("questionNew", (data: any) => {
      this.wsService.broadcast("question", {
        type: "question",
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        questionText: data.questionText,
      });
    });

    // Stream end
    this.connection.on("streamEnd", (data: any) => {
      logger.tiktok(`Stream ended for @${uniqueId}`);
      this.wsService.broadcast("streamEnd", {
        type: "streamEnd",
        action: data?.action,
      });
      this.handleDisconnect(uniqueId, "Stream has ended");
    });

    // Error
    this.connection.on("error", (err: any) => {
      logger.error(`TikTok error: ${err.message || err}`);
      this.wsService.broadcast("error", {
        message: `Connection error: ${err.message || "Unknown error"}`,
      });
    });

    // Disconnected
    this.connection.on("disconnected", () => {
      logger.tiktok(`Disconnected from @${uniqueId}`);
      this.handleDisconnect(uniqueId, "Connection lost");
    });
  }

  private handleDisconnect(uniqueId: string, reason: string): void {
    this.wsService.broadcast("disconnected", {
      uniqueId,
      message: reason,
    });

    // Auto-reconnect
    if (
      this.reconnectAttempts < config.connection.maxReconnectAttempts &&
      reason === "Connection lost"
    ) {
      this.reconnectAttempts++;
      logger.info(
        `Attempting reconnect ${this.reconnectAttempts}/${config.connection.maxReconnectAttempts} for @${uniqueId}...`
      );

      this.reconnectTimer = setTimeout(() => {
        this.connect(uniqueId);
      }, config.connection.reconnectDelayMs);
    }
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
