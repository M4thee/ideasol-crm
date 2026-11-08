-- A form identifier must resolve to exactly one campaign and business area.
-- This prevents an IdeaSol and an IdeaTermo campaign from claiming the same
-- incoming form and makes webhook routing deterministic.
create unique index if not exists lead_integrations_source_form_unique_idx
  on public.lead_integrations (source_type, external_form_id)
  where external_form_id is not null;
