import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const {
  calculateIdeaTermoPreaudit,
  estimateClimateZoneFromPostalCode,
} = await import(path.join(process.cwd(), "lib/ideatermo/preaudit.ts"));

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const source = read("lib/ideatermo/preaudit.ts");
const fieldsSource = read("lib/ideatermo/preauditFields.ts");
const pageSource = read("app/ideatermo/preaudyt/page.tsx");
const appHeaderSource = read("app/components/AppHeader.tsx");
const globalsSource = read("app/globals.css");
const pdfSource = read("lib/ideatermo/preauditPdf.ts");
const buildingShapePreviewSource = read(
  "app/ideatermo/preaudyt/BuildingShapePreview.tsx"
);
const advancedMigrationSource = read(
  "supabase/migrations/20261107210528_add_ideatermo_advanced_survey.sql"
);

const calculationInput = (overrides = {}) => ({
  buildingType: "dom_jednorodzinny",
  heatedAreaM2: 150,
  buildingStoreys: "ground_plus_1",
  roofType: "pitched_without_attic",
  hasBasement: false,
  hasIntegratedGarage: false,
  heatedLevels: ["ground_floor", "floor_1"],
  buildingLengthM: null,
  buildingWidthM: null,
  averageStoreyHeightM: 2.7,
  climateZone: "III",
  ventilationType: "natural",
  airChangeRatePerHour: null,
  wallMaterial: "solid_brick",
  wallThicknessCm: 38,
  wallInsulationLayers: [],
  roofInsulationLayers: [],
  floorInsulationLayers: [],
  windowType: "older_insulated_glass",
  windows: [
    {
      kind: "2_tilt_turn",
      dimensions: [
        { widthCm: 150, heightCm: 140 },
        { widthCm: 150, heightCm: 140 },
      ],
    },
  ],
  externalDoors: [{ type: "old_wooden", widthCm: 100, heightCm: 210 }],
  plannedScope: [
    "Docieplenie ścian",
    "Docieplenie dachu / stropu",
    "Docieplenie podłogi",
    "Wymiana okien",
    "Wymiana drzwi",
    "Modernizacja źródła ciepła",
  ],
  wallInsulationSurfaces: [
    { areaM2: 45 },
    { areaM2: 45 },
    { areaM2: 35 },
    { areaM2: 35 },
  ],
  plannedWallInsulationMaterial: "graphite_eps",
  plannedWallInsulationCm: 15,
  plannedRoofInsulationMaterial: "mineral_wool",
  plannedRoofInsulationCm: 25,
  plannedRoofAreaM2: 85,
  plannedFloorInsulationMaterial: "xps",
  plannedFloorInsulationCm: 10,
  plannedFloorAreaM2: 75,
  plannedWindowUValue: 0.9,
  plannedDoorUValue: 1.3,
  currentHeatSource: "gas",
  currentSourcePowerKw: 25,
  currentFuelType: "",
  annualFuelQuantity: null,
  woodType: "",
  woodSeasoning: "",
  fuelConsumptionBasis: "",
  currentHeatingPerformance: "maintains_temperature",
  supplementalHeatingUsed: false,
  currentSourceHeatsDhw: true,
  householdMembers: 4,
  plannedHeatSource: "air_to_water_heat_pump",
  plannedSourceHeatsDhw: true,
  heatingDistributionType: "radiators",
  heatingSupplyTemperatureC: 50,
  desiredIndoorTemperatureC: 21,
  ...overrides,
});

test("annual energy estimate exists only in the optional advanced mode", () => {
  const ordinary = calculateIdeaTermoPreaudit(calculationInput());
  assert.equal(ordinary.advancedEnergy.enabled, false);
  assert.equal(ordinary.advancedEnergy.status, "disabled");
  assert.equal(ordinary.advancedEnergy.currentRange, null);
  assert.match(pageSource, /Tryb zaawansowany/);
  assert.match(pageSource, /type="checkbox"/);
  assert.match(pageSource, /activeWizardStep === "advanced"/);
  assert.match(pageSource, /Szacowane zapotrzebowanie na energię użytkową/);
  assert.match(pdfSource, /Wstępna analiza energetyczna/);
});

