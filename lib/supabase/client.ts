import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let browserClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!browserClient) {
    const { url, key } = supabaseEnv();
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
