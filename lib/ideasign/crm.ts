import "server-only";

import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizePolishPhoneNumber, sendSmsApiMessage } from "@/lib/smsapi";
import {
  getSaleDocumentGroupKey,
  normalizeDocumentText,
  type DocumentGroupKey,
} from "@/lib/saleDocumentGrouping";
import { GET as generateContractPdf } from "@/app/sales/[id]/contract-pdf/route";
import { appendIdeaSignAuditEvent } from "./server";
import {
  ACTIVE_IDEASIGN_SALE_STATUSES,
  SALE_STATUS_AWAITING_IDEASIGN_SIGNATURE,
  SALE_STATUS_DOCUMENT_REVIEW,
  expireOverdueIdeaSignSessions,
} from "./lifecycle";
import {
  IDEA_SIGN_OTP_TTL_SECONDS,
  IDEA_SIGN_LINK_TTL_SECONDS,
  canonicalJson,
  createOtpCode,
  createSecretToken,
  hashOtp,
  phoneSuffix,
  safeEqualHex,
  sha256,
} from "./security";
import { renderIdeaSignInvitationEmail } from "./email";
import {
  areIdeaSignPhonesEqual,
  formatIdeaSignPolishPhone,
  normalizeIdeaSignPolishPhone,
} from "./phone";

type IdeaSignCrmActor = {
  id: string;
  role: string;
  displayName: string;
  phone: string;
  canPrepare: boolean;
  canSend: boolean;
};

type FrozenDocument = {
  id: string;
  kind: "agreement" | "attachment" | "consumer_information" | "withdrawal_form";
  title: string;
  fileName: string;
  bytes: Buffer;
  hash: string;
  containerKey: DocumentGroupKey;
  sourcePath?: string;
};

type IdeaSignContractData = Record<string, unknown>;

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

function cleanText(value: unknown, max = 320) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function readBoolean(value: unknown) {
  return value === true || String(value).toLowerCase() === "true";
}

function buildCustomerDataForIdeaSign(
  current: Record<string, unknown>,
  input: IdeaSignContractData
) {
  return {
    ...current,
    full_name: cleanText(input.clientName, 200),
    pesel: cleanText(input.pesel, 32),
    phone: formatIdeaSignPolishPhone(input.phone) || cleanText(input.phone, 32),
    email: cleanText(input.email, 320).toLowerCase(),
    contract_address: cleanText(input.contractAddress, 500),
    correspondence_address: cleanText(input.correspondenceAddress, 500),
    installation_address: cleanText(input.installationAddress, 500),
    property_type: cleanText(input.propertyType, 80),
    usable_area_m2: cleanText(input.usableAreaM2, 40),
    contract_number: cleanText(input.contractNumber, 120),
    second_client_name: cleanText(input.secondClientName, 200),
    second_client_pesel: cleanText(input.secondClientPesel, 32),
    second_client_phone:
      formatIdeaSignPolishPhone(input.secondClientPhone) || cleanText(input.secondClientPhone, 32),
    second_client_email: cleanText(input.secondClientEmail, 320).toLowerCase(),
    second_client_enabled: Boolean(
      cleanText(input.secondClientName, 200) || cleanText(input.secondClientPesel, 32)
    ),
    client1_meter_owner: readBoolean(input.client1MeterOwner),
    client2_meter_owner: readBoolean(input.client2MeterOwner),
    osd_operator: cleanText(input.osdOperator, 40),
    meter_number: cleanText(input.meterNumber, 80),
    ppe_number: cleanText(input.ppeNumber, 40),
    contract_place: cleanText(input.contractPlace, 160),
    contract_date: cleanText(input.contractDate, 20),
    contract_signing_location: cleanText(input.contractSigningLocation, 80),
    meeting_agreed_date: cleanText(input.meetingAgreedDate, 20),
    deposit_due_date: cleanText(input.depositDueDate, 20),
    realization_variant: cleanText(input.realizationVariant, 20),
    payment_method: cleanText(input.paymentMethod, 40),
    client1_marketing_email: readBoolean(input.client1MarketingEmail),
    client1_marketing_phone: readBoolean(input.client1MarketingPhone),
    client1_photo_consent: readBoolean(input.client1PhotoConsent),
    client2_marketing_email: readBoolean(input.client2MarketingEmail),
    client2_marketing_phone: readBoolean(input.client2MarketingPhone),
    client2_photo_consent: readBoolean(input.client2PhotoConsent),
    contract_pv_gross_before_discount: cleanText(input.pvGrossBeforeDiscount, 40),
    contract_pv_gross_after_discount: cleanText(input.pvGrossAfterDiscount, 40),
    contract_storage_gross_before_discount: cleanText(input.storageGrossBeforeDiscount, 40),
    contract_storage_gross_after_discount: cleanText(input.storageGrossAfterDiscount, 40),
    contract_inverter_gross_before_discount: cleanText(input.inverterGrossBeforeDiscount, 40),
    contract_inverter_gross_after_discount: cleanText(input.inverterGrossAfterDiscount, 40),
    contract_additional_services_gross_before_discount: cleanText(input.additionalServicesGrossBeforeDiscount, 40),
    contract_additional_services_gross_after_discount: cleanText(input.additionalServicesGrossAfterDiscount, 40),
    contract_total_gross_after_discount: cleanText(input.totalGross, 40),
    deposit_amount: cleanText(input.depositAmount, 40),
  };
}

