import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncProfitSellerByCrmUserId } from "@/lib/profit/sellers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sesja wygasła. Zaloguj się ponownie." }, { status: 401 });
  }

  try {
    const synced = await syncProfitSellerByCrmUserId(user.id);
    if (!synced) {
      return NextResponse.json(
        { ok: false, error: "Link Profit jest dostępny tylko dla aktywnego użytkownika CRM." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      code: synced.seller.referral_code,
      url: synced.registrationUrl,
    });
  } catch (error) {
    console.error("Nie udało się przygotować linku doradcy Profit", error);
    return NextResponse.json(
      { ok: false, error: "Nie udało się przygotować linku doradcy. Spróbuj ponownie." },
      { status: 500 }
    );
  }
}
