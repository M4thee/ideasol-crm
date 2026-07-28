import { supabaseAdmin } from "@/lib/supabase/admin";

export type AdminRequestProfile = {
  id: string;
  role: string;
};

export async function requireAdminRequest(
  request: Request
): Promise<AdminRequestProfile | null> {
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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") return null;

  return {
    id: profile.id,
    role: profile.role,
  };
}
