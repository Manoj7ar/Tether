import { createClient } from "@supabase/supabase-js";
import { getAppConfig } from "@/lib/env";
import type { Database } from "./types";

type AccessTokenGetter = (() => Promise<string | null>) | null;

const config = getAppConfig();
let accessTokenGetter: AccessTokenGetter = null;

export function setSupabaseAccessTokenGetter(getter: AccessTokenGetter) {
  accessTokenGetter = getter;
}

export const supabase = createClient<Database>(
  config.supabaseUrl,
  config.supabasePublishableKey,
  {
    accessToken: async () => {
      if (!accessTokenGetter) {
        return null;
      }

      return accessTokenGetter();
    },
  },
);
