import "server-only";

import { getProfitAdminClient } from "@/lib/profit/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const PROFIT_REGISTRATION_URL = "https://profit.ideasol.pl/rejestracja";

type CrmAdvisorProfile = {
  id: string;
  user_number: number | string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean;
  profit_enabled: boolean;
  profit_referral_code: string | null;
  manager_id: string | null;
};

export type ProfitSeller = {
  id: string;
  crm_user_id: string;
  crm_numeric_id: number | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  crm_role: string | null;
  is_active: boolean;
  profit_enabled: boolean;
  referral_code: string;
  referral_slug: string;
};

function splitDisplayName(displayName: string | null) {
  const parts = String(displayName || "Doradca IdeaSol").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || "Doradca",
    lastName: parts.join(" ") || "IdeaSol",
  };
}

function normalizeAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

function buildReferralCode(profile: CrmAdvisorProfile) {
  const nameParts = String(profile.display_name || "IS").trim().split(/\s+/).filter(Boolean);
  const initials = normalizeAscii(nameParts.map((part) => part[0] || "").join("").slice(0, 3)) || "IS";
  const numericId = String(profile.user_number).replace(/\D/g, "") || "0";
  return `${initials}${numericId}`.toUpperCase();
}

function registrationUrl(code: string) {
  const params = new URLSearchParams({ doradca: code });
  return `${PROFIT_REGISTRATION_URL}?${params.toString()}`;
}

async function saveReferralCode(profile: CrmAdvisorProfile) {
  if (profile.profit_referral_code) return profile.profit_referral_code.toUpperCase();

  const code = buildReferralCode(profile);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ profit_referral_code: code, profit_enabled: true })
    .eq("id", profile.id)
    .is("profit_referral_code", null)
    .select("profit_referral_code")
    .maybeSingle();

  if (error) throw error;

  if (data?.profit_referral_code) return String(data.profit_referral_code).toUpperCase();

  const { data: current, error: currentError } = await supabaseAdmin
    .from("profiles")
    .select("profit_referral_code")
    .eq("id", profile.id)
    .single();
  if (currentError || !current?.profit_referral_code) throw currentError || new Error("Nie udało się utworzyć kodu doradcy.");
  return String(current.profit_referral_code).toUpperCase();
}

export async function syncProfitSeller(profile: CrmAdvisorProfile) {
  const referralCode = await saveReferralCode(profile);
  if (!profile.profit_enabled) {
    const { error: enableError } = await supabaseAdmin
      .from("profiles")
      .update({ profit_enabled: true })
      .eq("id", profile.id);
    if (enableError) throw enableError;
  }
  const name = splitDisplayName(profile.display_name);
  const numericId = Number(profile.user_number);
  const sellerData = {
    crm_user_id: profile.id,
    crm_numeric_id: Number.isSafeInteger(numericId) ? numericId : null,
    first_name: name.firstName,
    last_name: name.lastName,
    email: profile.email || null,
    phone: profile.phone || null,
    crm_role: profile.role || null,
    is_active: profile.is_active,
    profit_enabled: profile.is_active,
    referral_code: referralCode,
    referral_slug: referralCode.toLowerCase(),
    manager_crm_user_id: profile.manager_id || null,
    updated_at: new Date().toISOString(),
  };

  const profit = getProfitAdminClient();
  const { data, error } = await profit
    .from("profit_sellers")
    .upsert(sellerData, { onConflict: "crm_user_id" })
    .select("id,crm_user_id,crm_numeric_id,first_name,last_name,email,phone,crm_role,is_active,profit_enabled,referral_code,referral_slug")
    .single();
  if (error) throw error;

  return {
    seller: data as ProfitSeller,
    registrationUrl: registrationUrl(referralCode),
  };
}

export async function syncProfitSellerByCrmUserId(crmUserId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,user_number,display_name,email,phone,role,is_active,profit_enabled,profit_referral_code,manager_id")
    .eq("id", crmUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) return null;
  return syncProfitSeller(data as CrmAdvisorProfile);
}

export async function syncAllActiveProfitSellers() {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,user_number,display_name,email,phone,role,is_active,profit_enabled,profit_referral_code,manager_id")
    .eq("is_active", true)
    .order("user_number", { ascending: true });
  if (error) throw error;

  const synced: Array<{ seller: ProfitSeller; registrationUrl: string }> = [];
  for (const profile of data || []) {
    synced.push(await syncProfitSeller(profile as CrmAdvisorProfile));
  }
  return synced;
}

export async function getProfitSellerForCrmUser(crmUserId: string) {
  const profit = getProfitAdminClient();
  const { data, error } = await profit
    .from("profit_sellers")
    .select("id,crm_user_id,crm_numeric_id,first_name,last_name,email,phone,crm_role,is_active,profit_enabled,referral_code,referral_slug")
    .eq("crm_user_id", crmUserId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfitSeller | null;
}
