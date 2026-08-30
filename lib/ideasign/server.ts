import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizePolishPhoneNumber, sendSmsApiMessage } from "@/lib/smsapi";
import type { IdeaSignOtpPurpose, IdeaSignSessionDto, IdeaSignStatus } from "./types";
import { expireIdeaSignSession } from "./lifecycle";
import {
  IDEA_SIGN_ACCESS_COOKIE,
  IDEA_SIGN_ACCESS_TTL_SECONDS,
  IDEA_SIGN_CSRF_COOKIE,
  IDEA_SIGN_OTP_TTL_SECONDS,
  createOtpCode,
  createSecretToken,
  getRequestEvidence,
  hashOtp,
  maskEmail,
  phoneSuffix,
  safeEqualHex,
  sha256,
} from "./security";

type SignatureSessionRow = {
  id: string;
  transaction_id: string;
  sale_id: string;
  client_id: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  status: IdeaSignStatus;
  manifest_sha256: string;
  offered_at: string;
  expires_at: string;
  offeror_name: string;
  offeror_capacity: string;
};

type AccessSessionRow = {
  id: string;
  signature_session_id: string;
  signer_id: string;
  csrf_token_hash: string;
  expires_at: string;
  entry_verified_at: string | null;
  invalidated_at: string | null;
};

type SignerRow = {
  id: string;
  signature_session_id: string;
  signer_order: number;
  name: string;
  email: string;
  phone: string;
  status: "oczekuje" | "otwarty" | "uwierzytelniony" | "podpisany";
  signed_at: string | null;
};

export type IdeaSignAccessContext = {
  access: AccessSessionRow;
  signature: SignatureSessionRow;
  signer: SignerRow;
};

function isExpired(value: string) {
  return new Date(value).getTime() <= Date.now();
}

function getDemoOtp(request: Request) {
  if (process.env.NODE_ENV !== "production" && process.env.IDEASIGN_LOCAL_DELIVERY !== "live") {
    let hostname = "";
    try {
      hostname = new URL(request.url).hostname;
    } catch {
      return null;
    }
    if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "[::1]") {
      return null;
    }
    const configured = String(process.env.IDEASIGN_DEMO_OTP || "").trim();
    if (/^\d{6}$/.test(configured)) return configured;
    return "482913";
  }

  return null;
}

export async function appendIdeaSignAuditEvent(params: {
  signatureSessionId: string;
  signerId?: string | null;
  eventType: string;
  request: Request;
  eventData?: Record<string, unknown>;
}) {
  const { ipAddress, userAgent, sessionMetadata } = getRequestEvidence(params.request);
  const occurredAt = new Date().toISOString();
  const { data: eventHash, error } = await supabaseAdmin.rpc("ideasign_append_audit_event", {
    p_signature_session_id: params.signatureSessionId,
    p_signer_id: params.signerId || null,
    p_event_type: params.eventType,
    p_occurred_at: occurredAt,
    p_ip_address: ipAddress,
    p_user_agent: userAgent,
    p_session_metadata: sessionMetadata,
    p_event_data: params.eventData || {},
  });

  if (error) throw new Error(`Nie udało się zapisać audytu IdeaSign: ${error.message}`);
  return eventHash;
}

