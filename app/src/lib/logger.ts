type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL: LogLevel =
  (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === "development" ? "debug" : "warn");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function formatMessage(level: LogLevel, args: unknown[]): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`;
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog("debug")) console.debug(formatMessage("debug", args));
  },
  info: (...args: unknown[]) => {
    if (shouldLog("info")) console.info(formatMessage("info", args));
  },
  warn: (...args: unknown[]) => {
    if (shouldLog("warn")) console.warn(formatMessage("warn", args));
  },
  error: (...args: unknown[]) => {
    if (shouldLog("error")) console.error(formatMessage("error", args));
  },
};
