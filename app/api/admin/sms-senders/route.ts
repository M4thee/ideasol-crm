import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import { getSmsApiSenderNameStatus } from "@/lib/smsapi";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT_FIELDS =
  "sender_name,provider_status,provider_checked_at,created_at,updated_at";

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Nieznany błąd");
}

function normalizeSenderName(value: unknown) {
  return String(value || "").trim();
}

function validateSenderName(senderName: string) {
  if (!senderName) return "Podaj nazwę nadawcy.";
  if (senderName.length > 11) {
    return "Nazwa nadawcy może mieć maksymalnie 11 znaków.";
  }
  if (/\p{Cc}/u.test(senderName)) {
    return "Nazwa nadawcy zawiera niedozwolone znaki sterujące.";
  }
  return "";
}

async function loadSenderData() {
  const [sendersResponse, settingsResponse] = await Promise.all([
    supabaseAdmin
      .from("sms_sender_names")
      .select(SELECT_FIELDS)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("sms_sender_settings")
      .select("sender_name,updated_at")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (sendersResponse.error) {
    throw new Error(
      `Nie udało się pobrać nazw nadawcy: ${sendersResponse.error.message}`
    );
  }
  if (settingsResponse.error) {
    throw new Error(
      `Nie udało się pobrać aktywnej nazwy nadawcy: ${settingsResponse.error.message}`
    );
  }

  return {
    senders: sendersResponse.data || [],
    selectedSender: settingsResponse.data?.sender_name || "Test",
    updatedAt: settingsResponse.data?.updated_at || null,
  };
}

async function saveProviderStatus(params: {
  senderName: string;
  status: "ACTIVE" | "INACTIVE" | "NOT_FOUND" | "UNKNOWN";
  adminId: string;
}) {
  const checkedAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from("sms_sender_names").upsert(
    {
      sender_name: params.senderName,
      provider_status: params.status,
      provider_checked_at: checkedAt,
      created_by: params.adminId,
      updated_at: checkedAt,
    },
    { onConflict: "sender_name" }
  );

  if (error) {
    throw new Error(`Nie udało się zapisać nazwy nadawcy: ${error.message}`);
  }
}

export async function GET(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await loadSenderData()) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: serializeError(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { senderName?: string };
    const senderName = normalizeSenderName(body.senderName);
    const validationError = validateSenderName(senderName);

    if (validationError) {
      return NextResponse.json(
        { ok: false, error: validationError },
        { status: 400 }
      );
    }

    const provider = await getSmsApiSenderNameStatus(senderName);
    if (!provider.exists) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ta nazwa nie istnieje na koncie SMSAPI. Najpierw dodaj ją w SMSAPI, a potem ponów próbę w CRM.",
        },
        { status: 400 }
      );
    }

    await saveProviderStatus({
      senderName: provider.sender,
      status: provider.status,
      adminId: admin.id,
    });

    return NextResponse.json({
      ok: true,
      provider,
      ...(await loadSenderData()),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: serializeError(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      action?: "select" | "refresh";
      senderName?: string;
    };

    if (body.action === "refresh") {
      const { data: senders, error } = await supabaseAdmin
        .from("sms_sender_names")
        .select("sender_name");

      if (error) throw new Error(error.message);

      const results = await Promise.all(
        (senders || []).map(async (sender) => {
          const provider = await getSmsApiSenderNameStatus(sender.sender_name);
          await saveProviderStatus({
            senderName: sender.sender_name,
            status: provider.status,
            adminId: admin.id,
          });
          return provider;
        })
      );

      return NextResponse.json({
        ok: true,
        refreshed: results.length,
        ...(await loadSenderData()),
      });
    }

    if (body.action !== "select") {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowa operacja." },
        { status: 400 }
      );
    }

    const senderName = normalizeSenderName(body.senderName);
    const validationError = validateSenderName(senderName);
    if (validationError) {
      return NextResponse.json(
        { ok: false, error: validationError },
        { status: 400 }
      );
    }

    const provider = await getSmsApiSenderNameStatus(senderName);
    await saveProviderStatus({
      senderName,
      status: provider.status,
      adminId: admin.id,
    });

    if (!provider.exists || provider.status !== "ACTIVE") {
      return NextResponse.json(
        {
          ok: false,
          error: "Można wybrać tylko nazwę nadawcy ze statusem ACTIVE w SMSAPI.",
        },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("sms_sender_settings")
      .upsert({
        id: 1,
        sender_name: senderName,
        updated_by: admin.id,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      throw new Error(`Nie udało się zmienić nazwy nadawcy: ${updateError.message}`);
    }

    return NextResponse.json({ ok: true, ...(await loadSenderData()) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: serializeError(error) },
      { status: 500 }
    );
  }
}