test("document is explicitly a contractor work scope, not an audit or offer", () => {
  assert.match(pageSource, /Karta zakresu prac termomodernizacyjnych/);
  assert.match(pageSource, /Zestawienie zakresu do wyceny/);
  assert.match(pdfSource, /Zestawienie prac dla wykonawcy/);
  assert.match(pdfSource, /Nie jest ofertą, umową, audytem energetycznym ani DPAE/);
  assert.match(pdfSource, /IdeaTermo \| zakres prac do wyceny/);
});

test("survey naming and the Safari date field match the questionnaire UI", () => {
  assert.match(pageSource, /label="Data ankiety"/);
  assert.match(pdfSource, /Data ankiety/);
  assert.doesNotMatch(pageSource, /inwentaryzacj/i);
  assert.doesNotMatch(pdfSource, /inwentaryzacj/i);
  assert.match(pageSource, /ideatermo-date-input/);
  assert.match(globalsSource, /ideatermo-date-input::\-webkit-date-and-time-value/);
  assert.match(globalsSource, /min-height: 3rem/);
});

test("climate zone is estimated from the lead postal code with a central fallback", () => {
  assert.equal(estimateClimateZoneFromPostalCode("70-001"), "I");
  assert.equal(estimateClimateZoneFromPostalCode("50-001"), "II");
  assert.equal(estimateClimateZoneFromPostalCode("00-001"), "III");
  assert.equal(estimateClimateZoneFromPostalCode("15-001"), "IV");
  assert.equal(estimateClimateZoneFromPostalCode("16-400"), "V");
  assert.equal(estimateClimateZoneFromPostalCode("34-500"), "V");
  assert.equal(estimateClimateZoneFromPostalCode(null), "III");
});

test("all existing heat sources may be selected for replacement", () => {
  assert.doesNotMatch(fieldsSource, /HEAT_SOURCES_EXCLUDED_FROM_MODERNIZATION/);
  assert.doesNotMatch(pageSource, /heatSourceModernizationDisabled/);
  assert.doesNotMatch(pageSource, /nie kwalifikuje tego zakresu do dotacji/);
  assert.match(fieldsSource, /Modernizacja źródła ciepła/);
});

test("complete ordinary survey exposes only a ±15 percent power range", () => {
  const result = calculateIdeaTermoPreaudit(calculationInput());

  assert.equal(result.powerEstimateStatus, "within_15_percent");
  assert.equal(result.powerEstimateMarginPercent, 15);
  assert.equal(result.powerEstimateMissingInputs.length, 0);
  assert.ok(result.indicativeRequiredPowerKw > 0);
  assert.equal(
    result.indicativePowerMinKw,
    Math.round(result.indicativeRequiredPowerKw * 0.85 * 10) / 10
  );
  assert.equal(
    result.indicativePowerMaxKw,
    Math.round(result.indicativeRequiredPowerKw * 1.15 * 10) / 10
  );
});

test("missing quantity or envelope data withholds the power recommendation", () => {
  const result = calculateIdeaTermoPreaudit(
    calculationInput({ windowType: "", plannedRoofAreaM2: null })
  );

  assert.equal(result.powerEstimateStatus, "insufficient_data");
  assert.equal(result.indicativeRequiredPowerKw, null);
  assert.equal(result.indicativePowerMinKw, null);
  assert.equal(result.indicativePowerMaxKw, null);
  assert.ok(result.powerEstimateMissingInputs.includes("rodzaj obecnych okien"));
  assert.ok(
    result.powerEstimateMissingInputs.includes(
      "powierzchnia dachu lub stropu do docieplenia"
    )
  );
});

test("fuel declarations do not change the contractor power range", () => {
  const withoutFuel = calculateIdeaTermoPreaudit(calculationInput());
  const withFuel = calculateIdeaTermoPreaudit(
    calculationInput({
      currentFuelType: "hard_coal",
      annualFuelQuantity: 4,
      fuelConsumptionBasis: "average_2_3_years",
    })
  );

  assert.equal(
    withFuel.indicativeRequiredPowerKw,
    withoutFuel.indicativeRequiredPowerKw
  );
  assert.equal(withFuel.indicativePowerMinKw, withoutFuel.indicativePowerMinKw);
  assert.equal(withFuel.indicativePowerMaxKw, withoutFuel.indicativePowerMaxKw);
});

