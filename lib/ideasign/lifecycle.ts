import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const SALE_STATUS_AWAITING_IDEASIGN_SIGNATURE =
  "IdeaSign - oczekuje na podpis klienta";
export const SALE_STATUS_IDEASIGN_PARTIALLY_SIGNED =
  "IdeaSign - umowa podpisana 1/2 - oczekiwania na drugiego klienta";
export const SALE_STATUS_IDEASIGN_SIGNED_SINGLE =
  "IdeaSign - umowa podpisana - oczekiwanie na zaliczkę";
export const SALE_STATUS_IDEASIGN_SIGNED_DOUBLE =
  "IdeaSign - umowa podpisana 2/2 - oczekiwanie na zaliczkę";
export const SALE_STATUS_IDEASIGN_EXPIRED =
  "IdeaSign - czas na podpisanie minął";
export const SALE_STATUS_DOCUMENT_REVIEW =
  "Oczekuje na sprawdzenie dokumentów";

const LEGACY_SALE_STATUS_AWAITING_IDEASIGN_SIGNATURE =
  "Oczekuj na podpis elektroniczny";

export const ACTIVE_IDEASIGN_SALE_STATUSES = [
  LEGACY_SALE_STATUS_AWAITING_IDEASIGN_SIGNATURE,
  SALE_STATUS_AWAITING_IDEASIGN_SIGNATURE,
  SALE_STATUS_IDEASIGN_PARTIALLY_SIGNED,
] as const;

export function getConcludedIdeaSignSaleStatus(signerCount: number) {
  return signerCount > 1
    ? SALE_STATUS_IDEASIGN_SIGNED_DOUBLE
    : SALE_STATUS_IDEASIGN_SIGNED_SINGLE;
}

const TERMINAL_IDEASIGN_STATUSES = ["zawarta", "wygasła", "anulowana"];

export async function expireIdeaSignSession(params: {
  sessionId: string;
  saleId: string;
  now?: string;
}) {
  const now = params.now || new Date().toISOString();
  const { data: expired, error } = await supabaseAdmin
    .from("contract_signature_sessions")
    .update({ status: "wygasła", updated_at: now })
    .eq("id", params.sessionId)
    .lt("expires_at", now)
    .not("status", "in", `(${TERMINAL_IDEASIGN_STATUSES.join(",")})`)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Nie udało się oznaczyć procesu IdeaSign jako wygasłego: ${error.message}`);
  if (!expired) return false;

  const { error: saleError } = await supabaseAdmin
    .from("sales")
    .update({ status: SALE_STATUS_IDEASIGN_EXPIRED })
    .eq("id", params.saleId)
    .in("status", [...ACTIVE_IDEASIGN_SALE_STATUSES]);

  if (saleError) throw new Error(`Nie udało się zaktualizować statusu sprzedaży: ${saleError.message}`);
  return true;
}

export async function expireOverdueIdeaSignSessions(params?: {
  saleId?: string;
  now?: string;
}) {
  const now = params?.now || new Date().toISOString();
  let query = supabaseAdmin
    .from("contract_signature_sessions")
    .select("id, sale_id")
    .lt("expires_at", now)
    .not("status", "in", `(${TERMINAL_IDEASIGN_STATUSES.join(",")})`)
    .limit(500);

  if (params?.saleId) query = query.eq("sale_id", params.saleId);

  const { data, error } = await query;
  if (error) throw new Error(`Nie udało się odczytać wygasłych procesów IdeaSign: ${error.message}`);

  const results = await Promise.all(
    (data || []).map((session) =>
      expireIdeaSignSession({
        sessionId: session.id,
        saleId: session.sale_id,
        now,
      })
    )
  );

  return (data || []).filter((_, index) => results[index]);
}
