"use client";

import { useEffect } from "react";

function serializeValue(value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "string") return value;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function sendClientLog(level: string, source: string, message: string, metadata: Record<string, unknown>) {
  const payload = JSON.stringify({ level, source, message, metadata });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/v1/logs", blob);
    return;
  }

  fetch("/api/v1/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function GlobalLogCapture() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      sendClientLog("error", "client_error", event.message || "Browser error", {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: serializeValue(event.error),
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      sendClientLog("error", "client_unhandled_rejection", "Unhandled browser promise rejection", {
        reason: serializeValue(event.reason),
      });
    };

    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args) => {
      originalError(...args);
      sendClientLog("error", "client_console", args.map(String).join(" ").slice(0, 1000), {
        args: args.map(serializeValue),
      });
    };

    console.warn = (...args) => {
      originalWarn(...args);
      sendClientLog("warn", "client_console", args.map(String).join(" ").slice(0, 1000), {
        args: args.map(serializeValue),
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
