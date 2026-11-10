import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const { canAssignUserToBusinessArea, normalizeBusinessArea } = await import(
  "../lib/businessAreas.ts"
);

const source = fs.readFileSync(
  path.join(process.cwd(), "lib/businessAreas.ts"),
  "utf8"
);

test("business areas are explicit and default existing users to IdeaSol", () => {
  assert.match(source, /BUSINESS_AREAS = \["ideasol", "ideatermo"\]/);
  assert.match(source, /ideasol: true/);
  assert.match(source, /ideatermo: false/);
});

test("PV modules and preaudit are gated independently", () => {
  assert.match(source, /canUsePvSalesModules[\s\S]*permissions\.ideasol/);
  assert.match(source, /canUsePreaudit[\s\S]*permissions\.ideatermo/);
});

test("quick calculator stays visible but is fully disabled without IdeaSol access", () => {
  const dashboard = fs.readFileSync(
    path.join(process.cwd(), "app/page.tsx"),
    "utf8"
  );
  const quickCalculator = fs.readFileSync(
    path.join(process.cwd(), "app/components/QuickCalculatorWidget.tsx"),
    "utf8"
  );
  const calculateRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/calculate/route.ts"),
    "utf8"
  );

  assert.match(dashboard, /select\("ideasol"\)/);
  assert.match(dashboard, /hasIdeaSolAccess=\{hasIdeaSolAccess\}/);
  assert.match(quickCalculator, /Nie masz uprawnień do tej funkcjonalności\./);
  assert.match(quickCalculator, /<fieldset[\s\S]*?disabled=\{!hasIdeaSolAccess\}/);
  assert.match(quickCalculator, /async function calculatePrice\(\) \{\s*if \(!hasIdeaSolAccess\) return;/);
  assert.match(calculateRoute, /select\("custom_mode, incognito_sales, ideasol"\)/);
  assert.match(calculateRoute, /if \(!accessToken\)[\s\S]*?status: 401/);
  assert.match(calculateRoute, /if \(permission\?\.ideasol !== true\)[\s\S]*?status: 403/);
});

test("direct calculator URLs are denied without IdeaSol access", () => {
  const calculator = fs.readFileSync(
    path.join(process.cwd(), "app/calculator/page.tsx"),
    "utf8"
  );
  const calculatorApp = fs.readFileSync(
    path.join(process.cwd(), "app/calculator-app/page.tsx"),
    "utf8"
  );

  for (const page of [calculator, calculatorApp]) {
    assert.match(page, /calculatorAccess === "denied"/);
    assert.match(page, /Nie masz uprawnień do tej funkcjonalności\./);
    assert.match(page, /calculatorPermission[^\n]*\?\.ideasol !== true/);
  }

  assert.match(calculator, /select\("custom_mode, arimr_calculator, incognito_sales, ideasol"\)/);
  assert.match(calculatorApp, /select\("custom_mode, ideasol"\)/);
  assert.match(calculatorApp, /cachedProfile\?\.profile\?\.ideasol_access === true/);
});

test("campaign area is mapped exactly and unknown values stay in IdeaSol", () => {
  assert.equal(normalizeBusinessArea("ideatermo"), "ideatermo");
  assert.equal(normalizeBusinessArea("ideasol"), "ideasol");
  assert.equal(normalizeBusinessArea("unknown"), "ideasol");
  assert.equal(normalizeBusinessArea(null), "ideasol");
});

test("assignment targets must have access to the client's business area", () => {
  const ideaTermoOnlyUser = {
    ideasol_access: false,
    ideatermo_access: true,
  };
  const bothAreasUser = {
    ideasol_access: true,
    ideatermo_access: true,
  };

  assert.equal(canAssignUserToBusinessArea(ideaTermoOnlyUser, "ideasol"), false);
  assert.equal(canAssignUserToBusinessArea(ideaTermoOnlyUser, "ideatermo"), true);
  assert.equal(canAssignUserToBusinessArea(bothAreasUser, "ideasol"), true);
  assert.equal(canAssignUserToBusinessArea(bothAreasUser, "ideatermo"), true);
});