test("quantities needed by a contractor are carried in the calculation payload", () => {
  const result = calculateIdeaTermoPreaudit(calculationInput());

  assert.equal(result.workScope.wallAreaM2, 160);
  assert.equal(result.workScope.roofAreaM2, 85);
  assert.equal(result.workScope.floorAreaM2, 75);
  assert.equal(result.workScope.windowCount, 2);
  assert.equal(result.workScope.windowAreaM2, 4.2);
  assert.equal(result.workScope.doorCount, 1);
  assert.equal(result.workScope.doorAreaM2, 2.1);
  assert.match(pageSource, /Powierzchnia do docieplenia \(m²\)/);
  assert.match(pdfSource, /Ilość \/ powierzchnia/);
});

test("planned work lowers modeled design heat load in ordinary mode", () => {
  const result = calculateIdeaTermoPreaudit(calculationInput());

  assert.ok(result.currentDesignHeatLoadKw > result.postModernizationDesignHeatLoadKw);
  assert.ok(result.currentUValues.wall > result.postModernizationUValues.wall);
  assert.ok(result.currentUValues.roof > result.postModernizationUValues.roof);
  assert.ok(result.currentUValues.floor > result.postModernizationUValues.floor);
  assert.equal(result.advancedEnergy.enabled, false);
  assert.equal(result.advancedEnergy.currentUsefulEnergyKwhM2Year, null);
});

test("advanced survey estimates before, after, reduction and programme conditions", () => {
  const result = calculateIdeaTermoPreaudit(
    calculationInput({
      advancedSurvey: {
        enabled: true,
        totalBuildingAreaM2: 185,
        footprintShape: "compact",
        storeyHeightsM: { ground_floor: 2.7, floor_1: 2.7 },
        allWindowsReplaced: "no",
        remainingWindowAreaM2: 6,
        allDoorsReplaced: "yes",
        remainingDoorAreaM2: null,
        basementCoverage: "unknown",
        partialBasementAreaM2: null,
        airtightness: "average",
        usualIndoorTemperatureC: 21,
        householdType: "multi",
        incomeBand: "elevated",
      },
    })
  );

  assert.equal(result.advancedEnergy.enabled, true);
  assert.equal(result.advancedEnergy.status, "calculated");
  assert.ok(result.advancedEnergy.currentUsefulEnergyKwhM2Year > 0);
  assert.ok(
    result.advancedEnergy.currentUsefulEnergyKwhM2Year >
      result.advancedEnergy.postUsefulEnergyKwhM2Year
  );
  assert.ok(result.advancedEnergy.reductionPercent > 0);
  assert.ok(result.advancedEnergy.currentRange.min > 0);
  assert.match(result.advancedEnergy.incomeAssessmentLabel, /podwyższonemu/);
  assert.match(result.advancedEnergy.disclaimer, /nie audyt energetyczny/i);
});

test("advanced assessment never credits an unchanged scope with a 40 percent reduction", () => {
  const result = calculateIdeaTermoPreaudit(
    calculationInput({
      plannedScope: ["Modernizacja źródła ciepła"],
      advancedSurvey: {
        enabled: true,
        totalBuildingAreaM2: 185,
        footprintShape: "compact",
        storeyHeightsM: { ground_floor: 2.7, floor_1: 2.7 },
        allWindowsReplaced: "unknown",
        remainingWindowAreaM2: 20,
        allDoorsReplaced: "unknown",
        remainingDoorAreaM2: 2.1,
        basementCoverage: "unknown",
        partialBasementAreaM2: null,
        airtightness: "average",
        usualIndoorTemperatureC: 21,
        householdType: "multi",
        incomeBand: "elevated",
      },
    })
  );

  assert.equal(result.advancedEnergy.reductionPercent, 0);
  assert.equal(result.advancedEnergy.programmeAssessment, "unlikely_meets");
});

