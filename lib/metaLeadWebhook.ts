export const IDEATERMO_META_PAGE_ID = "1447439791784822";

export type MetaLeadEvent = {
  leadgenId: string;
  formId: string | null;
  pageId: string | null;
};

type MetaWebhookBody = {
  entry?: Array<{
    id?: string | number;
    changes?: Array<{
      value?: {
        leadgen_id?: string | number;
        form_id?: string | number;
        page_id?: string | number;
      };
    }>;
  }>;
};

export function extractMetaLeadEvents(body: unknown): MetaLeadEvent[] {
  const events: MetaLeadEvent[] = [];
  const webhookBody = body as MetaWebhookBody | null;

  for (const entry of webhookBody?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (!value?.leadgen_id) continue;
      const pageId = value.page_id ?? entry.id;
      events.push({
        leadgenId: String(value.leadgen_id),
        formId: value.form_id ? String(value.form_id) : null,
        pageId: pageId ? String(pageId) : null,
      });
    }
  }

  return events;
}

export function getMetaLeadPageToken(
  pageId: string | null,
  env: Record<string, string | undefined> = process.env
) {
  const key = pageId === IDEATERMO_META_PAGE_ID
    ? "META_IDEATERMO_PAGE_ACCESS_TOKEN"
    : "META_PAGE_ACCESS_TOKEN";
  const accessToken = env[key]?.trim();
  if (!accessToken) throw new Error(`Brakuje ${key}.`);
  return accessToken;
}
