import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { calculateIdeaTermoPreaudit } from "../lib/ideatermo/preaudit";
import { createIdeaTermoPreauditPdf } from "../lib/ideatermo/preauditPdf";

const plannedScope = [
  "Docieplenie ścian",
  "Docieplenie dachu / stropu",
  "Docieplenie podłogi",
  "Wymiana okien",
  "Wymiana drzwi",
  "Modernizacja źródła ciepła",
  "Modernizacja instalacji CO/CWU",
];

const windows = [
  {
    kind: "2_tilt_turn",
    dimensions: [
      { width_cm: 150, height_cm: 140 },
      { width_cm: 150, height_cm: 140 },
    ],
  },
  {
    kind: "1_fixed",
    dimensions: [{ width_cm: 90, height_cm: 120 }],
  },
];

const externalDoors = [
  { type: "old_wooden", width_cm: 100, height_cm: 210 },
  { type: "old_metal", width_cm: 90, height_cm: 200 },
];

const wallInsulationSurfaces = [
  {
    area_mode: "dimensions",
    width_m: 10,
    height_m: 5.4,
    manual_area_m2: null,
    area_m2: 54,
  },
  {
    area_mode: "dimensions",
    width_m: 8,
    height_m: 5.4,
    manual_area_m2: null,
    area_m2: 43.2,
  },
  {
    area_mode: "manual",
    width_m: null,
    height_m: null,
    manual_area_m2: 46.5,
    area_m2: 46.5,
  },
];

const calculation = calculateIdeaTermoPreaudit({
  buildingType: "dom_jednorodzinny",
  heatedAreaM2: 145,
  buildingStoreys: "ground_plus_1",
  roofType: "pitched_without_attic",
  hasBasement: true,
  hasIntegratedGarage: true,
  heatedLevels: ["ground_floor", "floor_1"],
  buildingLengthM: null,
  buildingWidthM: null,
  averageStoreyHeightM: 2.7,
  climateZone: "III",
  ventilationType: "natural",
  airChangeRatePerHour: null,
  wallMaterial: "solid_brick",
  wallThicknessCm: 38,
  wallInsulationLayers: [{ material: "white_eps", thicknessCm: 5 }],
  roofInsulationLayers: [{ material: "mineral_wool", thicknessCm: 10 }],
  floorInsulationLayers: [],
  windowType: "older_insulated_glass",
  windows: windows.map((group) => ({
    kind: group.kind,
    dimensions: group.dimensions.map((dimension) => ({
      widthCm: dimension.width_cm,
      heightCm: dimension.height_cm,
    })),
  })),
  externalDoors: externalDoors.map((door) => ({
    type: door.type,
    widthCm: door.width_cm,
    heightCm: door.height_cm,
  })),
  plannedScope,
  wallInsulationSurfaces: wallInsulationSurfaces.map((surface) => ({
    areaM2: surface.area_m2,
  })),
  plannedWallInsulationMaterial: "graphite_eps",
  plannedWallInsulationCm: 18,
  plannedRoofInsulationMaterial: "mineral_wool",
  plannedRoofInsulationCm: 25,
  plannedRoofAreaM2: 82,
  plannedFloorInsulationMaterial: "xps",
  plannedFloorInsulationCm: 10,
  plannedFloorAreaM2: 72,
  plannedWindowUValue: 0.9,
  plannedDoorUValue: 1.3,
  currentHeatSource: "gas",
  currentSourcePowerKw: 24,
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
  heatingDistributionType: "mixed",
  heatingSupplyTemperatureC: 45,
  desiredIndoorTemperatureC: 21,
  advancedSurvey: {
    enabled: true,
    totalBuildingAreaM2: 185,
    footprintShape: "compact",
    storeyHeightsM: {
      basement: 2.4,
      ground_floor: 2.7,
      floor_1: 2.7,
    },
    allWindowsReplaced: "no",
    remainingWindowAreaM2: 4.5,
    allDoorsReplaced: "yes",
    remainingDoorAreaM2: null,
    basementCoverage: "partial",
    partialBasementAreaM2: 48,
    airtightness: "average",
    usualIndoorTemperatureC: 21,
    householdType: "multi",
    incomeBand: "elevated",
  },
});

const client = {
  public_id: 10234,
  full_name: "Jan Kowalski",
  company_name: null,
  email: "jan.kowalski@example.com",
  phone: "+48 500 600 700",
  city: "Warszawa",
  street: "Przykładowa",
  building_number: "12",
  postal_code: "00-001",
};

const preaudit = {
  audit_date: "2026-11-07",
  building_type: "dom_jednorodzinny",
  building_storeys: "ground_plus_1",
  roof_type: "pitched_without_attic",
  has_basement: true,
  has_integrated_garage: true,
  heated_levels: ["ground_floor", "floor_1"],
  heated_area_m2: 145,
  total_building_area_m2: 185,
  household_members: 4,
  current_heat_source: "gas",
  current_source_power_kw: 24,
  current_source_heats_dhw: true,
  current_heating_performance: "maintains_temperature",
  ventilation_type: "natural",
  wall_material: "solid_brick",
  wall_thickness_cm: 38,
  wall_insulation_layers: [
    { material: "white_eps", custom_material: null, thickness_cm: 5 },
  ],
  roof_insulation_layers: [
    { material: "mineral_wool", custom_material: null, thickness_cm: 10 },
  ],
  floor_insulation_layers: [],
  planned_heat_source: "air_to_water_heat_pump",
  planned_source_heats_dhw: true,
  heating_distribution_type: "mixed",
  heating_supply_temperature_c: 45,
  desired_indoor_temperature_c: 21,
  planned_scope: plannedScope,
  planned_wall_insulation_material: "graphite_eps",
  planned_wall_insulation_cm: 18,
  planned_roof_insulation_material: "mineral_wool",
  planned_roof_insulation_cm: 25,
  planned_floor_insulation_material: "xps",
  planned_floor_insulation_cm: 10,
  wall_insulation_surfaces: wallInsulationSurfaces,
  window_type: "older_insulated_glass",
  planned_window_u_value: 0.9,
  windows,
  planned_door_u_value: 1.3,
  external_doors: externalDoors,
  advanced_survey: {
    enabled: true,
    footprint_shape: "compact",
    storey_heights_m: {
      basement: 2.4,
      ground_floor: 2.7,
      floor_1: 2.7,
    },
    all_windows_replaced: "no",
    remaining_window_area_m2: 4.5,
    all_doors_replaced: "yes",
    remaining_door_area_m2: null,
    basement_coverage: "partial",
    partial_basement_area_m2: 48,
    airtightness: "average",
    usual_indoor_temperature_c: 21,
    household_type: "multi",
    income_band: "elevated",
  },
  notes:
    "Wycenić rusztowanie, demontaż i utylizację starego źródła, uruchomienie pompy ciepła oraz płukanie istniejącej instalacji. Elewacja od strony ogrodu ma utrudniony dostęp.",
  calculation,
};

async function main() {
  const outputDirectory = path.join(process.cwd(), "output", "pdf");
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(
    outputDirectory,
    "IdeaTermo-przykladowy-zakres-prac.pdf"
  );
  await writeFile(
    outputPath,
    await createIdeaTermoPreauditPdf(client, preaudit)
  );
  console.log(outputPath);
}

void main();
