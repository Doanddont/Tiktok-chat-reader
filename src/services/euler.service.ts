import { config } from "../config";
import type { StreamStats } from "../types";
import { logger } from "../utils/logger";
import { parseError } from "../utils/sanitize";
import type { WebSocketService } from "./websocket.service";

interface EulerRoomInfo {
  roomId: string;
  title: string;
  userCount: number;
  status: number;
}

export class EulerService {
  private ws: WebSocket | null = null;
  private wsService: WebSocketService;
  private connected = false;
  private currentUniqueId: string | null = null;
  private stats: StreamStats = this.defaultStats();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private eventListeners: Map<string, ((...args: any[]) => void)[]> = new Map();
  private abortController: AbortController | null = null;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  async connect(uniqueId: string): Promise<void> {
    if (this.connected) {
      this.disconnect();
    }

    this.currentUniqueId = uniqueId;
    this.stats = this.defaultStats();
    this.stats.uniqueId = uniqueId;
    this.abortController = new AbortController();

    logger.euler(`Attempting Euler WebSocket connection for @${uniqueId}...`);

    try {
      const roomInfo = await this.fetchRoomInfo(uniqueId);
      if (!roomInfo) {
        throw new Error(`Could not find live room for @${uniqueId}`);
      }

      logger.euler(`Found room ${roomInfo.roomId} for @${uniqueId}`);

      await this.connectWebSocket(roomInfo.roomId, uniqueId);
      this.connected = true;
      this.stats.connectedSince = new Date().toISOString();

      this.wsService.broadcast("connected", {
        uniqueId,
        method: "euler",
        roomId: roomInfo.roomId,
      });

      this.emit("connected", { uniqueId, method: "euler" });
      logger.euler(`Connected to @${uniqueId} via Euler WebSocket`);
    } catch (err) {
      const errMsg = parseError(err);
      logger.error(`Euler connection failed: ${errMsg}`);
      this.emit("error", err);
      this.cleanup();
      throw err;
    }
  }