export async function getIdeaSignAccessContext(): Promise<IdeaSignAccessContext | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(IDEA_SIGN_ACCESS_COOKIE)?.value || "";
  if (!accessToken) return null;

  const { data: access, error: accessError } = await supabaseAdmin
    .from("contract_signature_access_sessions")
    .select("id, signature_session_id, signer_id, csrf_token_hash, expires_at, entry_verified_at, invalidated_at")
    .eq("access_token_hash", sha256(accessToken))
    .maybeSingle();

  if (accessError || !access || access.invalidated_at || isExpired(access.expires_at)) {
    return null;
  }

  const [{ data: signature, error: signatureError }, { data: signer, error: signerError }] = await Promise.all([
    supabaseAdmin
    .from("contract_signature_sessions")
    .select("id, transaction_id, sale_id, client_id, client_name, client_email, client_phone, status, manifest_sha256, offered_at, expires_at, offeror_name, offeror_capacity")
    .eq("id", access.signature_session_id)
    .maybeSingle(),
    supabaseAdmin
      .from("contract_signature_signers")
      .select("id, signature_session_id, signer_order, name, email, phone, status, signed_at")
      .eq("id", access.signer_id)
      .eq("signature_session_id", access.signature_session_id)
      .maybeSingle(),
  ]);

  if (signatureError || !signature || signerError || !signer) return null;

  if (isExpired(signature.expires_at) && !["zawarta", "anulowana", "wygasła"].includes(signature.status)) {
    await expireIdeaSignSession({ sessionId: signature.id, saleId: signature.sale_id });
    signature.status = "wygasła";
  }

  await supabaseAdmin
    .from("contract_signature_access_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", access.id);

  return {
    access: access as AccessSessionRow,
    signature: signature as SignatureSessionRow,
    signer: signer as SignerRow,
  };
}

export async function requireIdeaSignMutation(request: Request) {
  const context = await getIdeaSignAccessContext();
  if (!context) return null;

  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get(IDEA_SIGN_CSRF_COOKIE)?.value || "";
  const csrfHeader = request.headers.get("x-ideasign-csrf") || "";

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) return null;
  if (!safeEqualHex(sha256(csrfHeader), context.access.csrf_token_hash)) return null;

  return context;
}

export async function exchangeIdeaSignLink(token: string, request: Request) {
  const tokenHash = sha256(token);
  const { data: signer, error } = await supabaseAdmin
    .from("contract_signature_signers")
    .select("id, signature_session_id, link_expires_at, link_consumed_at")
    .eq("link_token_hash", tokenHash)
    .maybeSingle();

  const { data: signature } = signer
    ? await supabaseAdmin
        .from("contract_signature_sessions")
        .select("id, sale_id, status, expires_at")
        .eq("id", signer.signature_session_id)
        .maybeSingle()
    : { data: null };

  if (
    signature && signer &&
    (isExpired(signer.link_expires_at) || isExpired(signature.expires_at)) &&
    !["zawarta", "wygasła", "anulowana"].includes(signature.status)
  ) {
    await expireIdeaSignSession({ sessionId: signature.id, saleId: signature.sale_id });
  }

  if (
    error ||
    !signature || !signer ||
    signer.link_consumed_at ||
    isExpired(signer.link_expires_at) ||
    isExpired(signature.expires_at) ||
    ["zawarta", "wygasła", "anulowana"].includes(signature.status)
  ) {
    return null;
  }

  const accessToken = createSecretToken();
  const csrfToken = createSecretToken(24);
  const expiresAt = new Date(Date.now() + IDEA_SIGN_ACCESS_TTL_SECONDS * 1000).toISOString();
  const accessSessionId = randomUUID();

  const { error: accessError } = await supabaseAdmin
    .from("contract_signature_access_sessions")
    .insert({
      id: accessSessionId,
      signature_session_id: signature.id,
      signer_id: signer.id,
      access_token_hash: sha256(accessToken),
      csrf_token_hash: sha256(csrfToken),
      expires_at: expiresAt,
    });

  if (accessError) throw new Error(`Nie udało się utworzyć sesji IdeaSign: ${accessError.message}`);

  const now = new Date().toISOString();
  const { data: exchanged, error: exchangeError } = await supabaseAdmin
    .from("contract_signature_signers")
    .update({
      link_consumed_at: now,
      opened_at: now,
      status: "otwarty",
      updated_at: now,
    })
    .eq("id", signer.id)
    .is("link_consumed_at", null)
    .select("id")
    .maybeSingle();

  if (exchangeError || !exchanged) {
    await supabaseAdmin
      .from("contract_signature_access_sessions")
      .update({ invalidated_at: now })
      .eq("id", accessSessionId);
    return null;
  }

  await supabaseAdmin
    .from("contract_signature_sessions")
    .update({ status: "otwarta", opened_at: now, updated_at: now })
    .eq("id", signature.id)
    .in("status", ["wysłana", "przygotowana"]);

  await appendIdeaSignAuditEvent({
    signatureSessionId: signature.id,
    signerId: signer.id,
    eventType: "secure_link_exchanged",
    request,
    eventData: { accessSessionId },
  });

  return { accessToken, csrfToken, accessSessionId, expiresAt };
}

