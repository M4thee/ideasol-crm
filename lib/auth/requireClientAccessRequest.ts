import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BusinessArea } from "@/lib/businessAreas";

export type ClientAccessProfile = {
  id: string;
  role: string;
  ideasol: boolean;
  ideatermo: boolean;
};

export type AccessibleClient = {
  id: string;
  assigned_user_id: string | null;
  business_area: BusinessArea;
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

  const [profileResponse, permissionResponse, clientResponse] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,role").eq("id", user.id).maybeSingle(),
      supabaseAdmin
        .from("user_permissions")
        .select("ideasol,ideatermo")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("clients")
        .select("id,assigned_user_id,business_area")
        .eq("id", clientId)
        .maybeSingle(),
    ]);

  let permission = permissionResponse.data;
  let client = clientResponse.data;

  // This compatibility path keeps the current IdeaSol application usable
  // before the local-only migration is deliberately applied to an environment.
  if (permissionResponse.error) {
    permission = { ideasol: true, ideatermo: false };
  }

  if (clientResponse.error) {
    const legacyClientResponse = await supabaseAdmin
      .from("clients")
      .select("id,assigned_user_id")
      .eq("id", clientId)
      .maybeSingle();

    if (!legacyClientResponse.error && legacyClientResponse.data) {
      client = {
        ...legacyClientResponse.data,
        business_area: "ideasol",
      };
    }
  }

  const profile = profileResponse.data;

  if (
    profileResponse.error ||
    !profile ||
    !permission ||
    !client
  ) {
    return null;
  }

  const role = String(profile.role || "seller").toLowerCase();
  const businessArea: BusinessArea =
    client.business_area === "ideatermo" ? "ideatermo" : "ideasol";
  const hasAreaAccess =
    businessArea === "ideatermo"
      ? permission.ideatermo === true
      : permission.ideasol === true;

  if (!hasAreaAccess) return null;

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
    profile: {
      id: profile.id,
      role,
      ideasol: permission.ideasol === true,
      ideatermo: permission.ideatermo === true,
    },
    client: {
      ...client,
      business_area: businessArea,
    },
  };
}
