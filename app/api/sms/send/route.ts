

import { NextResponse } from "next/server";
import { requireSmsRequest } from "@/lib/auth/requireSmsRequest";
import {
  normalizePolishPhoneNumber,
  removePolishDiacritics,
  sendSmsApiMessage,
} from "@/lib/smsapi";
import { supabaseAdmin } from "@/lib/supabase/admin";

type SendSmsRequest = {
  clientId?: string | null;
  saleId?: string | null;
  meetingId?: string | null;
  phone?: string;
  message?: string;
  messageType?: string;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export async function POST(request: Request) {
  let smsMessageId: string | null = null;

  try {
    const profile = await requireSmsRequest(request);
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Brak uprawnienia SMS." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as SendSmsRequest;
    const recipientPhone = normalizePolishPhoneNumber(String(body.phone || ""));
    const message = removePolishDiacritics(body.message).trim();
    const sender = process.env.SMSAPI_SENDER?.trim() || "";
    const senderLabel = sender || "SMSAPI_DEFAULT";
    const messageType = String(body.messageType || "manual").trim() || "manual";

    if (!recipientPhone) {
      return NextResponse.json(
        { ok: false, error: "Brak numeru telefonu odbiorcy SMS." },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Brak treści wiadomości SMS." },
        { status: 400 }
      );
    }

    const { data: smsLog, error: smsLogError } = await supabaseAdmin
      .from("sms_messages")
      .insert({
        client_id: body.clientId || null,
        sale_id: body.saleId || null,
        meeting_id: body.meetingId || null,
        sent_by_user_id: profile.id,
        recipient_phone: recipientPhone,
        sender: senderLabel,
        message,
        status: "pending",
        provider: "smsapi",
        message_type: messageType,
      })
      .select("id")
      .single();

    if (smsLogError) {
      console.error("Błąd zapisu logu SMS przed wysyłką:", smsLogError);
      return NextResponse.json(
        { ok: false, error: "Nie udało się zapisać logu SMS przed wysyłką." },
        { status: 500 }
      );
    }

    smsMessageId = smsLog.id;

    try {
      const result = await sendSmsApiMessage({
        to: recipientPhone,
        message,
        sender,
      });

      const { error: updateError } = await supabaseAdmin
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

      if (updateError) {
        console.error("Błąd aktualizacji logu SMS po wysyłce:", updateError);
      }

      if (
        body.clientId &&
        result.intendedRecipientPhone === result.actualRecipientPhone
      ) {
        const { error: activityError } = await supabaseAdmin
          .from("client_activities")
          .insert({
            client_id: body.clientId,
            created_by: profile.id,
            activity_type: "sms",
            contact_type: "sms",
            status: "sent",
            description: message,
          });

        if (activityError) {
          console.error("Nie udało się zapisać aktywności SMS klienta:", activityError);
        }
      }

      return NextResponse.json({
        ok: true,
        smsMessageId,
        providerMessageId: result.providerMessageId || null,
        providerResponse: result.raw,
        testMode: result.testMode,
        actualRecipientPhone: result.actualRecipientPhone,
      });
    } catch (smsError) {
      const details = serializeError(smsError);
      const errorMessage =
        typeof details === "object" && details !== null && "message" in details
          ? String((details as { message?: unknown }).message || "")
          : String(details || "");

      if (smsMessageId) {
        const { error: updateError } = await supabaseAdmin
          .from("sms_messages")
          .update({
            status: "failed",
            error_message: errorMessage || "Nie udało się wysłać SMS przez SMSAPI.",
            provider_response: details,
          })
          .eq("id", smsMessageId);

        if (updateError) {
          console.error("Błąd aktualizacji logu SMS po błędzie wysyłki:", updateError);
        }
      }

      console.error("Błąd wysyłki SMSAPI:", details);

      return NextResponse.json(
        {
          ok: false,
          error: "Nie udało się wysłać SMS.",
          details,
          smsMessageId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const details = serializeError(error);
    console.error("Błąd endpointu wysyłki SMS:", details);

    return NextResponse.json(
      { ok: false, error: "Nie udało się obsłużyć wysyłki SMS.", details, smsMessageId },
      { status: 500 }
    );
  }
}
