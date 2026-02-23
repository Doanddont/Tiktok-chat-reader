const cooldownMs = 3000;
const reconnectDelayMs = 5000;

export const config = {
  port: Number.parseInt(Bun.env.PORT || "8091", 10),
  tiktok: {
    enableExtendedGiftInfo: true,
    requestPollingIntervalMs: 2000,
    sessionId: Bun.env.TIKTOK_SESSION_ID || undefined,
  },
  connection: {
    cooldownMs,
    maxReconnectAttempts: 5,
    // Ensure reconnect delay is always >= cooldown to prevent silent failures
    reconnectDelayMs: Math.max(reconnectDelayMs, cooldownMs),
  },
  limits: {
    maxChatMessages: 300,
    maxEventMessages: 200,
  },
} as const;