test("database prevents cross-area client assignment", () => {
  const migrationsDir = path.join(process.cwd(), "supabase/migrations");
  const migrationName = fs
    .readdirSync(migrationsDir)
    .find((name) => name.endsWith("_restrict_client_assignment_by_business_area.sql"));

  assert.ok(migrationName);
  const migration = fs.readFileSync(path.join(migrationsDir, migrationName), "utf8");
  assert.match(migration, /list_assignable_crm_users/);
  assert.match(migration, /enforce_client_assignee_business_area/);
  assert.match(migration, /clients_enforce_assignee_business_area/);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/);
});

test("client assignment lists are filtered by IdeaSol and IdeaTermo access", () => {
  const clientsPage = fs.readFileSync(
    path.join(process.cwd(), "app/clients/page.tsx"),
    "utf8"
  );
  const clientCard = fs.readFileSync(
    path.join(process.cwd(), "app/clients/[id]/page.tsx"),
    "utf8"
  );
  const importPage = fs.readFileSync(
    path.join(process.cwd(), "app/clients/import/page.tsx"),
    "utf8"
  );
  const imageImportRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/clients/import-images/route.ts"),
    "utf8"
  );

  for (const page of [clientsPage, clientCard, importPage]) {
    assert.match(page, /rpc\(\s*"list_assignable_crm_users"\s*\)/);
    assert.match(page, /canAssignUserToBusinessArea/);
  }

  assert.match(clientsPage, /bulkAssignableSellers/);
  assert.match(clientCard, /eligibleAssignableUsers/);
  assert.match(importPage, /canAssignUserToBusinessArea\(advisor, "ideasol"\)/);
  assert.match(imageImportRoute, /from\("user_permissions"\)[\s\S]*?eq\("ideasol", true\)/);
});

test("migration contains restrictive client and calendar gates", () => {
  const migrationsDir = path.join(process.cwd(), "supabase/migrations");
  const migrationName = fs
    .readdirSync(migrationsDir)
    .find((name) => name.endsWith("_add_ideatermo_business_area.sql"));

  assert.ok(migrationName);
  const migration = fs.readFileSync(path.join(migrationsDir, migrationName), "utf8");
  assert.match(migration, /clients_business_area_gate/);
  assert.match(migration, /calendar_events_business_area_gate/);
  assert.match(migration, /as restrictive/);
  assert.match(migration, /ideatermo_preaudits/);
  assert.match(migration, /lead_integrations_business_area_check/);
  assert.match(migration, /validate_lead_integration_participant_area/);
  assert.match(
    migration,
    /Commercial records belong exclusively to IdeaSol/
  );
});

test("lead campaigns persist the selected area and only assign eligible users", () => {
  const adminRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/admin/lead-integrations/route.ts"),
    "utf8"
  );
  const leadService = fs.readFileSync(
    path.join(process.cwd(), "lib/leadIntegrations.ts"),
    "utf8"
  );
  const metaWebhook = fs.readFileSync(
    path.join(process.cwd(), "app/api/meta/webhook/route.ts"),
    "utf8"
  );

  assert.match(adminRoute, /business_area: input\.businessArea/);
  assert.match(adminRoute, /findConflictingIntegration/);
  assert.match(adminRoute, /excludedIntegrationId/);
  assert.match(leadService, /integration\.business_area === "ideatermo"/);
  assert.match(
    metaWebhook,
    /const businessArea = normalizeBusinessArea\(integration\.business_area\)/
  );
  assert.match(metaWebhook, /ingestExternalLead\(supabaseAdmin, \{/);
  assert.match(metaWebhook, /businessArea,/);
});

test("a source form can belong to only one campaign", () => {
  const migrationsDir = path.join(process.cwd(), "supabase/migrations");
  const migrationName = fs
    .readdirSync(migrationsDir)
    .find((name) => name.endsWith("_enforce_unique_lead_campaign_form.sql"));

  assert.ok(migrationName);
  const migration = fs.readFileSync(path.join(migrationsDir, migrationName), "utf8");
  assert.match(migration, /create unique index/);
  assert.match(migration, /source_type, external_form_id/);
  assert.match(migration, /where external_form_id is not null/);
});

test("only the IdeaTermo header uses the IdeaTermo logo and Beta badge", () => {
  const header = fs.readFileSync(
    path.join(process.cwd(), "app/components/AppHeader.tsx"),
    "utf8"
  );

  assert.match(
    header,
    /src=\{isIdeaTermoRoute \? "\/brand\/logo_termo\.png" : "\/logo\.png"\}/
  );
  assert.match(header, /\{isIdeaTermoRoute \? \([\s\S]*?Beta[\s\S]*?\) : null\}/);
});
