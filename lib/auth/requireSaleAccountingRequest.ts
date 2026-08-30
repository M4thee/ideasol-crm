import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type SaleAccountingRequestProfile = {
  id: string;
  role: string;
  hasRealizationAccess: boolean;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function requireSaleAccountingRequest(
  request: Request,
  options: { requireRealization?: boolean } = {}
): Promise<SaleAccountingRequestProfile | null> {
  const accessToken = getBearerToken(request);
  if (!accessToken) return null;

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) return null;

  const [{ data: profile, error: profileError }, { data: permission, error: permissionError }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
      supabaseAdmin
        .from("user_permissions")
        .select("realization")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (profileError || permissionError || !profile) return null;

  const hasRealizationAccess = permission?.realization === true;
  if (options.requireRealization && !hasRealizationAccess) return null;

  return {
    id: profile.id,
    role: String(profile.role || "seller"),
    hasRealizationAccess,
  };
}

export async function canAccessSaleForAccounting(params: {
  userId: string;
  role: string;
  sellerId: string | null;
}) {
  const normalizedRole = params.role.toLowerCase();

  if (["admin", "owner", "cc"].includes(normalizedRole)) return true;
  if (params.sellerId === params.userId) return true;

  if (normalizedRole !== "manager" || !params.sellerId) return false;

  const { data: sellerProfile, error } = await supabaseAdmin
    .from("profiles")
    .select("manager_id")
    .eq("id", params.sellerId)
    .maybeSingle();

  if (error) return false;
  return sellerProfile?.manager_id === params.userId;
}
