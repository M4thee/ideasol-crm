import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfitAdminClient } from "@/lib/profit/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.REPORTS_CRON_SECRET?.trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function number(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function productCode(value: unknown) {
  if (value === "pv") return "PV";
  if (value === "me") return "ME";
  return "PV_ME";
}

function pvPower(snapshot: unknown): number {
  const root = snapshot && typeof snapshot === "object" ? (snapshot as JsonRecord) : {};
  const offerData = root.offer_data && typeof root.offer_data === "object" ? (root.offer_data as JsonRecord) : {};
  const form = offerData.form && typeof offerData.form === "object" ? (offerData.form as JsonRecord) : {};
  const result = offerData.result && typeof offerData.result === "object" ? (offerData.result as JsonRecord) : {};
  return [root.pv_power_kw, root.pvPowerKw, form.pv_power_kw, form.pvPowerKw, result.pv_power_kw, result.pvPowerKw]
    .map(number)
    .find((value) => value > 0) || 0;
}

async function processReferralJobs() {
  const profit = getProfitAdminClient();
  const { data: jobs, error } = await profit
    .from("integration_jobs")
    .select("id,entity_id,attempt_count")
    .eq("job_type", "crm_create_profit_lead")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(25);
  if (error) throw error;

  let completed = 0;
  let failed = 0;
  for (const job of jobs || []) {
    const claim = await profit
      .from("integration_jobs")
      .update({ status: "processing" })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) continue;

    try {
      const referralResult = await profit.from("referrals").select("*").eq("id", job.entity_id).single();
      if (referralResult.error) throw referralResult.error;
      const referral = referralResult.data as JsonRecord;
      const ownerResult = await profit
        .from("profit_users")
        .select("id,idea_id,first_name,last_name,current_seller_id")
        .eq("id", referral.referrer_user_id)
        .single();
      if (ownerResult.error) throw ownerResult.error;

      let sellerCrmUserId: string | undefined;
      if (ownerResult.data.current_seller_id) {
        const sellerResult = await profit
          .from("profit_sellers")
          .select("crm_user_id")
          .eq("id", ownerResult.data.current_seller_id)
          .eq("is_active", true)
          .maybeSingle();
        if (sellerResult.error) throw sellerResult.error;
        sellerCrmUserId = sellerResult.data?.crm_user_id || undefined;
      }

      const apiToken = process.env.PROFIT_API_TOKEN?.trim();
      if (!apiToken) throw new Error("Brak PROFIT_API_TOKEN.");
      const crmUrl = (process.env.NEXT_PUBLIC_CRM_URL || "https://crm.ideasol.pl").replace(/\/$/, "");
      const response = await fetch(`${crmUrl}/api/integrations/profit/referrals`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json", "idempotency-key": String(job.entity_id) },
        body: JSON.stringify({
          referralId: job.entity_id,
          referrerIdeaId: ownerResult.data.idea_id,
          referrerName: `${ownerResult.data.first_name} ${ownerResult.data.last_name}`,
          sellerCrmUserId,
          source: "Profit",
          tag: "PROFIT",
          prospect: {
            firstName: referral.referred_first_name,
            lastName: referral.referred_last_name,
            phone: referral.referred_phone_e164 || referral.phone_e164 || referral.phone,
            email: referral.referred_email || referral.email || undefined,
            product: productCode(referral.product),
            phoneContactConsent: referral.source_type === "member_link" ? referral.consent_declared === true : undefined,
            marketingSmsConsent: referral.marketing_sms_consent === true,
            marketingEmailConsent: referral.marketing_email_consent === true,
            marketingConsentVersion: referral.marketing_consent_version || undefined,
          },
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`CRM referral retry returned ${response.status}`);
      const crm = (await response.json()) as { crmLeadId: string; ownerCrmUserId?: string; duplicate: boolean };
      const applyResult = await profit.rpc("apply_crm_lead_result", {
        p_referral_id: job.entity_id,
        p_client_id: crm.crmLeadId,
        p_crm_owner_user_id: crm.ownerCrmUserId || null,
        p_duplicate: crm.duplicate,
        p_rejection_reason: crm.duplicate ? "Kontakt istnieje już w CRM" : null,
      });
      if (applyResult.error) throw applyResult.error;

      const done = await profit
        .from("integration_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);
      if (done.error) throw done.error;
      completed += 1;
    } catch (jobError) {
      const attempts = Number(job.attempt_count || 0) + 1;
      await profit
        .from("integration_jobs")
        .update({
          status: attempts >= 8 ? "failed" : "pending",
          attempt_count: attempts,
          last_error: errorText(jobError).slice(0, 1000),
          next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString(),
        })
        .eq("id", job.id);
      failed += 1;
    }
  }
  return { found: jobs?.length || 0, completed, failed };
}

async function sendProfitEvent(input: {
  externalEventId: string;
  eventType: string;
  referralId: string;
  crmLeadId: string;
  crmSaleId: string;
  crmOwnerUserId?: string | null;
  occurredAt: string;
  payload?: JsonRecord;
}) {
  const apiToken = process.env.PROFIT_API_TOKEN?.trim();
  if (!apiToken) throw new Error("Brak PROFIT_API_TOKEN.");
  const response = await fetch("https://ideasol-profit.vercel.app/api/integrations/crm/events", {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Profit event ${input.eventType} returned ${response.status}`);
}

async function syncLifecycleEvents() {
  const { data: links, error } = await supabaseAdmin
    .from("profit_referral_links")
    .select("profit_referral_id,client_id,sale_id,current_owner_id,status,is_duplicate")
    .eq("status", "created")
    .eq("is_duplicate", false)
    .not("client_id", "is", null)
    .limit(100);
  if (error) throw error;

  let synced = 0;
  let failed = 0;
  for (const link of links || []) {
    try {
      let saleId = link.sale_id;
      let sale: JsonRecord | null = null;
      if (saleId) {
        const result = await supabaseAdmin.from("sales").select("*").eq("id", saleId).maybeSingle();
        if (result.error) throw result.error;
        sale = result.data as JsonRecord | null;
      } else {
        const result = await supabaseAdmin
          .from("sales")
          .select("*")
          .eq("client_id", link.client_id)
          .order("sale_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (result.error) throw result.error;
        sale = result.data as JsonRecord | null;
        saleId = sale ? text(sale.id) : null;
        if (saleId) {
          const update = await supabaseAdmin
            .from("profit_referral_links")
            .update({ sale_id: saleId, current_owner_id: sale?.seller_id || link.current_owner_id, updated_at: new Date().toISOString() })
            .eq("profit_referral_id", link.profit_referral_id);
          if (update.error) throw update.error;
        }
      }
      if (!sale || !saleId || !link.client_id) continue;

      const saleDate = new Date(text(sale.sale_date || sale.created_at));
      if (Number.isNaN(saleDate.getTime())) throw new Error("Sprzedaż nie ma poprawnej daty.");
      const ownerId = text(sale.seller_id || link.current_owner_id) || null;
      const finalPvKwp = pvPower(sale.offer_snapshot);
      const base = {
        referralId: link.profit_referral_id,
        crmLeadId: link.client_id,
        crmSaleId: saleId,
        crmOwnerUserId: ownerId,
      };

      await sendProfitEvent({ ...base, externalEventId: `sale_created:${saleId}`, eventType: "sale_created", occurredAt: saleDate.toISOString(), payload: { final_pv_kwp: finalPvKwp } });
      await sendProfitEvent({ ...base, externalEventId: `sale_signed:${saleId}`, eventType: "sale_signed", occurredAt: saleDate.toISOString(), payload: { final_pv_kwp: finalPvKwp } });

      const withdrawalEnd = new Date(saleDate);
      withdrawalEnd.setDate(withdrawalEnd.getDate() + 14);
      await sendProfitEvent({
        ...base,
        externalEventId: `withdrawal_period_set:${saleId}`,
        eventType: "withdrawal_period_set",
        occurredAt: saleDate.toISOString(),
        payload: { withdrawal_period_ends_at: withdrawalEnd.toISOString(), ends_at: withdrawalEnd.toISOString() },
      });

      const normalizedStatus = text(sale.status).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedStatus.includes("anul")) {
        await sendProfitEvent({ ...base, externalEventId: `sale_cancelled:${saleId}`, eventType: "sale_cancelled", occurredAt: new Date().toISOString() });
      } else {
        if (normalizedStatus.includes("montaz zakonczony")) {
          const installedAt = new Date(text(sale.installation_at || sale.installation_date || sale.sale_date));
          await sendProfitEvent({ ...base, externalEventId: `installation_completed:${saleId}`, eventType: "installation_completed", occurredAt: Number.isNaN(installedAt.getTime()) ? new Date().toISOString() : installedAt.toISOString(), payload: { final_pv_kwp: finalPvKwp } });
        }

        const payments = await supabaseAdmin.from("customer_payments").select("amount,paid_at,created_at").eq("sale_id", saleId);
        if (payments.error) throw payments.error;
        const paid = (payments.data || []).reduce((sum, payment) => sum + number(payment.amount), 0);
        const contractValue = number(sale.contract_value);
        if (contractValue > 0 && paid >= contractValue) {
          const lastPaymentAt = [...(payments.data || [])].sort((a, b) => text(b.paid_at).localeCompare(text(a.paid_at)))[0]?.paid_at;
          await sendProfitEvent({ ...base, externalEventId: `fully_paid:${saleId}`, eventType: "fully_paid", occurredAt: new Date(text(lastPaymentAt || sale.sale_date)).toISOString(), payload: { paid_amount: paid, contract_value: contractValue } });
        }
      }
      synced += 1;
    } catch (syncError) {
      failed += 1;
      console.error("Profit lifecycle sync failed", { referralId: link.profit_referral_id, error: errorText(syncError) });
    }
  }
  return { found: links?.length || 0, synced, failed };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "Brak autoryzacji CRON." }, { status: 401 });
  try {
    const [jobs, lifecycle] = await Promise.all([processReferralJobs(), syncLifecycleEvents()]);
    return NextResponse.json({ ok: jobs.failed === 0 && lifecycle.failed === 0, jobs, lifecycle });
  } catch (error) {
    console.error("Profit synchronization failed", error);
    return NextResponse.json({ ok: false, error: "Nie udało się zsynchronizować IdeaSol Profit." }, { status: 500 });
  }
}
