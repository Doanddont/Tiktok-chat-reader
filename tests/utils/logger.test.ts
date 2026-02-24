import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { logger } from "../../src/utils/logger";

describe("logger", () => {
  let originalLog: typeof console.log;
  let originalWarn: typeof console.warn;
  let originalError: typeof console.error;
  let logs: string[];

  beforeEach(() => {
    logs = [];
    originalLog = console.log;
    originalWarn = console.warn;
    originalError = console.error;
    console.log = (...args: any[]) => logs.push(args.join(" "));
    console.warn = (...args: any[]) => logs.push(args.join(" "));
    console.error = (...args: any[]) => logs.push(args.join(" "));
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  test("info logs message", () => {
    logger.info("test message");
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("test message");
  });

  test("success logs message", () => {
    logger.success("test success");
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("test success");
  });

  test("warn logs message", () => {
    logger.warn("test warning");
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("test warning");
  });

  test("error logs message", () => {
    logger.error("test error");
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("test error");
  });

  test("tiktok logs message", () => {
    logger.tiktok("tiktok msg");
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("tiktok msg");
  });

  test("ws logs message", () => {
    logger.ws("ws msg");
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("ws msg");
  });

  test("euler logs message", () => {
    logger.euler("euler msg");
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("euler msg");
  });

  test("connection logs message", () => {
    logger.connection("conn msg");
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("conn msg");
  });
});
