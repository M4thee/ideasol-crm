import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { normalizeServicePostalCode } from "../lib/userServiceLocations.ts";

const userId = "11111111-1111-1111-1111-111111111111";
const otherUserId = "22222222-2222-2222-2222-222222222222";
const locationId = "33333333-3333-3333-3333-333333333333";
const source = readFileSync(new URL("../app/api/admin/postal-codes/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup() {
  const tables = {
    profiles: [{ id: userId, role: "seller", display_name: "Doradca", is_active: true }],
    user_permissions: [{ user_id: userId, ideasol: true, ideatermo: true }],
    user_service_locations: [{ id: locationId, user_id: userId, postal_code: "25-015", radius_km: 120 }],
    postal_code_locations: [
      { postal_code: "25-015", city: "Kielce", province: "Świętokrzyskie", latitude: 50.8, longitude: 20.6 },
      { postal_code: "91-024", city: "Łódź", province: "Łódzkie", latitude: 51.8, longitude: 19.4 },
      { postal_code: "00-000", city: "Brak współrzędnych", latitude: null, longitude: null },
    ],
  };
  let queries = 0;
  const db = { from(table) {
    queries += 1;
    let action = "select", values, single = false, limit = Infinity;
    const filters = [];
    const builder = {
      select() { return builder; },
      order() { return builder; },
      eq(key, value) { filters.push((row) => row[key] === value); return builder; },
      neq(key, value) { filters.push((row) => row[key] !== value); return builder; },
      in(key, values) { filters.push((row) => values.includes(row[key])); return builder; },
      limit(value) { limit = value; return builder; },
      maybeSingle() { single = true; return builder; },
      insert(value) { action = "insert"; values = value; return builder; },
      update(value) { action = "update"; values = value; return builder; },
      delete() { action = "delete"; return builder; },
      then(resolve, reject) {
        try {
          let rows = tables[table].filter((row) => filters.every((filter) => filter(row))).slice(0, limit);
          if (action === "insert") {
            rows = [{ id: "44444444-4444-4444-4444-444444444444", radius_km: 80, ...values }];
            tables[table].push(...rows);
          } else if (action === "update") rows.forEach((row) => Object.assign(row, values));
          else if (action === "delete") tables[table] = tables[table].filter((row) => !rows.includes(row));
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return builder;
  } };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console,
    require(name) {
      if (name === "next/server") return { NextResponse: { json: (body, init) => Response.json(body, init) } };
      if (name === "@/lib/supabase/admin") return { supabaseAdmin: db };
      if (name === "@/lib/userServiceLocations") return { normalizeServicePostalCode };
      if (name === "@/lib/auth/requireAdminRequest") return {
        requireAdminRequest: async (request) => request.headers.get("Authorization") === "Bearer admin-test"
          ? { id: "admin", role: "admin" } : null,
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  async function call(method, body, admin = true) {
    return exports[method](new Request("http://localhost/api/admin/postal-codes", {
      method,
      headers: admin ? { Authorization: "Bearer admin-test" } : {},
      ...(method !== "GET" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
    }));
  }
  return { tables, call, queryCount: () => queries };
}

test("normalizacja akceptuje polski kod z myślnikiem lub bez i odrzuca uszkodzone dane", () => {
  assert.equal(normalizeServicePostalCode(" 25015 "), "25-015");
  assert.equal(normalizeServicePostalCode("91-024"), "91-024");
  for (const value of [null, 25015, "abc25015", "25-01", "25-0150", "25 015", "25-015<script>"]) {
    assert.equal(normalizeServicePostalCode(value), null);
  }
});

test("każda operacja odrzuca brak administratora przed zapytaniem o dane", async () => {
  const app = setup();
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.equal((await app.call(method, { userId, id: locationId }, false)).status, 403);
  }
  assert.equal(app.queryCount(), 0);
});

test("odczyt zawiera lokalizacje i oba obszary działalności", async () => {
  const app = setup();
  const response = await app.call("GET");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { users } = await response.json();
  assert.equal(users[0].ideatermo, true);
  assert.equal(users[0].locations[0].has_coordinates, true);
  assert.deepEqual(users[0].locations[0].places, ["Kielce, Świętokrzyskie"]);
});

test("dodanie kodu nie usuwa poprzednich lokalizacji", async () => {
  const app = setup();
  const response = await app.call("POST", { userId, postalCode: "91024" });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).location.postal_code, "91-024");
  assert.equal(app.tables.user_service_locations.length, 2);
  assert.equal(app.tables.user_service_locations[0].postal_code, "25-015");
});

test("poprawienie kodu zachowuje użytkownika, identyfikator i promień", async () => {
  const app = setup();
  const response = await app.call("PATCH", { userId, id: locationId, postalCode: "91-024" });
  assert.equal(response.status, 200);
  assert.deepEqual(app.tables.user_service_locations, [{ id: locationId, user_id: userId, postal_code: "91-024", radius_km: 120 }]);
});

test("nie można edytować ani usunąć lokalizacji innego użytkownika", async () => {
  const app = setup();
  app.tables.profiles.push({ id: otherUserId, role: "owner" });
  for (const method of ["PATCH", "DELETE"]) {
    assert.equal((await app.call(method, { userId: otherUserId, id: locationId, postalCode: "91-024" })).status, 404);
  }
  assert.equal(app.tables.user_service_locations[0].postal_code, "25-015");
});

test("usuwanie dotyczy tylko wybranej lokalizacji", async () => {
  const app = setup();
  app.tables.user_service_locations.push({ id: "other", user_id: userId, postal_code: "91-024" });
  assert.equal((await app.call("DELETE", { userId, id: locationId })).status, 200);
  assert.equal(app.tables.user_service_locations.length, 1);
  assert.equal(app.tables.user_service_locations[0].id, "other");
});

test("duplikaty, nierozpoznane kody i nieprawidłowe żądania nie zmieniają danych", async () => {
  const app = setup();
  for (const [body, status] of [
    [{ userId, postalCode: "25-015" }, 409],
    [{ userId, postalCode: "99-999" }, 400],
    [{ userId, postalCode: "00-000" }, 400],
    [{ userId, postalCode: "błąd" }, 400],
    [{ userId: "nie-uuid", postalCode: "91-024" }, 400],
    ["{uszkodzony json", 400],
    [null, 400],
  ]) assert.equal((await app.call("POST", body)).status, status);
  assert.equal(app.tables.user_service_locations.length, 1);
});
