import { recordAppLog } from "@/lib/app-logs";
import { createServiceClient } from "@/lib/supabase/server";

let installed = false;
let recording = false;

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

function toMessage(args: unknown[]) {
  return args
    .map((arg) => (arg instanceof Error ? arg.message : typeof arg === "string" ? arg : JSON.stringify(serializeValue(arg))))
    .join(" ")
    .slice(0, 1000);
}

async function recordServerLog(level: "error" | "warn", source: string, message: string, metadata: Record<string, unknown>) {
  if (recording) return;
  recording = true;

  try {
    const supabase = await createServiceClient();
    await recordAppLog(supabase, {
      workspace_id: null,
      level,
      source,
      message,
      metadata,
    });
  } catch {
    // Do not recurse if logging itself fails.
  } finally {
    recording = false;
  }
}

export function installServerLogCapture() {
  if (installed || process.env.NEXT_RUNTIME !== "nodejs") return;
  installed = true;

  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    originalError(...args);
    void recordServerLog("error", "server_console", toMessage(args) || "Server console error", {
      args: args.map(serializeValue),
    });
  };

  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    void recordServerLog("warn", "server_console", toMessage(args) || "Server console warning", {
      args: args.map(serializeValue),
    });
  };

  process.on("uncaughtException", (error) => {
    void recordServerLog("error", "server_uncaught_exception", error.message, {
      error: serializeValue(error),
    });
  });

  process.on("unhandledRejection", (reason) => {
    void recordServerLog("error", "server_unhandled_rejection", "Unhandled server promise rejection", {
      reason: serializeValue(reason),
    });
  });
}
