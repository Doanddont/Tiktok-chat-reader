export const config = {
  port: Number.parseInt(Bun.env.PORT || "8091", 10),
  tiktok: {
    enableExtendedGiftInfo: true,
    requestPollingIntervalMs: 2000,
    sessionId: Bun.env.TIKTOK_SESSION_ID || undefined,
  },
  connection: {
    cooldownMs: 3000,
    maxReconnectAttempts: 5,
    reconnectDelayMs: 5000,
  },
  limits: {
    maxChatMessages: 300,
    maxEventMessages: 200,
  },
} as const;
