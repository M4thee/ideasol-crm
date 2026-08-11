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

async function loadFullPointsHistory(
  profit: ReturnType<typeof getProfitAdminClient>,
  userId: string
) {
  const pageSize = 1000;
  const history: Array<Record<string, unknown>> = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await profit
      .from("points_ledger")
      .select(
        "id,entry_type,status,points,description,reason,earned_at,available_at,reserved_at,spent_at,cancelled_at,expires_at,created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    history.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return history;
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
        "id,idea_id,account_status,rewards_locked,joined_at,activated_at,crm_link_status,is_ideasol_customer,terms_accepted_at,privacy_accepted_at,current_terms_version,current_privacy_version,marketing_sms_consent,marketing_email_consent,marketing_phone_consent,marketing_consent_version,marketing_consents_updated_at,current_seller_id"
      )
      .eq("crm_client_id", clientId)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return NextResponse.json({ ok: true, profit: null });
    }

    const [balanceResult, adminRegistrationResult, pointsHistory, sellerResult] = await Promise.all([
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
      loadFullPointsHistory(profit, user.id),
      user.current_seller_id
        ? profit
            .from("profit_sellers")
            .select("id,crm_user_id,first_name,last_name,email,phone,referral_code")
            .eq("id", user.current_seller_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (balanceResult.error) throw balanceResult.error;
    if (adminRegistrationResult.error) throw adminRegistrationResult.error;
    if (sellerResult.error) throw sellerResult.error;

    return NextResponse.json({
      ok: true,
      profit: {
        ...user,
        registration_source: adminRegistrationResult.data ? "admin" : "client",
        registered_by_admin_id: adminRegistrationResult.data?.actor_id || null,
        current_seller: sellerResult.data,
        balance: balanceResult.data || {
          available_points: 0,
          pending_points: 0,
          reserved_points: 0,
        },
        points_history: pointsHistory,
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