function safeFileName(value: string, fallback: string) {
  const result = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
  return result || fallback;
}

function transactionId() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `IS-SIGN-${day}-${createSecretToken(6).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;
}

function getIdeaSignBaseUrl() {
  const configured = cleanText(process.env.IDEASIGN_PUBLIC_URL || "", 500).replace(/\/$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? "https://sign.ideasol.pl/sign"
    : "http://localhost:3000/sign";
}

function isLocalDevelopmentRequest(request: Request) {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const hostname = new URL(request.url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function mailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.MAIL_FROM || process.env.SMTP_FROM;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) throw new Error("Brak konfiguracji SMTP dla IdeaSign.");
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
  });
}

type OfferorOtpSession = {
  id: string;
  transaction_id: string;
  manifest_sha256: string;
};

function getLocalIdeaSignOtp(request: Request) {
  if (!isLocalDevelopmentRequest(request) || process.env.IDEASIGN_LOCAL_DELIVERY === "live") {
    return null;
  }
  const configured = cleanText(process.env.IDEASIGN_DEMO_OTP || "", 6);
  return /^\d{6}$/.test(configured) ? configured : "482913";
}

function maskIdeaSignPhone(value: string) {
  const normalized = normalizePolishPhoneNumber(value);
  return normalized ? `+48 ••• ••• ${normalized.slice(-3)}` : "numer z profilu CRM";
}

async function requestIdeaSignOfferorOtpChallenge(params: {
  session: OfferorOtpSession;
  actor: IdeaSignCrmActor;
  request: Request;
}) {
  const normalizedPhone = normalizePolishPhoneNumber(params.actor.phone);
  if (!normalizedPhone) {
    return {
      ok: false as const,
      status: 422,
      error: "Uzupełnij prawidłowy numer telefonu handlowca w profilu CRM przed użyciem IdeaSign.",
    };
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentChallenges, error: rateError } = await supabaseAdmin
    .from("contract_signature_offeror_otp_challenges")
    .select("id, sent_at")
    .eq("signature_session_id", params.session.id)
    .eq("actor_id", params.actor.id)
    .gte("sent_at", tenMinutesAgo)
    .order("sent_at", { ascending: false });
  if (rateError) throw new Error(`Nie udało się sprawdzić limitu kodów handlowca: ${rateError.message}`);

  const latestSentAt = recentChallenges?.[0]?.sent_at
    ? new Date(recentChallenges[0].sent_at).getTime()
    : 0;
  const retryAfterSeconds = Math.max(0, 60 - Math.floor((Date.now() - latestSentAt) / 1000));
  if ((recentChallenges || []).length >= 3 || retryAfterSeconds > 0) {
    await appendIdeaSignAuditEvent({
      signatureSessionId: params.session.id,
      eventType: "offeror_otp_rate_limited",
      request: params.request,
      eventData: { actorId: params.actor.id, retryAfterSeconds },
    });
    return {
      ok: false as const,
      status: 429,
      error: "Zbyt wiele próśb o kod. Spróbuj ponownie później.",
      retryAfterSeconds: retryAfterSeconds || 600,
    };
  }

  const challengeId = randomUUID();
  const demoCode = getLocalIdeaSignOtp(params.request);
  const code = demoCode || createOtpCode();
  const expiresAt = new Date(Date.now() + IDEA_SIGN_OTP_TTL_SECONDS * 1000).toISOString();
  const suffix = phoneSuffix(normalizedPhone);
  const { error: insertError } = await supabaseAdmin
    .from("contract_signature_offeror_otp_challenges")
    .insert({
      id: challengeId,
      signature_session_id: params.session.id,
      actor_id: params.actor.id,
      code_hash: hashOtp(challengeId, code),
      document_manifest_sha256: params.session.manifest_sha256,
      expires_at: expiresAt,
      recipient_phone_suffix: suffix,
    });
  if (insertError) throw new Error(`Nie udało się utworzyć kodu handlowca: ${insertError.message}`);

  if (!demoCode) {
    await sendSmsApiMessage({
      to: normalizedPhone,
      message: `IdeaSign: kod autoryzacji oferty ${code}. Kod wazny 5 minut. Nie udostepniaj go nikomu.`,
    });
  }

  await appendIdeaSignAuditEvent({
    signatureSessionId: params.session.id,
    eventType: "offeror_otp_sent",
    request: params.request,
    eventData: {
      actorId: params.actor.id,
      challengeId,
      manifestSha256: params.session.manifest_sha256,
      phoneSuffix: suffix,
    },
  });

  return {
    ok: true as const,
    transactionId: params.session.transaction_id,
    authorizationRequired: true as const,
    phoneMasked: maskIdeaSignPhone(normalizedPhone),
    expiresAt,
    ...(demoCode ? { demoCode } : {}),
  };
}

export async function requireIdeaSignCrmActor(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return null;

  const [{ data: profile }, { data: permission }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, role, display_name, phone")
      .eq("id", authData.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from("user_permissions")
      .select("ideasign_prepare, ideasign_send")
      .eq("user_id", authData.user.id)
      .maybeSingle(),
  ]);

  if (!profile) return null;
  const role = cleanText(profile.role || "seller", 40).toLowerCase();
  const isPrivilegedRole = role === "admin" || role === "owner";
  return {
    id: profile.id,
    role,
    displayName: cleanText(profile.display_name || authData.user.email || "IdeaSol", 160),
    phone: formatIdeaSignPolishPhone(profile.phone) || cleanText(profile.phone, 32),
    canPrepare: permission?.ideasign_prepare === true || isPrivilegedRole,
    canSend: permission?.ideasign_send === true || isPrivilegedRole,
  } satisfies IdeaSignCrmActor;
}

export async function actorCanAccessSale(actor: IdeaSignCrmActor, sellerId: string | null) {
  if (["admin", "owner", "cc"].includes(actor.role)) return true;
  if (sellerId === actor.id) return true;
  if (actor.role !== "manager" || !sellerId) return false;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("manager_id")
    .eq("id", sellerId)
    .maybeSingle();
  return data?.manager_id === actor.id;
}

async function extractPdfPages(source: Buffer, pageIndices: number[]) {
  const sourcePdf = await PDFDocument.load(source);
  const outputPdf = await PDFDocument.create();
  const pages = await outputPdf.copyPages(sourcePdf, pageIndices);
  pages.forEach((page) => outputPdf.addPage(page));
  return Buffer.from(await outputPdf.save());
}

async function freezeAgreementPackage(
  saleId: string,
  contractNumber: string,
  request: Request
) {
  const url = new URL(request.url);
  const pdfResponse = await generateContractPdf(
    new NextRequest(`${url.origin}/sales/${saleId}/contract-pdf`),
    { params: Promise.resolve({ id: saleId }) }
  );
  if (!pdfResponse.ok) {
    const message = await pdfResponse.text();
    throw new Error(`Nie udało się wygenerować umowy: ${message.slice(0, 240)}`);
  }
  const bytes = Buffer.from(await pdfResponse.arrayBuffer());
  if (bytes.subarray(0, 4).toString() !== "%PDF") {
    throw new Error("Generator umowy nie zwrócił prawidłowego PDF.");
  }

  const generatedPdf = await PDFDocument.load(bytes);
  if (generatedPdf.getPageCount() < 23) {
    throw new Error("Wygenerowany pakiet umowy ma nieoczekiwaną liczbę stron.");
  }

  const safeContractNumber = safeFileName(contractNumber, "umowa").replace(/\.pdf$/i, "");
  const definitions: Array<{
    kind: FrozenDocument["kind"];
    title: string;
    fileName: string;
    pageIndices: number[];
    containerKey: DocumentGroupKey;
  }> = [
    {
      kind: "agreement",
      title: "Umowa sprzedaży i montażu",
      fileName: `umowa-${safeContractNumber}.pdf`,
      pageIndices: [0, 1, 2, 3, 4, 5, 6],
      containerKey: "contracts",
    },
    {
      kind: "withdrawal_form",
      title: "Załącznik nr 1 — odstąpienie i rozpoczęcie realizacji",
      fileName: "zalacznik-1-odstapienie.pdf",
      pageIndices: [7, 8],
      containerKey: "contracts",
    },
    {
      kind: "attachment",
      title: "Załącznik nr 2 — warunki gwarancji",
      fileName: "zalacznik-2-warunki-gwarancji.pdf",
      pageIndices: [9, 10],
      containerKey: "contracts",
    },
    {
      kind: "consumer_information",
      title: "Załącznik nr 3 — RODO i zgody marketingowe",
      fileName: "zalacznik-3-rodo-i-zgody.pdf",
      pageIndices: [11],
      containerKey: "contracts",
    },
    // Strony 13–17 wzoru stanowią załącznik nr 4 (formularz techniczny).
    // Celowo nie wchodzą do pakietu IdeaSign do czasu wdrożenia jego e-wypełniania.
    {
      kind: "attachment",
      title: "Pełnomocnictwo ZM",
      fileName: "pelnomocnictwo-zm.pdf",
      pageIndices: [18],
      containerKey: "zm_power_of_attorney",
    },
    {
      kind: "attachment",
      title: "Dokumenty PPOŻ",
      fileName: "ppoz.pdf",
      pageIndices: [20, 22],
      containerKey: "ppoz",
    },
  ];

  return Promise.all(
    definitions.map(async (definition) => {
      const documentBytes = await extractPdfPages(bytes, definition.pageIndices);
      return {
        id: randomUUID(),
        kind: definition.kind,
        title: definition.title,
        fileName: definition.fileName,
        bytes: documentBytes,
        hash: sha256(documentBytes),
        containerKey: definition.containerKey,
      } satisfies FrozenDocument;
    })
  );
}

async function freezeExistingAttachments(saleId: string) {
  const { data: documents, error } = await supabaseAdmin
    .from("sale_documents")
    .select("id, description, document_type, file_name, file_path, file_type, file_size")
    .eq("sale_id", saleId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Nie udało się odczytać załączników: ${error.message}`);

  const candidates = (documents || []).filter((document) => {
    const isPdf = document.file_type === "application/pdf" || /\.pdf$/i.test(document.file_name || "");
    const isPreviousIdeaSignResult = String(document.file_path || "").includes("/ideasign/");
    const normalized = normalizeDocumentText(
      `${document.document_type || ""} ${document.description || ""} ${document.file_name || ""}`
    );
    const isTechnicalAttachmentFour =
      normalized.includes("zalacznik 4") ||
      normalized.includes("formularz techniczny");
    return isPdf && !isPreviousIdeaSignResult && !isTechnicalAttachmentFour;
  });

  const result: FrozenDocument[] = [];
  for (const document of candidates) {
    const { data, error: downloadError } = await supabaseAdmin.storage
      .from("sale-documents")
      .download(document.file_path);
    if (downloadError || !data) {
      throw new Error(`Nie udało się zamrozić załącznika ${document.id}.`);
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 50_000_000) {
      throw new Error(`Załącznik ${document.id} ma nieprawidłowy rozmiar.`);
    }
    result.push({
      id: randomUUID(),
      kind: "attachment",
      title: cleanText(document.description || document.file_name || "Załącznik do umowy", 240),
      fileName: safeFileName(document.file_name || "zalacznik.pdf", "zalacznik.pdf"),
      bytes,
      hash: sha256(bytes),
      containerKey: getSaleDocumentGroupKey(document),
      sourcePath: document.file_path,
    });
  }
  return result;
}

