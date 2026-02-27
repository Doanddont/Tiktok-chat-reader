import { config } from "../config";
import type {
  ConnectionInfo,
  ConnectionState,
  ConnectionType,
  StreamStats,
} from "../types";
import { logger } from "../utils/logger";
import { cleanUsername, isValidUsername, parseError } from "../utils/sanitize";
import { EulerService } from "./euler.service";
import { TikTokService } from "./tiktok.service";
import type { WebSocketService } from "./websocket.service";

/**
 * Default empty stream stats used when no connection is active.
 */
const DEFAULT_STATS: Readonly<StreamStats> = Object.freeze({
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
});

/**
 * Manages connections to TikTok live streams via multiple backends
 * (TikTok-Live-Connector and Euler WebSocket API) with automatic
 * fallback support.
 */
export class ConnectionManager {
  private readonly tiktokService: TikTokService;
  private readonly eulerService: EulerService;
  private readonly wsService: WebSocketService;

  private state: ConnectionState;
  private connectLock = false;
  private abortController: AbortController | null = null;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
    this.tiktokService = new TikTokService(wsService);
    this.eulerService = new EulerService(wsService);
    this.state = this.createDefaultState();
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Connects to a TikTok live stream.
   *
   * @param uniqueId  - TikTok username (with or without @).
   * @param connectionType - Which backend(s) to use ("connector" | "euler" | "auto").
   * @param options   - Extra options forwarded to the connector.
   * @throws If already connecting, the username is invalid, or all methods fail.
   */
  async connect(
    uniqueId: string,
    connectionType?: ConnectionType,
    options: Record<string, unknown> = {},
  ): Promise<void> {
    if (this.connectLock) {
      throw new Error("Connection attempt already in progress");
    }

    this.connectLock = true;
    this.abortController = new AbortController();

    try {
      const cleaned = cleanUsername(uniqueId);

      if (!isValidUsername(cleaned)) {
        throw new Error(
          `Invalid TikTok username: "${uniqueId}". ` +
            "Usernames may only contain letters, numbers, underscores and dots.",
        );
      }

      // Tear down any existing connection before starting a new one.
      this.disconnectAllQuietly();

      const type = connectionType ?? config.connection.defaultType ?? "auto";

      this.updateState({
        type,
        activeMethod: null,
        status: "connecting",
        uniqueId: cleaned,
        connectedSince: null,
        failureReason: null,
        fallbackUsed: false,
      });

      await this.executeConnection(type, cleaned, options);
    } catch (err: unknown) {
      this.updateState({
        status: "failed",
        failureReason: parseError(err),
      });
      throw err;
    } finally {
      this.connectLock = false;
      this.abortController = null;
    }
  }

  /**
   * Disconnects any active connection and resets state.
   */
  disconnect(): void {
    this.abortController?.abort();
    this.disconnectAllQuietly();

    this.state = {
      ...this.createDefaultState(),
      type: this.state.type, // preserve last-used type preference
    };
    this.broadcastState();
  }

  /**
   * Returns current stream statistics from whichever backend is active.
   */
  getStats(): StreamStats {
    if (this.tiktokService.isConnected()) {
      return this.tiktokService.getStats();
    }
    if (this.eulerService.isConnected()) {
      return this.eulerService.getStats();
    }
    return { ...DEFAULT_STATS };
  }

  /**
   * Whether any backend is currently connected.
   */
  isConnected(): boolean {
    return this.tiktokService.isConnected() || this.eulerService.isConnected();
  }

  /**
   * Full connection info snapshot (state + stats + versions).
   */
  getConnectionInfo(): ConnectionInfo {
    return {
      state: { ...this.state },
      stats: this.getStats(),
      connectorVersion: this.tiktokService.getConnectorVersion(),
    };
  }

  /**
   * Shallow copy of the current connection state.
   */
  getState(): ConnectionState {
    return { ...this.state };
  }

  // ─── Connection Strategies ───────────────────────────────────

  /**
   * Routes to the correct connection strategy.
   */
  private async executeConnection(
    type: ConnectionType,
    uniqueId: string,
    options: Record<string, unknown>,
  ): Promise<void> {
    switch (type) {
      case "connector":
        await this.connectViaConnector(uniqueId, options);
        break;
      case "euler":
        await this.connectViaEuler(uniqueId);
        break;
      case "auto":
      default:
        await this.connectAuto(uniqueId, options);
        break;
    }
  }