test("advanced mode keeps geometry and income questions simple", () => {
  assert.match(pageSource, /Powierzchnia całkowita budynku/);
  assert.match(pageSource, /Jaki kształt ma rzut budynku/);
  assert.match(pageSource, /FootprintShapeDiagram/);
  assert.match(pageSource, /Schemat rzutu budynku/);
  assert.match(pageSource, /Wysokości kondygnacji/);
  assert.match(pageSource, /Czy wszystkie okna podlegają wymianie/);
  assert.match(pageSource, /Jak ocenisz szczelność budynku/);
  assert.match(pageSource, /Strefa klimatyczna z kodu pocztowego klienta/);
  assert.match(pageSource, /Przewidywany próg dochodowy/);
  assert.match(fieldsSource, /Gospodarstwo jednoosobowe/);
  assert.match(fieldsSource, /Gospodarstwo wieloosobowe/);
  assert.doesNotMatch(pageSource, /Dokładny dochód|Wpisz dochód/);
});

test("partial basement area is optional, persisted and affects floor boundary losses", () => {
  const advancedSurvey = {
    enabled: true,
    totalBuildingAreaM2: 185,
    footprintShape: "compact",
    storeyHeightsM: { ground_floor: 2.7, floor_1: 2.7 },
    allWindowsReplaced: "yes",
    remainingWindowAreaM2: null,
    allDoorsReplaced: "yes",
    remainingDoorAreaM2: null,
    basementCoverage: "partial",
    partialBasementAreaM2: 20,
    airtightness: "average",
    usualIndoorTemperatureC: 21,
    householdType: "multi",
    incomeBand: "elevated",
  };
  const smallBasement = calculateIdeaTermoPreaudit(
    calculationInput({
      hasBasement: true,
      advancedSurvey,
    })
  );
  const largeBasement = calculateIdeaTermoPreaudit(
    calculationInput({
      hasBasement: true,
      advancedSurvey: { ...advancedSurvey, partialBasementAreaM2: 70 },
    })
  );

  assert.ok(
    largeBasement.heatLoss.currentTransmissionWPerK >
      smallBasement.heatLoss.currentTransmissionWPerK
  );
  assert.match(pageSource, /Powierzchnia piwnicy \(m²\) – opcjonalnie/);
  assert.match(pageSource, /partial_basement_area_m2/);
  assert.match(pdfSource, /drawBuildingShapePreview/);
  assert.match(pdfSource, /Poglądowa bryła budynku/);
});

test("advanced answers have additive database columns and store only an income band", () => {
  assert.match(advancedMigrationSource, /total_building_area_m2 numeric/);
  assert.match(advancedMigrationSource, /advanced_survey jsonb/);
  assert.match(advancedMigrationSource, /jsonb_typeof\(advanced_survey\) = 'object'/);
  assert.match(pageSource, /income_band: form\.advanced_income_band/);
  assert.doesNotMatch(pageSource, /exact_income|income_amount/);
});

test("window and door structures remain detailed and visually represented", () => {
  assert.match(pageSource, /WINDOW_KINDS.map/);
  assert.match(pageSource, /<span>Ilość:<\/span>/);
  assert.match(pageSource, /DimensionsEditor/);
  assert.match(pageSource, /Math\.min\(3, quantity \|\| 0\)/);
  assert.match(pdfSource, /drawWindowDiagram/);
  assert.match(pdfSource, /Drzwi zewnętrzne/);
});

test("selected work categories block progress until their data is complete", () => {
  assert.match(pageSource, /function getInsulationValidationMessage/);
  assert.match(pageSource, /function getWindowsValidationMessage/);
  assert.match(pageSource, /function getDoorsValidationMessage/);
  assert.match(pageSource, /Uzupełnij szerokość i wysokość każdego okna/);
  assert.match(
    pageSource,
    /Wybierz rodzaj oraz uzupełnij szerokość i wysokość każdych drzwi/
  );
  assert.match(pageSource, /Uzupełnij wymiary lub powierzchnię każdej ściany/);
  assert.match(pageSource, /index > maxReachableWizardStepIndex/);
  assert.match(pageSource, /disabled=\{!canContinue\}/);
  assert.match(pageSource, /Uzupełnij dane, aby przejść dalej/);
});

