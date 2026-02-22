import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { logger } from "../../src/utils/logger";

describe("logger", () => {
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let logOutput: string[];
  let errorOutput: string[];

  beforeEach(() => {
    logOutput = [];
    errorOutput = [];
    originalLog = console.log;
    originalError = console.error;
    console.log = (...args: any[]) => logOutput.push(args.join(" "));
    console.error = (...args: any[]) => errorOutput.push(args.join(" "));
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
  });

  test("info logs with [INFO] tag", () => {
    logger.info("test message");
    expect(logOutput.length).toBe(1);
    expect(logOutput[0]).toContain("[INFO]");
    expect(logOutput[0]).toContain("test message");
  });

  test("success logs with [OK] tag", () => {
    logger.success("all good");
    expect(logOutput.length).toBe(1);
    expect(logOutput[0]).toContain("[OK]");
    expect(logOutput[0]).toContain("all good");
  });

  test("warn logs with [WARN] tag", () => {
    logger.warn("be careful");
    expect(logOutput.length).toBe(1);
    expect(logOutput[0]).toContain("[WARN]");
    expect(logOutput[0]).toContain("be careful");
  });

  test("error logs with [ERROR] tag to stderr", () => {
    logger.error("something broke");
    expect(errorOutput.length).toBe(1);
    expect(errorOutput[0]).toContain("[ERROR]");
    expect(errorOutput[0]).toContain("something broke");
  });

  test("tiktok logs with [TIKTOK] tag", () => {
    logger.tiktok("connected");
    expect(logOutput.length).toBe(1);
    expect(logOutput[0]).toContain("[TIKTOK]");
    expect(logOutput[0]).toContain("connected");
  });

  test("ws logs with [WS] tag", () => {
    logger.ws("client joined");
    expect(logOutput.length).toBe(1);
    expect(logOutput[0]).toContain("[WS]");
    expect(logOutput[0]).toContain("client joined");
  });

  test("includes timestamp", () => {
    logger.info("timestamped");
    // Timestamp format: YYYY-MM-DD HH:MM:SS
    expect(logOutput[0]).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });
});
