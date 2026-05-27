


import type { CurrentProfile } from "./getCurrentProfile";
import {
  isAdmin,
  isManager,
  isOwner,
} from "./permissions";

import { supabaseAdmin } from "@/lib/supabase/admin";


export async function getVisibleUserIds(
  profile: CurrentProfile | null
): Promise<string[] | null> {
  if (!profile) {
    return [];
  }

  if (isAdmin(profile) || isOwner(profile)) {
    return null;
  }

  if (isManager(profile)) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("manager_id", profile.id);

    if (error) {
      console.error(
        "Błąd pobierania sellerów managera:",
        error
      );

      return [profile.id];
    }

    const sellerIds = (data || []).map((item) => item.id);

    return [profile.id, ...sellerIds];
  }

  return [profile.id];
}

export async function canAccessUserData(
  currentProfile: CurrentProfile | null,
  targetUserId: string
): Promise<boolean> {
  const visibleIds = await getVisibleUserIds(currentProfile);

  if (visibleIds === null) {
    return true;
  }

  return visibleIds.includes(targetUserId);
}