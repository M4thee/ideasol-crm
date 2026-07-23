"use client";

import { supabase } from "@/lib/supabase";
import type { MetaCrmEventName } from "@/lib/metaConversions";

type TrackMetaCrmEventInput = {
  eventName: MetaCrmEventName;
  sourceType: "client_activity" | "calendar_event" | "sale";
  sourceId: string;
  clientId: string;
};

export async function trackMetaCrmEvent(
  input: TrackMetaCrmEventInput
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.warn("[META CAPI] Pominięto zdarzenie: brak aktywnej sesji.");
      return;
    }

    const response = await fetch("/api/meta/conversions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      console.error("[META CAPI] Endpoint odrzucił zdarzenie:", {
        status: response.status,
        body: await response.text().catch(() => ""),
      });
    }
  } catch (error) {
    console.error("[META CAPI] Nie udało się przekazać zdarzenia:", error);
  }
}