  /**
   * Connects exclusively through TikTok-Live-Connector.
   */
  private async connectViaConnector(
    uniqueId: string,
    options: Record<string, unknown>,
  ): Promise<void> {
    logger.connection(`Connecting via TikTok-Live-Connector for @${uniqueId}…`);

    try {
      this.throwIfAborted();
      await this.tiktokService.connect(uniqueId, options);
      this.markConnected("connector");
      logger.success("Connected via TikTok-Live-Connector");
    } catch (err: unknown) {
      const message = `TikTok-Live-Connector failed: ${parseError(err)}`;
      logger.error(message);
      throw new Error(message);
    }
  }

  /**
   * Connects exclusively through the Euler WebSocket API.
   */
  private async connectViaEuler(uniqueId: string): Promise<void> {
    logger.connection(`Connecting via Euler WebSocket API for @${uniqueId}…`);

    try {
      this.throwIfAborted();
      await this.eulerService.connect(uniqueId);
      this.markConnected("euler");
      logger.success("Connected via Euler WebSocket API");
    } catch (err: unknown) {
      const message = `Euler WebSocket API failed: ${parseError(err)}`;
      logger.error(message);
      throw new Error(message);
    }
  }

  /**
   * Tries TikTok-Live-Connector first, then falls back to Euler
   * if configured to do so.
   */
  private async connectAuto(
    uniqueId: string,
    options: Record<string, unknown>,
  ): Promise<void> {
    logger.connection(
      `Auto-connect: trying TikTok-Live-Connector first for @${uniqueId}…`,
    );

    // ── Attempt 1: TikTok-Live-Connector ──
    let connectorError: unknown;

    try {
      this.throwIfAborted();
      await this.tiktokService.connect(uniqueId, options);
      this.markConnected("connector", false);
      logger.success("Auto-connect: connected via TikTok-Live-Connector");
      return;
    } catch (err: unknown) {
      connectorError = err;
      logger.warn(
        `Auto-connect: TikTok-Live-Connector failed: ${parseError(err)}`,
      );
    }

    // ── Attempt 2: Euler fallback ──
    if (!config.connection.fallbackEnabled) {
      throw new Error(
        "TikTok-Live-Connector failed and fallback is disabled. " +
          `Reason: ${parseError(connectorError)}`,
      );
    }

    logger.connection(
      `Auto-connect: falling back to Euler WebSocket API for @${uniqueId}…`,
    );

    try {
      this.throwIfAborted();
      await this.eulerService.connect(uniqueId);
      this.markConnected("euler", true);
      logger.success("Auto-connect: connected via Euler WebSocket API (fallback)");

      this.wsService.broadcast("toast", {
        message:
          "Connected via Euler fallback (TikTok-Live-Connector was unavailable)",
        type: "warning",
      });
    } catch (eulerError: unknown) {
      throw new Error(
        "All connection methods failed. " +
          `Connector: ${parseError(connectorError)}. ` +
          `Euler: ${parseError(eulerError)}`,
      );
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Updates `this.state` with the supplied partial and broadcasts.
   */
  private updateState(partial: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...partial };
    this.broadcastState();
  }

  /**
   * Marks the connection as successfully established.
   */
  private markConnected(
    method: ConnectionState["activeMethod"],
    fallbackUsed?: boolean,
  ): void {
    this.updateState({
      activeMethod: method,
      status: "connected",
      connectedSince: new Date().toISOString(),
      failureReason: null,
      ...(fallbackUsed !== undefined && { fallbackUsed }),
    });
  }

  /**
   * Disconnects both backends, swallowing individual errors.
   */
  private disconnectAllQuietly(): void {
    for (const [name, service] of [
      ["TikTok", this.tiktokService],
      ["Euler", this.eulerService],
    ] as const) {
      try {
        (service as TikTokService | EulerService).disconnect();
      } catch (err: unknown) {
        logger.warn(`${name} disconnect error: ${parseError(err)}`);
      }
    }
  }

  /**
   * Throws if the current connection attempt was cancelled via `disconnect()`.
   */
  private throwIfAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw new Error("Connection attempt was cancelled");
    }
  }

  /**
   * Sends the current state to all WebSocket clients.
   */
  private broadcastState(): void {
    this.wsService.broadcast("connectionState", { ...this.state });
  }

  /**
   * Returns a fresh default connection state.
   */
  private createDefaultState(): ConnectionState {
    return {
      type: "auto",
      activeMethod: null,
      status: "disconnected",
      uniqueId: null,
      connectedSince: null,
      failureReason: null,
      fallbackUsed: false,
    };
  }
}