export async function getIdeaSignSessionDto(
  context: IdeaSignAccessContext
): Promise<IdeaSignSessionDto> {
  const [{ data: documents, error: documentsError }, { data: sale }, { data: views }, { data: signers }] = await Promise.all([
    supabaseAdmin
      .from("contract_signature_documents")
      .select("id, kind, title, file_name, sha256, byte_size, acceptance_required, sort_order")
      .eq("signature_session_id", context.signature.id)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("sales")
      .select("contract_number, public_id, sale_public_id")
      .eq("id", context.signature.sale_id)
      .maybeSingle(),
    supabaseAdmin
      .from("contract_signature_document_views")
      .select("document_id")
      .eq("signature_session_id", context.signature.id)
      .eq("signer_id", context.signer.id),
    supabaseAdmin
      .from("contract_signature_signers")
      .select("id, status")
      .eq("signature_session_id", context.signature.id),
  ]);

  if (documentsError) {
    throw new Error(`Nie udało się odczytać dokumentów IdeaSign: ${documentsError.message}`);
  }

  return {
    transactionId: context.signature.transaction_id,
    status: context.signature.status,
    clientDisplayName: context.signer.name,
    contractNumber: String(
      sale?.contract_number || sale?.sale_public_id || sale?.public_id || context.signature.transaction_id
    ),
    offeredAt: context.signature.offered_at,
    expiresAt: context.signature.expires_at,
    phoneSuffix: phoneSuffix(context.signer.phone),
    emailMasked: maskEmail(context.signer.email),
    manifestSha256: context.signature.manifest_sha256,
    offerorName: context.signature.offeror_name,
    offerorCapacity: context.signature.offeror_capacity,
    entryVerified: Boolean(context.access.entry_verified_at),
    signerSigned: context.signer.status === "podpisany",
    signerOrder: context.signer.signer_order,
    signerCount: (signers || []).length,
    signedSignerCount: (signers || []).filter((item) => item.status === "podpisany").length,
    openedDocumentIds: (views || []).map((item) => item.document_id),
    documents: (documents || []).map((document) => ({
      id: document.id,
      title: document.title,
      fileName: document.file_name,
      kind: document.kind,
      sha256: document.sha256,
      byteSize: Number(document.byte_size),
      acceptanceRequired: document.acceptance_required,
      previewUrl: `/api/ideasign/documents/${document.id}`,
    })),
  };
}

