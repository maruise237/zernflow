import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";

type AutomationEventInsert = Database["public"]["Tables"]["automation_events"]["Insert"];

export type AutomationEventStatus = "info" | "success" | "skipped" | "error";

export async function recordAutomationEvent(
  supabase: SupabaseClient<Database>,
  event: Omit<AutomationEventInsert, "metadata" | "status"> & {
    status?: AutomationEventStatus;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("automation_events").insert({
      ...event,
      status: event.status || "info",
      metadata: (event.metadata || {}) as Json,
    });
  } catch (error) {
    console.error("Failed to record automation event:", error);
  }
}
