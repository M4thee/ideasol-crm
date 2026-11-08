import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const clientCard = fs.readFileSync(
  path.join(process.cwd(), "app/clients/[id]/page.tsx"),
  "utf8"
);

test("IdeaTermo calculations are loaded into the client offers tab", () => {
  assert.match(clientCard, /\.from\("ideatermo_preaudits"\)/);
  assert.match(clientCard, /\.eq\("client_id", clientId\)/);
  assert.match(
    clientCard,
    /tab\.id === "dashboard" \|\| tab\.id === "meetings" \|\| tab\.id === "offers"/
  );
});

test("IdeaTermo calculations have a distinct visual and document identity", () => {
  assert.match(clientCard, /IT-\{calculation\.id\.slice\(0, 8\)\.toUpperCase\(\)\}/);
  assert.match(clientCard, />\s*IdeaTermo\s*</);
  assert.match(clientCard, /Preaudyt \/ zakres prac/);
  assert.match(clientCard, /bg-\[#418cef\]/);
  assert.match(clientCard, /Pobierz PDF/);
  assert.match(clientCard, /Otwórz kalkulację/);
});