  disconnect(): void {
    if (!this.connected && !this.ws) return;
    logger.euler(`Disconnecting from Euler WebSocket...`);
    this.cleanup();
    this.wsService.broadcast("disconnected", { method: "euler" });
    this.emit("disconnected", { method: "euler" });
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStats(): StreamStats {
    return { ...this.stats };
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx !== -1) listeners.splice(idx, 1);
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb(data);
        } catch (err) {
          logger.error(`Euler event listener error: ${parseError(err)}`);
        }
      }
    }
  }

  private async fetchRoomInfo(uniqueId: string): Promise<EulerRoomInfo | null> {
    try {
      const response = await fetch(`https://www.tiktok.com/@${uniqueId}/live`, {
        headers: config.euler.headers,
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching room info`);
      }

      const html = await response.text();

      const roomIdMatch = html.match(/room_id=(\d+)/) || html.match(/"roomId":"(\d+)"/) || html.match(/roomId%22%3A%22(\d+)/);

      if (!roomIdMatch) {
        logger.euler("Could not extract room ID - user may not be live");
        return null;
      }

      return {
        roomId: roomIdMatch[1],
        title: "",
        userCount: 0,
        status: 2,
      };
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      logger.error(`Failed to fetch room info: ${parseError(err)}`);
      return null;
    }
  }

  private async connectWebSocket(roomId: string, uniqueId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Euler WebSocket connection timeout"));
      }, config.connection.eulerTimeoutMs);

      try {
        const wsUrl = `${config.euler.wsUrl}?room_id=${roomId}&app_name=webcast`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          logger.euler("WebSocket opened, sending init message...");
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            this.handleMessage(event.data, uniqueId);
          } catch (err) {
            logger.error(`Euler message parse error: ${parseError(err)}`);
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          logger.euler(`WebSocket closed: code=${event.code} reason=${event.reason}`);
          if (this.connected) {
            this.connected = false;
            this.wsService.broadcast("disconnected", {
              method: "euler",
              reason: event.reason || "Connection closed",
            });
            this.emit("disconnected", { reason: event.reason });
          }
          this.cleanup();
        };

        this.ws.onerror = (err) => {
          clearTimeout(timeout);
          logger.error(`Euler WebSocket error: ${parseError(err)}`);
          reject(new Error("Euler WebSocket connection error"));
        };
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  private handleMessage(rawData: any, uniqueId: string): void {
    let data: any;
    if (typeof rawData === "string") {
      try {
        data = JSON.parse(rawData);
      } catch {
        return;
      }
    } else if (rawData instanceof ArrayBuffer || rawData instanceof Uint8Array) {
      try {
        const text = new TextDecoder().decode(rawData);
        data = JSON.parse(text);
      } catch {
        return;
      }
    } else {
      return;
    }

    if (!data || typeof data !== "object") return;

    const msgType = data.type || data.method || data.msg_type;

    switch (msgType) {
      case "WebcastChatMessage":
      case "chat": {
        const chatData = this.extractChatData(data, uniqueId);
        if (chatData) {
          this.stats.chatCount++;
          this.wsService.broadcast("chat", chatData);
        }
        break;
      }
      case "WebcastGiftMessage":
      case "gift": {
        const giftData = this.extractGiftData(data, uniqueId);
        if (giftData) {
          this.stats.giftCount++;
          this.stats.diamondsCount += giftData.diamondCount * giftData.repeatCount;
          this.wsService.broadcast("gift", giftData);
        }
        break;
      }
      case "WebcastLikeMessage":
      case "like": {
        const likeData = this.extractLikeData(data, uniqueId);
        if (likeData) {
          this.stats.totalLikes += likeData.likeCount || 1;
          this.stats.likeCount = likeData.totalLikeCount || this.stats.totalLikes;
          this.wsService.broadcast("like", likeData);
        }
        break;
      }
      case "WebcastMemberMessage":
      case "member": {
        const memberData = this.extractMemberData(data, uniqueId);
        if (memberData) {
          this.stats.joinCount++;
          this.wsService.broadcast("member", memberData);
        }
        break;
      }
      case "WebcastSocialMessage":
      case "social": {
        const socialData = this.extractSocialData(data, uniqueId);
        if (socialData) {
          if (socialData.displayType === "follow") {
            this.stats.followerCount++;
            this.wsService.broadcast("follow", socialData);
          } else if (socialData.displayType === "share") {
            this.stats.shareCount++;
            this.wsService.broadcast("share", socialData);
          }
        }
        break;
      }
      case "WebcastRoomUserSeqMessage":
      case "roomUser": {
        const viewerCount = data.viewerCount || data.viewer_count || data.userCount || 0;
        this.stats.viewerCount = viewerCount;
        this.wsService.broadcast("roomUser", { type: "roomUser", viewerCount, topViewers: [] });
        break;
      }
      case "WebcastControlMessage":
      case "streamEnd": {
        const action = data.action || data.status || 3;
        if (action === 3) {
          this.wsService.broadcast("streamEnd", { type: "streamEnd", action });
          this.disconnect();
        }
        break;
      }
    }
  }

  private extractChatData(data: any, _uniqueId: string): any {
    const user = data.user || data.common?.user || {};
    return {
      type: "chat",
      uniqueId: user.uniqueId || user.unique_id || user.display_id || "unknown",
      nickname: user.nickname || user.nick_name || "Unknown",
      profilePictureUrl: user.profilePicture?.urls?.[0] || user.avatar_url || "",
      comment: data.comment || data.content || data.text || "",
      followRole: user.followRole || 0,
      userBadges: this.extractBadges(user),
      isModerator: user.isModerator || false,
      isNewGifter: user.isNewGifter || false,
      isSubscriber: user.isSubscriber || false,
      topGifterRank: user.topGifterRank || null,
      teamMemberLevel: user.teamMemberLevel || 0,
      msgId: data.msgId || data.msg_id || crypto.randomUUID(),
      createTime: data.createTime || new Date().toISOString(),
    };
  }

  private extractGiftData(data: any, _uniqueId: string): any {
    const user = data.user || data.common?.user || {};
    const gift = data.gift || data.giftInfo || {};
    return {
      type: "gift",
      uniqueId: user.uniqueId || user.unique_id || "unknown",
      nickname: user.nickname || user.nick_name || "Unknown",
      profilePictureUrl: user.profilePicture?.urls?.[0] || user.avatar_url || "",
      giftId: gift.giftId || gift.gift_id || data.giftId || 0,
      giftName: gift.giftName || gift.name || data.giftName || "Gift",
      giftPictureUrl: gift.image?.url || gift.icon?.url || data.giftPictureUrl || "",
      diamondCount: gift.diamondCount || gift.diamond_count || data.diamondCount || 0,
      repeatCount: data.repeatCount || data.repeat_count || 1,
      repeatEnd: data.repeatEnd || data.repeat_end || true,
      giftType: gift.giftType || gift.type || data.giftType || 1,
      describe: data.describe || data.gift_description || "",
    };
  }

  private extractLikeData(data: any, _uniqueId: string): any {
    const user = data.user || data.common?.user || {};
    return {
      type: "like",
      uniqueId: user.uniqueId || user.unique_id || "unknown",
      nickname: user.nickname || user.nick_name || "Unknown",
      profilePictureUrl: user.profilePicture?.urls?.[0] || user.avatar_url || "",
      likeCount: data.likeCount || data.count || 1,
      totalLikeCount: data.totalLikeCount || data.total || 0,
    };
  }

  private extractMemberData(data: any, _uniqueId: string): any {
    const user = data.user || data.common?.user || {};
    return {
      type: "member",
      uniqueId: user.uniqueId || user.unique_id || "unknown",
      nickname: user.nickname || user.nick_name || "Unknown",
      profilePictureUrl: user.profilePicture?.urls?.[0] || user.avatar_url || "",
      action: data.action || data.actionId || 1,
    };
  }

  private extractSocialData(data: any, _uniqueId: string): any {
    const user = data.user || data.common?.user || {};
    const displayType = data.displayType || data.display_type || data.action || "";
    return {
      type: "social",
      uniqueId: user.uniqueId || user.unique_id || "unknown",
      nickname: user.nickname || user.nick_name || "Unknown",
      profilePictureUrl: user.profilePicture?.urls?.[0] || user.avatar_url || "",
      displayType: typeof displayType === "string" ? displayType : "follow",
      label: data.label || data.content || "",
    };
  }

  private extractBadges(user: any): any[] {
    if (Array.isArray(user.userBadges)) return user.userBadges;
    if (Array.isArray(user.badges)) return user.badges;
    return [];
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "hb" }));
        } catch {
          logger.euler("Heartbeat send failed");
        }
      }
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private cleanup(): void {
    this.connected = false;
    this.stopHeartbeat();

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.currentUniqueId = null;
    this.stats = this.defaultStats();
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