export async function requestIdeaSignOtp(
  context: IdeaSignAccessContext,
  purpose: IdeaSignOtpPurpose,
  request: Request
) {
  if (["zawarta", "wygasła", "anulowana"].includes(context.signature.status)) {
    return { ok: false as const, status: 409, error: "Ten proces nie przyjmuje już kodów OTP." };
  }

  if (purpose === "signature" && !context.access.entry_verified_at) {
    return { ok: false as const, status: 403, error: "Najpierw potwierdź wejście kodem SMS." };
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentChallenges, error: rateError } = await supabaseAdmin
    .from("contract_signature_otp_challenges")
    .select("id, sent_at")
    .eq("signature_session_id", context.signature.id)
    .eq("signer_id", context.signer.id)
    .eq("purpose", purpose)
    .gte("sent_at", tenMinutesAgo)
    .order("sent_at", { ascending: false });

  if (rateError) throw new Error(`Nie udało się sprawdzić limitu OTP: ${rateError.message}`);

  const latestSentAt = recentChallenges?.[0]?.sent_at
    ? new Date(recentChallenges[0].sent_at).getTime()
    : 0;
  const retryAfterSeconds = Math.max(0, 60 - Math.floor((Date.now() - latestSentAt) / 1000));

  if ((recentChallenges || []).length >= 3 || retryAfterSeconds > 0) {
    await appendIdeaSignAuditEvent({
      signatureSessionId: context.signature.id,
      signerId: context.signer.id,
      eventType: "otp_rate_limited",
      request,
      eventData: { purpose, retryAfterSeconds },
    });
    return {
      ok: false as const,
      status: 429,
      error: "Zbyt wiele próśb o kod. Spróbuj ponownie później.",
      retryAfterSeconds: retryAfterSeconds || 600,
    };
  }

  const challengeId = randomUUID();
  const demoOtp = getDemoOtp(request);
  const code = demoOtp || createOtpCode();
  const expiresAt = new Date(Date.now() + IDEA_SIGN_OTP_TTL_SECONDS * 1000).toISOString();
  const normalizedPhone = normalizePolishPhoneNumber(context.signer.phone);

  if (!normalizedPhone) {
    return { ok: false as const, status: 422, error: "Numer telefonu przypisany do umowy jest nieprawidłowy." };
  }

  const { error: insertError } = await supabaseAdmin
    .from("contract_signature_otp_challenges")
    .insert({
      id: challengeId,
      signature_session_id: context.signature.id,
      signer_id: context.signer.id,
      access_session_id: context.access.id,
      purpose,
      code_hash: hashOtp(challengeId, code),
      document_manifest_sha256: context.signature.manifest_sha256,
      expires_at: expiresAt,
      recipient_phone_suffix: phoneSuffix(normalizedPhone),
    });

  if (insertError) throw new Error(`Nie udało się utworzyć kodu OTP: ${insertError.message}`);

  const purposeText = purpose === "entry" ? "wejścia do IdeaSign" : "zawarcia umowy";
  if (!demoOtp) {
    await sendSmsApiMessage({
      to: normalizedPhone,
      message: `IdeaSign: kod ${purposeText}: ${code}. Kod wazny 5 minut. Nie udostepniaj go nikomu.`,
    });
  }

  await appendIdeaSignAuditEvent({
    signatureSessionId: context.signature.id,
    signerId: context.signer.id,
    eventType: "otp_sent",
    request,
    eventData: { purpose, challengeId, phoneSuffix: phoneSuffix(normalizedPhone) },
  });

  return {
    ok: true as const,
    expiresAt,
    phoneSuffix: phoneSuffix(normalizedPhone),
    ...(demoOtp ? { demoCode: code } : {}),
  };
}

export async function verifyIdeaSignOtp(
  context: IdeaSignAccessContext,
  purpose: IdeaSignOtpPurpose,
  code: string,
  request: Request
) {
  if (!/^\d{6}$/.test(code)) {
    return { ok: false as const, status: 400, error: "Kod powinien zawierać 6 cyfr." };
  }

  const { data: challenge, error } = await supabaseAdmin
    .from("contract_signature_otp_challenges")
    .select("id, code_hash, expires_at, consumed_at, attempt_count, max_attempts, document_manifest_sha256")
    .eq("signature_session_id", context.signature.id)
    .eq("signer_id", context.signer.id)
    .eq("access_session_id", context.access.id)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !challenge || isExpired(challenge.expires_at)) {
    return { ok: false as const, status: 410, error: "Kod wygasł. Wyślij nowy kod." };
  }

  if (challenge.attempt_count >= challenge.max_attempts) {
    return { ok: false as const, status: 429, error: "Przekroczono limit prób. Wyślij nowy kod." };
  }

  const nextAttemptCount = challenge.attempt_count + 1;
  const valid =
    challenge.document_manifest_sha256 === context.signature.manifest_sha256 &&
    safeEqualHex(hashOtp(challenge.id, code), challenge.code_hash);

  const now = new Date().toISOString();
  const { data: updatedChallenge } = await supabaseAdmin
    .from("contract_signature_otp_challenges")
    .update({
      attempt_count: nextAttemptCount,
      consumed_at: valid ? now : null,
    })
    .eq("id", challenge.id)
    .eq("attempt_count", challenge.attempt_count)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (!updatedChallenge) {
    return { ok: false as const, status: 409, error: "Kod został już użyty. Wyślij nowy kod." };
  }

  await appendIdeaSignAuditEvent({
    signatureSessionId: context.signature.id,
    signerId: context.signer.id,
    eventType: valid ? "otp_verified" : "otp_rejected",
    request,
    eventData: { purpose, challengeId: challenge.id, attempt: nextAttemptCount },
  });

  if (!valid) {
    return { ok: false as const, status: 401, error: "Nieprawidłowy kod SMS." };
  }

  if (purpose === "entry") {
    await Promise.all([
      supabaseAdmin
        .from("contract_signature_access_sessions")
        .update({ entry_verified_at: now })
        .eq("id", context.access.id),
      supabaseAdmin
        .from("contract_signature_sessions")
        .update({ status: "uwierzytelniona", authenticated_at: now, updated_at: now })
        .eq("id", context.signature.id)
        .in("status", ["przygotowana", "wysłana", "otwarta", "uwierzytelniona"]),
      supabaseAdmin
        .from("contract_signature_signers")
        .update({ status: "uwierzytelniony", authenticated_at: now, updated_at: now })
        .eq("id", context.signer.id)
        .neq("status", "podpisany"),
    ]);
  }

  return { ok: true as const, challengeId: challenge.id };
}

