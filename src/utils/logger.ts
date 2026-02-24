function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export const logger = {
  info(msg: string, ...args: any[]) {
    console.log(`[${timestamp()}] ℹ️  ${msg}`, ...args);
  },
  success(msg: string, ...args: any[]) {
    console.log(`[${timestamp()}] ✅ ${msg}`, ...args);
  },
  warn(msg: string, ...args: any[]) {
    console.warn(`[${timestamp()}] ⚠️  ${msg}`, ...args);
  },
  error(msg: string, ...args: any[]) {
    console.error(`[${timestamp()}] ❌ ${msg}`, ...args);
  },
  tiktok(msg: string, ...args: any[]) {
    console.log(`[${timestamp()}] 🎵 ${msg}`, ...args);
  },
  ws(msg: string, ...args: any[]) {
    console.log(`[${timestamp()}] 🔌 ${msg}`, ...args);
  },
  euler(msg: string, ...args: any[]) {
    console.log(`[${timestamp()}] ⚡ ${msg}`, ...args);
  },
  connection(msg: string, ...args: any[]) {
    console.log(`[${timestamp()}] 🔗 ${msg}`, ...args);
  },
};
