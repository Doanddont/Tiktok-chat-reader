export function sanitizeHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function cleanUsername(username: string): string {
  if (typeof username !== "string") return "";
  return username.replace(/^@/, "").trim().toLowerCase();
}

export function parseError(err: any): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String(err.message);
  return "Unknown error";
}

export function isValidUsername(username: string): boolean {
  if (typeof username !== "string") return false;
  const cleaned = cleanUsername(username);
  if (cleaned.length === 0 || cleaned.length > 50) return false;
  return /^[a-zA-Z0-9_.]+$/.test(cleaned);
}