export async function acceptIdeaSignDocuments(
  context: IdeaSignAccessContext,
  documentIds: string[],
  request: Request
) {
  if (!context.access.entry_verified_at) {
    return { ok: false as const, status: 403, error: "Najpierw potwierdź wejście kodem SMS." };
  }

  const { data: requiredDocuments, error } = await supabaseAdmin
    .from("contract_signature_documents")
    .select("id, sha256")
    .eq("signature_session_id", context.signature.id)
    .eq("acceptance_required", true);

  if (error) throw new Error(`Nie udało się sprawdzić dokumentów: ${error.message}`);

  const requiredIds = new Set((requiredDocuments || []).map((document) => document.id));
  const acceptedIds = new Set(documentIds);
  const allAccepted =
    requiredIds.size > 0 &&
    requiredIds.size === acceptedIds.size &&
    [...requiredIds].every((id) => acceptedIds.has(id));

  if (!allAccepted) {
    return { ok: false as const, status: 422, error: "Zaakceptuj osobno każdy wymagany dokument." };
  }

  const { data: views, error: viewsError } = await supabaseAdmin
    .from("contract_signature_document_views")
    .select("document_id")
    .eq("signature_session_id", context.signature.id)
    .eq("signer_id", context.signer.id);
  if (viewsError) throw new Error(`Nie udało się potwierdzić otwarcia dokumentów: ${viewsError.message}`);
  const viewedIds = new Set((views || []).map((item) => item.document_id));
  if ([...requiredIds].some((id) => !viewedIds.has(id))) {
    return { ok: false as const, status: 422, error: "Otwórz każdy dokument przed jego zaakceptowaniem." };
  }

  const { data: existing } = await supabaseAdmin
    .from("contract_signature_acceptances")
    .select("document_id")
    .eq("signature_session_id", context.signature.id)
    .eq("signer_id", context.signer.id);
  const existingIds = new Set((existing || []).map((item) => item.document_id));
  const missing = (requiredDocuments || []).filter((document) => !existingIds.has(document.id));

  if (missing.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("contract_signature_acceptances")
      .insert(
        missing.map((document) => ({
          signature_session_id: context.signature.id,
          signer_id: context.signer.id,
          document_id: document.id,
          document_sha256: document.sha256,
        }))
      );
    if (insertError) throw new Error(`Nie udało się zapisać akceptacji: ${insertError.message}`);
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("contract_signature_sessions")
    .update({
      status: "oczekuje_na_podpis_klienta",
      signing_started_at: now,
      updated_at: now,
    })
    .eq("id", context.signature.id)
    .in("status", ["przygotowana", "wysłana", "otwarta", "uwierzytelniona", "oczekuje_na_podpis_klienta"]);

  await appendIdeaSignAuditEvent({
    signatureSessionId: context.signature.id,
    signerId: context.signer.id,
    eventType: "documents_accepted",
    request,
    eventData: {
      documentIds: [...requiredIds].sort(),
      manifestSha256: context.signature.manifest_sha256,
    },
  });

  return { ok: true as const };
}
