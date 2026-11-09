import assert from "node:assert/strict";
import test from "node:test";
import { extractMetaLeadEvents, getMetaLeadPageToken } from "../lib/metaLeadWebhook.ts";

test("a mixed Meta batch selects the page credential for each lead", () => {
  const events = extractMetaLeadEvents({
    object: "page",
    entry: [
      { id: "9876", changes: [{ field: "leadgen", value: { leadgen_id: "1", form_id: "10" } }] },
      { id: "1447439791784822", changes: [
        { field: "feed", value: { item: "post" } },
        { field: "leadgen", value: { leadgen_id: "2", form_id: "20", page_id: 1447439791784822 } },
        { field: "leadgen", value: { leadgen_id: "3", form_id: "30" } },
      ] },
    ],
  });
  const env = { META_PAGE_ACCESS_TOKEN: "legacy-token", META_IDEATERMO_PAGE_ACCESS_TOKEN: "termo-token" };

  assert.deepEqual(events.map(({ leadgenId, formId, pageId }) => [
    leadgenId, formId, getMetaLeadPageToken(pageId, env),
  ]), [
    ["1", "10", "legacy-token"],
    ["2", "20", "termo-token"],
    ["3", "30", "termo-token"],
  ]);
});

test("a missing IdeaTermo credential does not fall through to IdeaSol", () => {
  const env = { META_PAGE_ACCESS_TOKEN: "legacy-token" };
  assert.throws(() => getMetaLeadPageToken("1447439791784822", env), /META_IDEATERMO_PAGE_ACCESS_TOKEN/);
  assert.equal(getMetaLeadPageToken(null, env), "legacy-token");
});
