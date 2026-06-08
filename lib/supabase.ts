import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const storageKey = "ideasol-crm-auth";

function getProjectRefFromSupabaseUrl(url: string) {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return "";
  }
}

function migrateSupabaseSessionStorage() {
  if (typeof window === "undefined") return;

  const projectRef = getProjectRefFromSupabaseUrl(supabaseUrl);
  if (!projectRef) return;

  const defaultStorageKey = `sb-${projectRef}-auth-token`;
  const customSession = window.localStorage.getItem(storageKey);
  const defaultSession = window.localStorage.getItem(defaultStorageKey);

  if (!customSession && defaultSession) {
    window.localStorage.setItem(storageKey, defaultSession);
  }

  if (!defaultSession && customSession) {
    window.localStorage.setItem(defaultStorageKey, customSession);
  }
}

migrateSupabaseSessionStorage();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey,
  },
});