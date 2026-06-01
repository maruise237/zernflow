import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";

type AppLogInsert = Database["public"]["Tables"]["app_logs"]["Insert"];

export async function recordAppLog(
  supabase: SupabaseClient<Database>,
  log: Omit<AppLogInsert, "metadata"> & { metadata?: Record<string, unknown> }
) {
  try {
    await supabase.from("app_logs").insert({
      ...log,
      metadata: (log.metadata || {}) as Json,
    });
  } catch (error) {
    console.error("Failed to record app log:", error);
  }
}
