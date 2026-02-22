const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

export function sanitizeHtml(str: string): string {
  return String(str).replace(/[&<>"'`=\/]/g, (s) => ENTITY_MAP[s] || s);
}

export function cleanUsername(username: string): string {
  return username.replace(/^@/, "").trim().toLowerCase();
}

export function parseError(err: any): string {
  const message = err?.message || String(err);

  if (message.includes("LIVE has ended") || message.includes("ended")) {
    return "The live stream has ended or the user is not currently live.";
  }
  if (message.includes("not found") || message.includes("404")) {
    return "User not found. Please check the username.";
  }
  if (message.includes("rate limit") || message.includes("429")) {
    return "Rate limited by TikTok. Please wait and try again.";
  }
  if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED")) {
    return "Network error. Check your internet connection.";
  }
  if (message.includes("CAPTCHA")) {
    return "TikTok is showing a CAPTCHA. Try using a session ID.";
  }

  return message;
}
