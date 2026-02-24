export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "0.0.0.0",

  // TikTok-Live-Connector settings
  connector: {
    enableExtendedGiftInfo: true,
    requestPollingIntervalMs: 1000,
    sessionId: process.env.TIKTOK_SESSION_ID || undefined,
  },

  // Euler WebSocket API settings
  euler: {
    wsUrl: process.env.EULER_WS_URL || "wss://webcast5-ws-useast2a.tiktok.com/webcast/im/push/v2/",
    signatureProvider: process.env.EULER_SIGNATURE_URL || "",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  },

  // Connection behavior
  connection: {
    defaultType: (process.env.CONNECTION_TYPE as "connector" | "euler" | "auto") || "auto",
    fallbackEnabled: process.env.FALLBACK_ENABLED !== "false",
    connectorTimeoutMs: Number(process.env.CONNECTOR_TIMEOUT_MS) || 15000,
    eulerTimeoutMs: Number(process.env.EULER_TIMEOUT_MS) || 15000,
    reconnectDelayMs: Number(process.env.RECONNECT_DELAY_MS) || 5000,
    maxReconnectAttempts: Number(process.env.MAX_RECONNECT_ATTEMPTS) || 5,
    healthCheckIntervalMs: Number(process.env.HEALTH_CHECK_INTERVAL_MS) || 30000,
  },

  // Message limits
  limits: {
    maxChatMessages: 500,
    maxEvents: 500,
  },
};