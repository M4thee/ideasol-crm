import { NextResponse } from "next/server";
import { requireClientAccessRequest } from "@/lib/auth/requireClientAccessRequest";
import {
  getProfitAdminClient,
  ProfitConfigurationError,
} from "@/lib/profit/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function errorMessage(error: unknown) {
  if (error instanceof ProfitConfigurationError) return error.message;
  if (error instanceof Error) return error.message;
  return "Nie udało się pobrać danych IdeaSol Profit.";
}

export async function GET(request: Request, context: RouteContext) {
  const { id: clientId } = await context.params;
  const access = await requireClientAccessRequest(request, clientId);

  if (!access) {
    return NextResponse.json({ ok: false, error: "Brak dostępu do klienta." }, { status: 403 });
  }

  try {
    const profit = getProfitAdminClient();
    const { data: user, error: userError } = await profit
      .from("profit_users")
      .select(
        "id,idea_id,account_status,rewards_locked,joined_at,activated_at,crm_link_status,is_ideasol_customer"
      )
      .eq("crm_client_id", clientId)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return NextResponse.json({ ok: true, profit: null });
    }

    const [balanceResult, adminRegistrationResult] = await Promise.all([
      profit
        .from("user_points_balances")
        .select("available_points,pending_points,reserved_points")
        .eq("user_id", user.id)
        .maybeSingle(),
      profit
        .from("audit_log")
        .select("id,actor_id,created_at")
        .eq("action", "profit_user_created_from_crm")
        .eq("entity_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (balanceResult.error) throw balanceResult.error;
    if (adminRegistrationResult.error) throw adminRegistrationResult.error;

    return NextResponse.json({
      ok: true,
      profit: {
        ...user,
        registration_source: adminRegistrationResult.data ? "admin" : "client",
        registered_by_admin_id: adminRegistrationResult.data?.actor_id || null,
        balance: balanceResult.data || {
          available_points: 0,
          pending_points: 0,
          reserved_points: 0,
        },
      },
    });
  } catch (error) {
    console.error("Błąd pobierania Profit na karcie klienta", error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: error instanceof ProfitConfigurationError ? 503 : 500 }
    );
  }
}
