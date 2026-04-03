import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function fetchDemoMode(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("demo_mode")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("fetchDemoMode:", error);
    return false;
  }

  return Boolean(data?.demo_mode);
}
