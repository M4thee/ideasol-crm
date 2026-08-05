import { supabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_SMS_SENDER = "Test";

export async function getConfiguredSmsSender() {
  const environmentFallback =
    process.env.SMSAPI_SENDER?.trim() || DEFAULT_SMS_SENDER;

  try {
    const { data, error } = await supabaseAdmin
      .from("sms_sender_settings")
      .select("sender_name")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Nie udało się pobrać globalnego pola nadawcy SMS:", error);
      return environmentFallback;
    }

    return String(data?.sender_name || "").trim() || environmentFallback;
  } catch (error) {
    console.error("Błąd pobierania globalnego pola nadawcy SMS:", error);
    return environmentFallback;
  }
}
