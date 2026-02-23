const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

export const logger = {
  info(msg: string, ...args: any[]) {
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.blue}[INFO]${colors.reset} ${msg}`, ...args);
  },

  success(msg: string, ...args: any[]) {
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.green}[OK]${colors.reset} ${msg}`, ...args);
  },

  warn(msg: string, ...args: any[]) {
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.yellow}[WARN]${colors.reset} ${msg}`, ...args);
  },

  error(msg: string, ...args: any[]) {
    console.error(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.red}[ERROR]${colors.reset} ${msg}`, ...args);
  },

  tiktok(msg: string, ...args: any[]) {
    console.log(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.magenta}[TIKTOK]${colors.reset} ${msg}`,
      ...args,
    );
  },

  ws(msg: string, ...args: any[]) {
    console.log(`${colors.gray}[${timestamp()}]${colors.reset} ${colors.cyan}[WS]${colors.reset} ${msg}`, ...args);
  },
};
