import { config } from "../config";
import type { ConnectionInfo, ConnectionState, ConnectionType, StreamStats } from "../types";
import { logger } from "../utils/logger";
import { cleanUsername, isValidUsername, parseError } from "../utils/sanitize";
import { EulerService } from "./euler.service";
import { TikTokService } from "./tiktok.service";
import type { WebSocketService } from "./websocket.service";

export class ConnectionManager {
  private tiktokService: TikTokService;
  private eulerService: EulerService;
  private wsService: WebSocketService;
  private state: ConnectionState = {
    type: "auto",
    activeMethod: null,
    status: "disconnected",
    uniqueId: null,
    connectedSince: null,
    failureReason: null,
    fallbackUsed: false,
  };
  private connectLock = false;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
    this.tiktokService = new TikTokService(wsService);
    this.eulerService = new EulerService(wsService);
  }

  async connect(uniqueId: string, connectionType?: ConnectionType, options: Record<string, any> = {}): Promise<void> {
    if (this.connectLock) {
      throw new Error("Connection already in progress");
    }
    this.connectLock = true;

    try {
      const cleaned = cleanUsername(uniqueId);
      if (!isValidUsername(cleaned)) {
        throw new Error("Invalid TikTok username");
      }

      // Disconnect existing
      this.disconnectAll();

      const type = connectionType || config.connection.defaultType;
      this.state = {
        type,
        activeMethod: null,
        status: "connecting",
        uniqueId: cleaned,
        connectedSince: null,
        failureReason: null,
        fallbackUsed: false,
      };

      this.broadcastState();

      switch (type) {
        case "connector":
          await this.connectWithConnector(cleaned, options);
          break;
        case "euler":
          await this.connectWithEuler(cleaned);
          break;
        case "auto":
        default:
          await this.connectAuto(cleaned, options);
          break;
      }
    } catch (err) {
      this.state.status = "failed";
      this.state.failureReason = parseError(err);
      this.broadcastState();
      throw err;
    } finally {
      this.connectLock = false;
    }
  }

  disconnect(): void {
    this.disconnectAll();
    this.state = {
      type: this.state.type,
      activeMethod: null,
      status: "disconnected",
      uniqueId: null,
      connectedSince: null,
      failureReason: null,
      fallbackUsed: false,
    };
    this.broadcastState();
  }

  getStats(): StreamStats {
    if (this.tiktokService.isConnected()) {
      return this.tiktokService.getStats();
    }
    if (this.eulerService.isConnected()) {
      return this.eulerService.getStats();
    }
    return this.defaultStats();
  }

  isConnected(): boolean {
    return this.tiktokService.isConnected() || this.eulerService.isConnected();
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      state: { ...this.state },
      stats: this.getStats(),
      connectorVersion: this.tiktokService.getConnectorVersion(),
    };
  }

  getState(): ConnectionState {
    return { ...this.state };
  }

  private async connectWithConnector(uniqueId: string, options: Record<string, any>): Promise<void> {
    logger.connection(`Trying TikTok-Live-Connector for @${uniqueId}...`);
    try {
      await this.tiktokService.connect(uniqueId, options);
      this.state.activeMethod = "connector";
      this.state.status = "connected";
      this.state.connectedSince = new Date().toISOString();
      this.broadcastState();
      logger.success(`Connected via TikTok-Live-Connector`);
    } catch (err) {
      logger.error(`TikTok-Live-Connector failed: ${parseError(err)}`);
      throw err;
    }
  }

  private async connectWithEuler(uniqueId: string): Promise<void> {
    logger.connection(`Trying Euler WebSocket API for @${uniqueId}...`);
    try {
      await this.eulerService.connect(uniqueId);
      this.state.activeMethod = "euler";
      this.state.status = "connected";
      this.state.connectedSince = new Date().toISOString();
      this.broadcastState();
      logger.success(`Connected via Euler WebSocket API`);
    } catch (err) {
      logger.error(`Euler WebSocket API failed: ${parseError(err)}`);
      throw err;
    }
  }

  private async connectAuto(uniqueId: string, options: Record<string, any>): Promise<void> {
    logger.connection(`Auto-connect: Trying TikTok-Live-Connector first for @${uniqueId}...`);

    // Try connector first
    try {
      await this.tiktokService.connect(uniqueId, options);
      this.state.activeMethod = "connector";
      this.state.status = "connected";
      this.state.connectedSince = new Date().toISOString();
      this.state.fallbackUsed = false;
      this.broadcastState();
      logger.success(`Auto-connect: Connected via TikTok-Live-Connector`);
      return;
    } catch (err) {
      logger.warn(`Auto-connect: TikTok-Live-Connector failed: ${parseError(err)}`);
    }

    // Fallback to Euler
    if (!config.connection.fallbackEnabled) {
      throw new Error("TikTok-Live-Connector failed and fallback is disabled");
    }

    logger.connection(`Auto-connect: Falling back to Euler WebSocket API for @${uniqueId}...`);

    try {
      await this.eulerService.connect(uniqueId);
      this.state.activeMethod = "euler";
      this.state.status = "connected";
      this.state.connectedSince = new Date().toISOString();
      this.state.fallbackUsed = true;
      this.broadcastState();
      logger.success(`Auto-connect: Connected via Euler WebSocket API (fallback)`);

      this.wsService.broadcast("toast", {
        message: "Connected via Euler fallback (TikTok-Live-Connector failed)",
        type: "warning",
      });
    } catch (eulerErr) {
      throw new Error(`All connection methods failed. Connector: ${parseError(err)}. Euler: ${parseError(eulerErr)}`);
    }
  }

  private disconnectAll(): void {
    try {
      this.tiktokService.disconnect();
    } catch (err) {
      logger.warn(`TikTok disconnect error: ${parseError(err)}`);
    }
    try {
      this.eulerService.disconnect();
    } catch (err) {
      logger.warn(`Euler disconnect error: ${parseError(err)}`);
    }
  }

  private broadcastState(): void {
    this.wsService.broadcast("connectionState", this.state);
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
