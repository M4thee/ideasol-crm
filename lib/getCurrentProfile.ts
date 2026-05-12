

import { supabase } from "@/lib/supabase";

export type CurrentProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("Błąd pobierania użytkownika:", authError);
    return null;
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Błąd pobierania profilu:", profileError);
    return null;
  }

  if (!profileData) {
    return {
      id: user.id,
      email: user.email || null,
      display_name: null,
      role: null,
    };
  }

  return profileData as CurrentProfile;
}