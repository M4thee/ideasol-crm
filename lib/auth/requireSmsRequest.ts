import { supabaseAdmin } from "@/lib/supabase/admin";

export type SmsRequestProfile = {
  id: string;
  role: string;
};

export async function requireSmsRequest(
  request: Request
): Promise<SmsRequestProfile | null> {
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

  const [{ data: profile, error: profileError }, { data: permission, error: permissionError }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
      supabaseAdmin
        .from("user_permissions")
        .select("sms")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (profileError || permissionError || !profile || permission?.sms !== true) {
    return null;
  }

  return {
    id: profile.id,
    role: String(profile.role || "seller"),
  };
}

export async function canAccessSaleForSms(params: {
  userId: string;
  role: string;
  sellerId: string | null;
}) {
  const normalizedRole = params.role.toLowerCase();

  if (["admin", "owner", "cc"].includes(normalizedRole)) return true;
  if (params.sellerId === params.userId) return true;

  if (normalizedRole !== "manager" || !params.sellerId) return false;

  const { data: sellerProfile } = await supabaseAdmin
    .from("profiles")
    .select("manager_id")
    .eq("id", params.sellerId)
    .maybeSingle();

  return sellerProfile?.manager_id === params.userId;
}
