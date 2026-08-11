import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import { getProfitAdminClient } from "@/lib/profit/admin";
import {
  normalizePolishPhoneNumber,
  removePolishDiacritics,
  sendSmsApiMessage,
} from "@/lib/smsapi";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Nieznany błąd");
}

export async function POST(request: Request, context: RouteContext) {
  const admin = await requireAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień administratora." }, { status: 403 });
  }

  let smsMessageId: string | null = null;

  try {
    const { id: clientId } = await context.params;
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono klienta." }, { status: 404 });
    }

    const profit = getProfitAdminClient();
    const { data: profitUser, error: userError } = await profit
      .from("profit_users")
      .select("id,idea_id,phone_e164")
      .eq("crm_client_id", clientId)
      .maybeSingle();

    if (userError) throw userError;
    if (!profitUser) {
      return NextResponse.json(
        { ok: false, error: "Najpierw włącz klientowi dostęp do IdeaSol Profit." },
        { status: 400 }
      );
    }

    const { data: balance, error: balanceError } = await profit
      .from("user_points_balances")
      .select("available_points")
      .eq("user_id", profitUser.id)
      .maybeSingle();
    if (balanceError) throw balanceError;

    const recipientPhone = normalizePolishPhoneNumber(profitUser.phone_e164);
    if (!recipientPhone) {
      return NextResponse.json(
        { ok: false, error: "Konto Profit nie ma poprawnego polskiego numeru telefonu." },
        { status: 400 }
      );
    }

    const availablePoints = Math.max(0, Math.trunc(Number(balance?.available_points || 0)));
    const message = removePolishDiacritics(
      `Dzien dobry. Zarejestrowalismy Cie w programie lojalnosciowym IdeaSol Profit. Twoje konto na start zostalo zasilone ${availablePoints} kWpkt. Wymieniaj je na nagrody z naszego katalogu. Dokoncz rejestracje logujac sie swoim IdeaID lub numerem telefonu. Twoj unikalny IdeaID to: ${profitUser.idea_id}. Pozdrawiamy, Zespol IdeaSol. https://profit.ideasol.pl`
    );
    const sender = "IdeaSol";

    const { data: smsLog, error: smsLogError } = await supabaseAdmin
      .from("sms_messages")
      .insert({
        client_id: clientId,
        sale_id: null,
        sent_by_user_id: admin.id,
        recipient_phone: recipientPhone,
        sender,
        message,
        status: "pending",
        provider: "smsapi",
        message_type: "client_profit_welcome",
      })
      .select("id")
      .single();

    if (smsLogError) {
      throw new Error(`Nie udało się zapisać historii SMS: ${smsLogError.message}`);
    }
    smsMessageId = smsLog.id;

    try {
      const result = await sendSmsApiMessage({ to: recipientPhone, message, sender });

      await supabaseAdmin
        .from("sms_messages")
        .update({
          status: "sent",
          provider_message_id: result.providerMessageId || null,
          provider_response: {
            response: result.raw,
            testMode: result.testMode,
            intendedRecipientPhone: result.intendedRecipientPhone,
            actualRecipientPhone: result.actualRecipientPhone,
          },
          sent_at: new Date().toISOString(),
        })
        .eq("id", smsMessageId);

      if (result.intendedRecipientPhone === result.actualRecipientPhone) {
        const [activityResult, auditResult] = await Promise.all([
          supabaseAdmin.from("client_activities").insert({
            client_id: clientId,
            created_by: admin.id,
            activity_type: "sms",
            contact_type: "sms",
            status: "sent",
            description: `IdeaSol Profit - SMS powitalny: ${message}`,
          }),
          profit.from("audit_log").insert({
            actor_type: "crm_admin",
            actor_id: admin.id,
            action: "profit_welcome_sms_sent",
            entity_type: "profit_user",
            entity_id: profitUser.id,
            after_data: {
              idea_id: profitUser.idea_id,
              available_points: availablePoints,
              sms_message_id: smsMessageId,
            },
            reason: "Powitalny SMS wysłany z karty klienta CRM",
          }),
        ]);

        if (activityResult.error) {
          console.error("Nie udało się zapisać aktywności powitalnego SMS Profit", activityResult.error);
        }
        if (auditResult.error) {
          console.error("Nie udało się zapisać audytu powitalnego SMS Profit", auditResult.error);
        }
      }

      return NextResponse.json({
        ok: true,
        smsMessageId,
        message,
        testMode: result.testMode,
        actualRecipientPhone: result.actualRecipientPhone,
      });
    } catch (sendError) {
      const errorMessage = serializeError(sendError);
      await supabaseAdmin
        .from("sms_messages")
        .update({ status: "failed", error_message: errorMessage })
        .eq("id", smsMessageId);
      throw sendError;
    }
  } catch (error) {
    console.error("Błąd powitalnego SMS IdeaSol Profit", error);
    return NextResponse.json(
      { ok: false, error: serializeError(error), smsMessageId },
      { status: 500 }
    );
  }
}
