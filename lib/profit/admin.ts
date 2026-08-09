import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let profitAdminClient: SupabaseClient | null = null;

export class ProfitConfigurationError extends Error {
  constructor() {
    super("Brakuje serwerowej konfiguracji połączenia z IdeaSol Profit.");
    this.name = "ProfitConfigurationError";
  }
}

export function getProfitAdminClient() {
  if (profitAdminClient) return profitAdminClient;

  const url = process.env.PROFIT_SUPABASE_URL?.trim();
  const secretKey = process.env.PROFIT_SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey) {
    throw new ProfitConfigurationError();
  }

  profitAdminClient = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return profitAdminClient;
}
