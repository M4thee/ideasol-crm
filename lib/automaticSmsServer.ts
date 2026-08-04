import "server-only";

import {
  SMS_AUTOMATION_TRIGGERS,
  type SmsAutomation,
  type SmsAutomationTrigger,
} from "@/lib/automaticSms";
import { supabaseAdmin } from "@/lib/supabase/admin";

const VALID_TRIGGERS = new Set<string>(SMS_AUTOMATION_TRIGGERS);

export async function getActiveSmsAutomations(trigger: SmsAutomationTrigger) {
  if (!VALID_TRIGGERS.has(trigger)) return [];

  const { data, error } = await supabaseAdmin
    .from("sms_automations")
    .select(
      "id,automation_key,message_type,title,trigger_type,message_template,offset_minutes,is_active,is_system,sort_order,created_at,updated_at"
    )
    .eq("trigger_type", trigger)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Nie udało się pobrać automatycznych SMS: ${error.message}`);
  }

  return (data || []) as SmsAutomation[];
}

export async function getSmsAutomationById(
  id: string,
  trigger?: SmsAutomationTrigger
) {
  let query = supabaseAdmin
    .from("sms_automations")
    .select(
      "id,automation_key,message_type,title,trigger_type,message_template,offset_minutes,is_active,is_system,sort_order,created_at,updated_at"
    )
    .eq("id", id)
    .eq("is_active", true);

  if (trigger) query = query.eq("trigger_type", trigger);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Nie udało się pobrać automatycznego SMS: ${error.message}`);
  }

  return data ? (data as SmsAutomation) : null;
}