test("survey does not ask for a document calorific value", () => {
  assert.doesNotMatch(pageSource, /Wartość opałowa|fuel_calorific_value/);
  assert.doesNotMatch(pdfSource, /Wartość opałowa|fuel_calorific_value/);
  assert.doesNotMatch(source, /fuelCalorificValue/);
});

test("wall, roof and floor insulation keep the requested practical layer catalogues", () => {
  assert.match(fieldsSource, /Pustka powietrzna/);
  assert.match(fieldsSource, /Styropian grafitowy EPS/);
  assert.match(fieldsSource, /Wełna mineralna/);
  assert.match(fieldsSource, /Celuloza lub ekofiber/);
  assert.match(pageSource, /MAX_WALL_INSULATION_LAYERS = 4/);
  assert.match(pageSource, /MAX_ROOF_INSULATION_LAYERS = 3/);
  assert.match(pageSource, /MAX_FLOOR_INSULATION_LAYERS = 3/);
  assert.match(pageSource, /Nietypowy kształt – wpisz powierzchnię ręcznie/);
});

test("ordinary survey hides technical geometry and air-change inputs", () => {
  assert.match(pageSource, /estimateClimateZoneFromPostalCode/);
  assert.match(pageSource, /Czy w budynku jest rekuperacja\?/);
  assert.doesNotMatch(pageSource, /label="Długość budynku/);
  assert.doesNotMatch(pageSource, /label="Szerokość budynku/);
  assert.doesNotMatch(pageSource, /label="Średnia wysokość kondygnacji/);
  assert.doesNotMatch(pageSource, /label="Wymiany powietrza/);
});

test("client search is dynamic and scoped to the current user", () => {
  assert.match(pageSource, /MIN_CLIENT_SEARCH_LENGTH = 2/);
  assert.match(pageSource, /setTimeout\(async \(\) =>/);
  assert.match(pageSource, /\.ilike\("full_name",/);
  assert.match(pageSource, /\.limit\(12\)/);
  assert.match(pageSource, /return role === "admin" \|\| role === "owner";/);
  assert.match(
    pageSource,
    /clientsQuery = clientsQuery\.eq\("assigned_user_id", currentUserId\)/
  );
});

test("building shape survey still drives heated levels and preview", () => {
  assert.match(fieldsSource, /Parterowy/);
  assert.match(fieldsSource, /Parter \+ 3 piętra/);
  assert.match(fieldsSource, /Skośny z poddaszem/);
  assert.match(pageSource, /Bryła budynku i ogrzewane kondygnacje/);
  assert.match(pageSource, /<BuildingShapePreview/);
  assert.match(buildingShapePreviewSource, /aria-pressed=\{heated\}/);
  assert.match(buildingShapePreviewSource, /Poziom gruntu/);
});

test("wizard and PDF use the IdeaTermo blue accent", () => {
  for (const id of [
    "client",
    "scope",
    "insulation",
    "windows",
    "doors",
    "heat_source",
    "advanced",
    "summary",
  ]) {
    assert.match(pageSource, new RegExp(`id: "${id}"`));
  }
  assert.match(pageSource, /IdeaTermo - konfigurator\./);
  assert.match(pageSource, /text-termo-400/);
  assert.match(pageSource, /bg-termo-500/);
  assert.match(pageSource, /ideatermo-active-step-index/);
  assert.match(globalsSource, /color: #172a49 !important/);
  assert.match(pageSource, /dark:text-white\/80/);
  assert.match(globalsSource, /--color-termo-500: #418cef/);
  assert.match(pdfSource, /accent: rgb\(0\.255, 0\.549, 0\.937\)/);
  assert.match(pdfSource, /ideatermo-logo\.jpg/);
  assert.match(appHeaderSource, /\/brand\/logo_termo\.png/);
  assert.match(appHeaderSource, /isIdeaTermoItem/);
  assert.match(appHeaderSource, /bg-termo-500 text-white/);
  assert.equal(
    fs.existsSync(path.join(process.cwd(), "public/brand/logo_termo.png")),
    true
  );
});
