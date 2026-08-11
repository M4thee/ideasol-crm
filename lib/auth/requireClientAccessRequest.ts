import { supabaseAdmin } from "@/lib/supabase/admin";

export type ClientAccessProfile = {
  id: string;
  role: string;
};

export type AccessibleClient = {
  id: string;
  assigned_user_id: string | null;
};

export async function requireClientAccessRequest(
  request: Request,
  clientId: string
): Promise<{ profile: ClientAccessProfile; client: AccessibleClient } | null> {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) return null;

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) return null;

  const [{ data: profile, error: profileError }, { data: client, error: clientError }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("id,role").eq("id", user.id).maybeSingle(),
      supabaseAdmin
        .from("clients")
        .select("id,assigned_user_id")
        .eq("id", clientId)
        .maybeSingle(),
    ]);

  if (profileError || clientError || !profile || !client) return null;

  const role = String(profile.role || "seller").toLowerCase();
  const canViewAll = ["admin", "owner", "cc"].includes(role);
  let canAccess = canViewAll || client.assigned_user_id === profile.id;

  if (!canAccess && role === "manager" && client.assigned_user_id) {
    const { data: assignedProfile } = await supabaseAdmin
      .from("profiles")
      .select("manager_id")
      .eq("id", client.assigned_user_id)
      .maybeSingle();
    canAccess = assignedProfile?.manager_id === profile.id;
  }

  if (!canAccess) return null;

  return {
    profile: { id: profile.id, role },
    client,
  };
}
