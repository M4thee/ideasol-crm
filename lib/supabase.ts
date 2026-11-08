import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const legacyStorageKey = "ideasol-crm-auth";

function getProjectRefFromSupabaseUrl(url: string) {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return "";
  }
}

const projectRef = getProjectRefFromSupabaseUrl(supabaseUrl);
const storageKey = `ideasol-crm-auth-${projectRef || "default"}`;

function sessionBelongsToCurrentSupabase(rawSession: string) {
  try {
    const session = JSON.parse(rawSession) as { access_token?: string };
    const payloadPart = session.access_token?.split(".")[1];

    if (!payloadPart) return false;

    const normalizedPayload = payloadPart
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalizedPayload)) as { iss?: string };

    if (!payload.iss) return false;

    return new URL(payload.iss).origin === new URL(supabaseUrl).origin;
  } catch {
    return false;
  }
}

function migrateSupabaseSessionStorage() {
  if (typeof window === "undefined") return;

  if (!projectRef) return;

  const defaultStorageKey = `sb-${projectRef}-auth-token`;
  const customSession = window.localStorage.getItem(storageKey);
  const defaultSession = window.localStorage.getItem(defaultStorageKey);
  const legacySession = window.localStorage.getItem(legacyStorageKey);
  let matchingCustomSession =
    customSession && sessionBelongsToCurrentSupabase(customSession)
      ? customSession
      : null;
  const matchingDefaultSession =
    defaultSession && sessionBelongsToCurrentSupabase(defaultSession)
      ? defaultSession
      : null;
  const matchingLegacySession =
    legacySession && sessionBelongsToCurrentSupabase(legacySession)
      ? legacySession
      : null;

  if (customSession && !matchingCustomSession) {
    window.localStorage.removeItem(storageKey);
  }

  if (defaultSession && !matchingDefaultSession) {
    window.localStorage.removeItem(defaultStorageKey);
  }

  if (!matchingCustomSession && (matchingDefaultSession || matchingLegacySession)) {
    matchingCustomSession = matchingDefaultSession || matchingLegacySession;
    window.localStorage.setItem(
      storageKey,
      matchingCustomSession || ""
    );
  }

  if (!matchingDefaultSession && matchingCustomSession) {
    window.localStorage.setItem(defaultStorageKey, matchingCustomSession);
  }

  if (matchingLegacySession) {
    window.localStorage.removeItem(legacyStorageKey);
  }
}


migrateSupabaseSessionStorage();

function clearBrokenSupabaseSession() {
  if (typeof window === "undefined") return;

  try {
    const projectRef = getProjectRefFromSupabaseUrl(supabaseUrl);

    if (projectRef) {
      window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
    }

    window.localStorage.removeItem(storageKey);
  } catch (error) {
    console.error("Failed to clear Supabase session", error);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey,
  },
});

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, _session) => {
    // noop - keeps auth listener alive
  });

  supabase.auth.getSession().catch((error) => {
    const message = String(error?.message || error || "");

    if (
      message.includes("Invalid Refresh Token") ||
      message.includes("Refresh Token Not Found")
    ) {
      clearBrokenSupabaseSession();
      window.location.reload();
    }
  });
}