export async function createAndSendIdeaSignSession(params: {
  saleId: string;
  actor: IdeaSignCrmActor;
  request: Request;
  contractData: IdeaSignContractData;
}) {
  if (!params.actor.canSend) {
    return { ok: false as const, status: 403, error: "Brak uprawnienia do wysyłki umów IdeaSign." };
  }
  if (!normalizePolishPhoneNumber(params.actor.phone)) {
    return {
      ok: false as const,
      status: 422,
      error: "Uzupełnij prawidłowy numer telefonu handlowca w profilu CRM przed użyciem IdeaSign.",
    };
  }

  const { data: sale, error: saleError } = await supabaseAdmin
    .from("sales")
    .select("id, client_id, seller_id, contract_number, public_id, sale_public_id, customer_email, customer_phone, customer_data")
    .eq("id", params.saleId)
    .maybeSingle();
  if (saleError) {
    console.error("[IdeaSign] Failed to load sale for session creation", {
      saleId: params.saleId,
      code: saleError.code,
      message: saleError.message,
    });
    return {
      ok: false as const,
      status: 500,
      error: "Nie udało się odczytać sprzedaży. Spróbuj ponownie.",
    };
  }
  if (!sale) return { ok: false as const, status: 404, error: "Nie znaleziono sprzedaży." };
  if (!(await actorCanAccessSale(params.actor, sale.seller_id))) {
    return { ok: false as const, status: 403, error: "Brak dostępu do tej sprzedaży." };
  }

  const contractNumber = cleanText(params.contractData.contractNumber, 120);
  if (params.contractData.contractSigningLocation !== "distance") {
    return {
      ok: false as const,
      status: 422,
      error: "IdeaSign wymaga zaznaczenia: na odległość, bez jednoczesnej fizycznej obecności Stron.",
    };
  }
  if (!contractNumber) {
    return { ok: false as const, status: 422, error: "Uzupełnij numer umowy przed wysłaniem do IdeaSign." };
  }

  const { data: duplicateContract } = await supabaseAdmin
    .from("sales")
    .select("id")
    .eq("contract_number", contractNumber)
    .neq("id", sale.id)
    .maybeSingle();
  if (duplicateContract) {
    return { ok: false as const, status: 409, error: "Umowa o wskazanym numerze istnieje już w systemie." };
  }

  const persistedCustomerData = buildCustomerDataForIdeaSign(
    (sale.customer_data || {}) as Record<string, unknown>,
    params.contractData
  );
  await expireOverdueIdeaSignSessions({ saleId: sale.id });
  const [{ data: active }, clientResponse] = await Promise.all([
    supabaseAdmin
      .from("contract_signature_sessions")
      .select("id, transaction_id, status, created_by, manifest_sha256, offeror_authorized_at")
      .eq("sale_id", sale.id)
      .not("status", "in", "(zawarta,wygasła,anulowana)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sale.client_id
      ? supabaseAdmin
          .from("clients")
          .select("full_name, company_name, email, phone")
          .eq("id", sale.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (active) {
    if (
      active.status === "przygotowana" &&
      active.created_by === params.actor.id &&
      !active.offeror_authorized_at
    ) {
      return requestIdeaSignOfferorOtpChallenge({
        session: active as OfferorOtpSession,
        actor: params.actor,
        request: params.request,
      });
    }
    return {
      ok: false as const,
      status: 409,
      error: `Dla tej sprzedaży istnieje aktywny proces ${active.transaction_id} (${active.status}).`,
    };
  }

  const client = clientResponse.data;
  const customer: Record<string, unknown> = persistedCustomerData;
  const clientName = cleanText(
    customer.full_name || customer.name || client?.full_name || client?.company_name,
    200
  );
  const clientEmail = cleanText(customer.email || sale.customer_email || client?.email, 320).toLowerCase();
  const clientPhone = formatIdeaSignPolishPhone(
    customer.phone || sale.customer_phone || client?.phone
  );
  if (clientName.length < 2 || !/^\S+@\S+\.\S+$/.test(clientEmail) || !normalizeIdeaSignPolishPhone(clientPhone)) {
    return { ok: false as const, status: 422, error: "Uzupełnij poprawne imię i nazwisko, e-mail oraz telefon klienta." };
  }
  const secondClientName = cleanText(customer.second_client_name, 200);
  const secondClientEmail = cleanText(customer.second_client_email, 320).toLowerCase();
  const secondClientPhone = formatIdeaSignPolishPhone(customer.second_client_phone);
  const hasSecondSigner = Boolean(secondClientName || cleanText(customer.second_client_pesel, 32));
  if (hasSecondSigner && (secondClientName.length < 2 || !/^\S+@\S+\.\S+$/.test(secondClientEmail) || !normalizeIdeaSignPolishPhone(secondClientPhone))) {
    return { ok: false as const, status: 422, error: "Przy umowie na dwie osoby uzupełnij poprawne imię i nazwisko, e-mail oraz telefon klienta 2." };
  }
  if (hasSecondSigner && (secondClientEmail === clientEmail || areIdeaSignPhonesEqual(secondClientPhone, clientPhone))) {
    return { ok: false as const, status: 422, error: "Każdy podpisujący musi mieć własny e-mail i własny numer telefonu." };
  }

  const { error: saveContractError } = await supabaseAdmin
    .from("sales")
    .update({ contract_number: contractNumber, customer_data: persistedCustomerData })
    .eq("id", sale.id);
  if (saveContractError) {
    throw new Error(`Nie udało się zapisać wersji umowy przed wysłaniem: ${saveContractError.message}`);
  }
  sale.contract_number = contractNumber;
  sale.customer_data = persistedCustomerData;

  const sessionId = randomUUID();
  const signerDrafts = [
    { order: 1, name: clientName, email: clientEmail, phone: clientPhone, token: createSecretToken() },
    ...(hasSecondSigner
      ? [{ order: 2, name: secondClientName, email: secondClientEmail, phone: secondClientPhone, token: createSecretToken() }]
      : []),
  ];
  const documents: FrozenDocument[] = [
    ...(await freezeAgreementPackage(
      sale.id,
      String(sale.contract_number || sale.sale_public_id || sale.public_id || sale.id),
      params.request
    )),
    ...(await freezeExistingAttachments(sale.id)),
  ];
  const manifest = documents.map((document, index) => ({
    id: document.id,
    kind: document.kind,
    title: document.title,
    fileName: document.fileName,
    byteSize: document.bytes.length,
    sha256: document.hash,
    sortOrder: index,
    containerKey: document.containerKey,
  }));
  const manifestSha256 = sha256(canonicalJson(manifest));
  const now = new Date();
  const linkExpiresAt = new Date(
    now.getTime() + IDEA_SIGN_LINK_TTL_SECONDS * 1000
  ).toISOString();
  const transaction = transactionId();
  const localTest = isLocalDevelopmentRequest(params.request);
  const localLiveDelivery = localTest && process.env.IDEASIGN_LOCAL_DELIVERY === "live";
  const { error: insertError } = await supabaseAdmin.from("contract_signature_sessions").insert({
    id: sessionId,
    transaction_id: transaction,
    sale_id: sale.id,
    client_id: sale.client_id,
    created_by: params.actor.id,
    offeror_name: params.actor.displayName,
    offeror_capacity: "Ekspert ds. energetyki odnawialnej",
    offeror_phone: params.actor.phone,
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    status: "przygotowana",
    manifest_sha256: manifestSha256,
    link_token_hash: sha256(signerDrafts[0].token),
    link_expires_at: linkExpiresAt,
    expires_at: linkExpiresAt,
  });
  if (insertError) throw new Error(`Nie udało się utworzyć procesu IdeaSign: ${insertError.message}`);

  const signerRows = signerDrafts.map((signer) => ({
    id: randomUUID(),
    signature_session_id: sessionId,
    signer_order: signer.order,
    name: signer.name,
    email: signer.email,
    phone: signer.phone,
    link_token_hash: sha256(signer.token),
    link_expires_at: linkExpiresAt,
  }));
  const { error: signersError } = await supabaseAdmin.from("contract_signature_signers").insert(signerRows);
  if (signersError) throw new Error(`Nie udało się zapisać osób podpisujących: ${signersError.message}`);

  try {
    for (const [index, document] of documents.entries()) {
      const storagePath = `${sessionId}/${String(index + 1).padStart(2, "0")}-${document.fileName}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("ideasign-documents")
        .upload(storagePath, document.bytes, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error(`Nie udało się zapisać zamrożonego dokumentu: ${uploadError.message}`);
      const { error: documentError } = await supabaseAdmin.from("contract_signature_documents").insert({
        id: document.id,
        signature_session_id: sessionId,
        kind: document.kind,
        title: document.title,
        file_name: document.fileName,
        storage_path: storagePath,
        crm_container_key: document.containerKey,
        mime_type: "application/pdf",
        byte_size: document.bytes.length,
        sha256: document.hash,
        sort_order: index,
        acceptance_required: true,
      });
      if (documentError) throw new Error(`Nie udało się zapisać manifestu: ${documentError.message}`);
    }

    await appendIdeaSignAuditEvent({
      signatureSessionId: sessionId,
      eventType: "offer_prepared",
      request: params.request,
      eventData: { transactionId: transaction, manifestSha256, documentCount: documents.length },
    });

    const challenge = await requestIdeaSignOfferorOtpChallenge({
      session: { id: sessionId, transaction_id: transaction, manifest_sha256: manifestSha256 },
      actor: params.actor,
      request: params.request,
    });
    if (!challenge.ok) return challenge;
    return {
      ...challenge,
      status: "przygotowana" as const,
      localTest,
      deliveryMode: localLiveDelivery ? "live" as const : "simulated" as const,
    };
  } catch (error) {
    await supabaseAdmin
      .from("contract_signature_sessions")
      .update({ last_error: "IDEASIGN_PREPARE_OR_SEND_FAILED", updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    throw error;
  }
}

export async function resendIdeaSignOfferorOtp(params: {
  saleId: string;
  transactionId: string;
  actor: IdeaSignCrmActor;
  request: Request;
}) {
  if (!params.actor.canSend) {
    return { ok: false as const, status: 403, error: "Brak uprawnienia do wysyłki umów IdeaSign." };
  }
  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("seller_id")
    .eq("id", params.saleId)
    .maybeSingle();
  if (!sale || !(await actorCanAccessSale(params.actor, sale.seller_id))) {
    return { ok: false as const, status: 403, error: "Brak dostępu do tej sprzedaży." };
  }
  const { data: session } = await supabaseAdmin
    .from("contract_signature_sessions")
    .select("id, transaction_id, manifest_sha256, status, created_by, offeror_authorized_at")
    .eq("sale_id", params.saleId)
    .eq("transaction_id", cleanText(params.transactionId, 120))
    .maybeSingle();
  if (!session || session.status !== "przygotowana" || session.offeror_authorized_at) {
    return { ok: false as const, status: 409, error: "Ten proces nie oczekuje już na kod handlowca." };
  }
  if (session.created_by !== params.actor.id) {
    return { ok: false as const, status: 403, error: "Kod może potwierdzić wyłącznie handlowiec, który przygotował ofertę." };
  }
  return requestIdeaSignOfferorOtpChallenge({
    session: session as OfferorOtpSession,
    actor: params.actor,
    request: params.request,
  });
}

export async function authorizeAndSendIdeaSignSession(params: {
  saleId: string;
  transactionId: string;
  code: string;
  actor: IdeaSignCrmActor;
  request: Request;
}) {
  if (!params.actor.canSend) {
    return { ok: false as const, status: 403, error: "Brak uprawnienia do wysyłki umów IdeaSign." };
  }
  if (!/^\d{6}$/.test(params.code)) {
    return { ok: false as const, status: 400, error: "Kod powinien zawierać 6 cyfr." };
  }

  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("seller_id, contract_number")
    .eq("id", params.saleId)
    .maybeSingle();
  if (!sale || !(await actorCanAccessSale(params.actor, sale.seller_id))) {
    return { ok: false as const, status: 403, error: "Brak dostępu do tej sprzedaży." };
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("contract_signature_sessions")
    .select("id, transaction_id, manifest_sha256, status, created_by, offeror_phone, offeror_authorized_at, offeror_authorization_challenge_id")
    .eq("sale_id", params.saleId)
    .eq("transaction_id", cleanText(params.transactionId, 120))
    .maybeSingle();
  if (sessionError || !session) {
    return { ok: false as const, status: 404, error: "Nie znaleziono przygotowanej oferty IdeaSign." };
  }
  if (session.created_by !== params.actor.id) {
    return { ok: false as const, status: 403, error: "Ofertę może autoryzować wyłącznie handlowiec, który ją przygotował." };
  }
  if (session.status !== "przygotowana") {
    return { ok: false as const, status: 409, error: "Ta oferta została już wysłana albo proces jest zakończony." };
  }

  let authorizationChallengeId = session.offeror_authorization_challenge_id as string | null;
  if (!session.offeror_authorized_at) {
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("contract_signature_offeror_otp_challenges")
      .select("id, code_hash, expires_at, consumed_at, attempt_count, max_attempts, document_manifest_sha256, recipient_phone_suffix")
      .eq("signature_session_id", session.id)
      .eq("actor_id", params.actor.id)
      .is("consumed_at", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (challengeError || !challenge || new Date(challenge.expires_at).getTime() <= Date.now()) {
      return { ok: false as const, status: 410, error: "Kod wygasł. Wyślij nowy kod." };
    }
    if (challenge.attempt_count >= challenge.max_attempts) {
      return { ok: false as const, status: 429, error: "Przekroczono limit prób. Wyślij nowy kod." };
    }

    const nextAttemptCount = challenge.attempt_count + 1;
    const valid =
      challenge.document_manifest_sha256 === session.manifest_sha256 &&
      safeEqualHex(hashOtp(challenge.id, params.code), challenge.code_hash);
    const authorizedAt = new Date().toISOString();
    const { data: updatedChallenge } = await supabaseAdmin
      .from("contract_signature_offeror_otp_challenges")
      .update({
        attempt_count: nextAttemptCount,
        consumed_at: valid ? authorizedAt : null,
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
      signatureSessionId: session.id,
      eventType: valid ? "offeror_otp_verified" : "offeror_otp_rejected",
      request: params.request,
      eventData: {
        actorId: params.actor.id,
        challengeId: challenge.id,
        manifestSha256: session.manifest_sha256,
        attempt: nextAttemptCount,
      },
    });
    if (!valid) {
      return { ok: false as const, status: 401, error: "Nieprawidłowy kod SMS." };
    }

    const { data: authorizedSession, error: authorizeError } = await supabaseAdmin
      .from("contract_signature_sessions")
      .update({
        offeror_authorized_at: authorizedAt,
        offeror_authorization_challenge_id: challenge.id,
        updated_at: authorizedAt,
      })
      .eq("id", session.id)
      .eq("status", "przygotowana")
      .is("offeror_authorized_at", null)
      .select("id")
      .maybeSingle();
    if (authorizeError) throw new Error(`Nie udało się zapisać autoryzacji handlowca: ${authorizeError.message}`);
    if (!authorizedSession) {
      return { ok: false as const, status: 409, error: "Autoryzacja została już przetworzona w innej sesji." };
    }
    authorizationChallengeId = challenge.id;

    await appendIdeaSignAuditEvent({
      signatureSessionId: session.id,
      eventType: "offeror_authorized",
      request: params.request,
      eventData: {
        actorId: params.actor.id,
        challengeId: challenge.id,
        manifestSha256: session.manifest_sha256,
        phoneSuffix: challenge.recipient_phone_suffix,
      },
    });
  }

  const { data: confirmedAuthorization, error: confirmedAuthorizationError } = await supabaseAdmin
    .from("contract_signature_sessions")
    .select("id, offeror_authorized_at, offeror_authorization_challenge_id")
    .eq("id", session.id)
    .eq("created_by", params.actor.id)
    .not("offeror_authorized_at", "is", null)
    .maybeSingle();
  if (confirmedAuthorizationError || !confirmedAuthorization?.offeror_authorized_at) {
    return {
      ok: false as const,
      status: 409,
      error: "Brak potwierdzonej autoryzacji SMS handlowca. Linki klientów nie zostały wysłane.",
    };
  }
  authorizationChallengeId = confirmedAuthorization.offeror_authorization_challenge_id;

  const { data: signers, error: signersError } = await supabaseAdmin
    .from("contract_signature_signers")
    .select("id, signer_order, name, email")
    .eq("signature_session_id", session.id)
    .order("signer_order");
  if (signersError || !signers?.length) {
    throw new Error("Nie udało się odczytać osób podpisujących.");
  }

  const linkExpiresAt = new Date(Date.now() + IDEA_SIGN_LINK_TTL_SECONDS * 1000).toISOString();
  const signerLinks = signers.map((signer) => {
    const token = createSecretToken();
    return {
      signerId: signer.id,
      signerOrder: signer.signer_order,
      signerName: signer.name,
      signerEmail: signer.email,
      tokenHash: sha256(token),
      url: `${getIdeaSignBaseUrl()}/#token=${encodeURIComponent(token)}`,
    };
  });

  for (const link of signerLinks) {
    const { error: linkError } = await supabaseAdmin
      .from("contract_signature_signers")
      .update({ link_token_hash: link.tokenHash, link_expires_at: linkExpiresAt, updated_at: new Date().toISOString() })
      .eq("id", link.signerId)
      .eq("signature_session_id", session.id);
    if (linkError) throw new Error(`Nie udało się przygotować linku klienta: ${linkError.message}`);
  }
  const { data: activatedSession, error: sessionLinkError } = await supabaseAdmin
    .from("contract_signature_sessions")
    .update({
      link_token_hash: signerLinks[0].tokenHash,
      link_expires_at: linkExpiresAt,
      expires_at: linkExpiresAt,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("status", "przygotowana")
    .not("offeror_authorized_at", "is", null)
    .select("id")
    .maybeSingle();
  if (sessionLinkError) throw new Error(`Nie udało się aktywować linków klienta: ${sessionLinkError.message}`);
  if (!activatedSession) {
    return { ok: false as const, status: 409, error: "Linki nie zostały aktywowane bez autoryzacji handlowca." };
  }

  const localTest = isLocalDevelopmentRequest(params.request);
  const localLiveDelivery = localTest && process.env.IDEASIGN_LOCAL_DELIVERY === "live";
  if (!localTest || localLiveDelivery) {
    const from = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
    await Promise.all(signerLinks.map((signer) => mailTransport().sendMail({
      from,
      to: signer.signerEmail,
      subject: `Umowa ${sale.contract_number || "IdeaSol"} — bezpieczne zawarcie w IdeaSign`,
      text: `Dzień dobry,\n\nIdeaSol przesłało umowę do zapoznania i zawarcia. Twój bezpieczny, jednorazowy link jest ważny przez 7 dni:\n${signer.url}\n\nKażda osoba podpisująca korzysta z własnego linku i kodów SMS. Nie przekazuj tego linku ani kodów drugiej osobie.\n\nIdeaSol Sp. z o.o.`,
      html: renderIdeaSignInvitationEmail({
        signerName: signer.signerName,
        contractNumber: sale.contract_number || "IdeaSol",
        signUrl: signer.url,
      }),
    })));
  }

  const sentAt = new Date().toISOString();
  const [{ data: sentSession, error: sentStatusError }, { error: saleStatusError }] = await Promise.all([
    supabaseAdmin
      .from("contract_signature_sessions")
      .update({ status: "wysłana", sent_at: sentAt, updated_at: sentAt })
      .eq("id", session.id)
      .eq("status", "przygotowana")
      .not("offeror_authorized_at", "is", null)
      .select("id")
      .maybeSingle(),
    supabaseAdmin
      .from("sales")
      .update({ status: SALE_STATUS_AWAITING_IDEASIGN_SIGNATURE })
      .eq("id", params.saleId),
  ]);
  if (sentStatusError) throw new Error(`Nie udało się oznaczyć procesu jako wysłanego: ${sentStatusError.message}`);
  if (!sentSession) throw new Error("Nie wysłano oferty bez potwierdzonej autoryzacji handlowca.");
  if (saleStatusError) {
    await supabaseAdmin
      .from("contract_signature_sessions")
      .update({ last_error: "SALE_STATUS_SYNC_FAILED", updated_at: sentAt })
      .eq("id", session.id);
  }

  await appendIdeaSignAuditEvent({
    signatureSessionId: session.id,
    eventType: "offer_sent",
    request: params.request,
    eventData: {
      transactionId: session.transaction_id,
      offerorChallengeId: authorizationChallengeId,
      signerCount: signerLinks.length,
      delivery: localTest && !localLiveDelivery ? "local_simulation" : "email",
    },
  });

  return {
    ok: true as const,
    transactionId: session.transaction_id,
    status: "wysłana" as const,
    ...(localTest
      ? {
          localTest: true as const,
          deliveryMode: localLiveDelivery ? "live" as const : "simulated" as const,
          demoOtp: localLiveDelivery ? undefined : "482913",
          signerLinks: signerLinks.map(({ signerOrder, signerName, url }) => ({ signerOrder, signerName, url })),
        }
      : {}),
  };
}

export async function getIdeaSignSaleStatus(saleId: string, actor: IdeaSignCrmActor) {
  const { data: sale } = await supabaseAdmin.from("sales").select("seller_id").eq("id", saleId).maybeSingle();
  if (!sale || !(await actorCanAccessSale(actor, sale.seller_id))) return null;
  await expireOverdueIdeaSignSessions({ saleId });
  const { data } = await supabaseAdmin
    .from("contract_signature_sessions")
    .select("transaction_id, status, sent_at, opened_at, authenticated_at, concluded_at, expires_at")
    .eq("sale_id", saleId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || { status: null };
}

export async function cancelIdeaSignSaleSession(params: {
  saleId: string;
  actor: IdeaSignCrmActor;
  request: Request;
}) {
  if (!params.actor.canSend) {
    return { ok: false as const, status: 403, error: "Brak uprawnienia do anulowania procesu IdeaSign." };
  }
  const { data: sale } = await supabaseAdmin.from("sales").select("seller_id").eq("id", params.saleId).maybeSingle();
  if (!sale || !(await actorCanAccessSale(params.actor, sale.seller_id))) {
    return { ok: false as const, status: 403, error: "Brak dostępu do sprzedaży." };
  }
  const { data: active } = await supabaseAdmin
    .from("contract_signature_sessions")
    .select("id, transaction_id")
    .eq("sale_id", params.saleId)
    .not("status", "in", "(zawarta,wygasła,anulowana)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!active) return { ok: false as const, status: 404, error: "Brak aktywnego procesu IdeaSign." };
  const now = new Date().toISOString();
  const { data: cancelled } = await supabaseAdmin
    .from("contract_signature_sessions")
    .update({ status: "anulowana", cancelled_at: now, cancelled_by: params.actor.id, updated_at: now })
    .eq("id", active.id)
    .not("status", "in", "(zawarta,wygasła,anulowana)")
    .select("id")
    .maybeSingle();
  if (!cancelled) return { ok: false as const, status: 409, error: "Proces został już zakończony." };
  await supabaseAdmin
    .from("contract_signature_access_sessions")
    .update({ invalidated_at: now })
    .eq("signature_session_id", active.id)
    .is("invalidated_at", null);
  await supabaseAdmin
    .from("sales")
    .update({ status: SALE_STATUS_DOCUMENT_REVIEW })
    .eq("id", params.saleId)
    .in("status", [...ACTIVE_IDEASIGN_SALE_STATUSES]);
  await appendIdeaSignAuditEvent({
    signatureSessionId: active.id,
    eventType: "offer_cancelled",
    request: params.request,
    eventData: { transactionId: active.transaction_id, cancelledBy: params.actor.id },
  });
  return { ok: true as const, transactionId: active.transaction_id, status: "anulowana" as const };
}
