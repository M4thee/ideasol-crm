

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  DEFAULT_BUSINESS_AREA_PERMISSIONS,
  type BusinessAreaPermissions,
} from "@/lib/businessAreas";

export type CurrentProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  manager_id: string | null;
  business_areas: BusinessAreaPermissions;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

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
    .select("id, email, display_name, role, manager_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Błąd pobierania profilu:", profileError);
    return null;
  }

  const { data: permissionData, error: permissionError } = await supabase
    .from("user_permissions")
    .select("ideasol, ideatermo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (permissionError) {
    console.warn(
      "Nie udało się pobrać uprawnień obszarów działalności; używam bezpiecznej zgodności IdeaSol.",
      permissionError
    );
  }

  const businessAreas: BusinessAreaPermissions = permissionData
    ? {
        ideasol: permissionData.ideasol === true,
        ideatermo: permissionData.ideatermo === true,
      }
    : DEFAULT_BUSINESS_AREA_PERMISSIONS;

  if (!profileData) {
    return {
      id: user.id,
      email: user.email || null,
      display_name: null,
      role: null,
      manager_id: null,
      business_areas: businessAreas,
    };
  }

  return {
    ...(profileData as Omit<CurrentProfile, "business_areas">),
    business_areas: businessAreas,
  };
}
