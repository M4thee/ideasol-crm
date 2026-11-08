"use client";

import Link from "next/link";
import {
  Suspense,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  calculateIdeaTermoPreaudit,
  estimateClimateZoneFromPostalCode,
  type AdvancedEnergyResult,
  type AdvancedSurveyInput,
} from "@/lib/ideatermo/preaudit";
import BuildingShapePreview from "./BuildingShapePreview";
import {
  BUILDING_STOREY_OPTIONS,
  BUILDING_TYPE_OPTIONS,
  AIRTIGHTNESS_OPTIONS,
  BASEMENT_COVERAGE_OPTIONS,
  CURRENT_HEATING_PERFORMANCE_OPTIONS,
  CURRENT_FUEL_OPTIONS,
  EXTERNAL_DOOR_OPTIONS,
  FUEL_CONSUMPTION_BASIS_OPTIONS,
  HEATING_DISTRIBUTION_OPTIONS,
  HEAT_SOURCE_OPTIONS,
  HOUSEHOLD_MEMBERS_OPTIONS,
  HOUSEHOLD_TYPE_OPTIONS,
  HEATED_LEVEL_LABELS,
  INSULATION_MATERIAL_OPTIONS,
  PLANNED_DOOR_U_VALUE_OPTIONS,
  PLANNED_INSULATION_MATERIAL_OPTIONS,
  PLANNED_SCOPE_OPTIONS,
  PLANNED_HEAT_SOURCE_OPTIONS,
  PLANNED_WINDOW_U_VALUE_OPTIONS,
  PREAUDIT_SCOPE,
  FOOTPRINT_SHAPE_OPTIONS,
  ROOF_TYPE_OPTIONS,
  WALL_MATERIAL_OPTIONS,
  WINDOW_GLAZING_OPTIONS,
  WINDOW_KINDS,
  WOOD_SEASONING_OPTIONS,
  WOOD_TYPE_OPTIONS,
  YES_NO_UNKNOWN_OPTIONS,
  calculateWallSurfaceArea,
  getAvailableHeatedLevels,
  getIncomeBandOptions,
  getOptionLabel,
  isSolidFuelHeatSource,
  normalizeBuildingStoreys,
  normalizeRoofType,
  type BuildingStoreysValue,
  type HeatedLevelValue,
  type RoofTypeValue,
  type SelectOption,
  type WindowKind,
} from "@/lib/ideatermo/preauditFields";

type TermoClient = {
  id: string;
  public_id: number | null;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  contact_phone: string | null;
  city: string | null;
  street: string | null;
  building_number: string | null;
  postal_code: string | null;
  assigned_user_id: string | null;
};

const MIN_CLIENT_SEARCH_LENGTH = 2;
const TERMO_CLIENT_SELECT =
  "id, public_id, full_name, company_name, email, phone, contact_phone, city, street, building_number, postal_code, assigned_user_id";

function canSearchAllIdeaTermoClients(role: string) {
  return role === "admin" || role === "owner";
}

function normalizeClientSearchTerm(value: string) {
  return value.trim().replace(/[%_]/g, "");
}

type DimensionForm = {
  width_cm: string;
  height_cm: string;
};

type WindowGroupForm = {
  kind: string;
  dimensions: DimensionForm[];
};

type DoorForm = DimensionForm & {
  type: string;
};

type WallSurfaceForm = {
  width_m: string;
  height_m: string;
  manual_area_m2: string;
  use_manual_area: boolean;
};

type InsulationLayerForm = {
  material: string;
  custom_material: string;
  thickness_cm: string;
};

const MAX_WALL_INSULATION_LAYERS = 4;
const MAX_ROOF_INSULATION_LAYERS = 3;
const MAX_FLOOR_INSULATION_LAYERS = 3;
const INSULATION_LAYER_OPTIONS: readonly SelectOption[] = [
  ...INSULATION_MATERIAL_OPTIONS,
  { value: "__other__", label: "Inny materiał" },
];

type PreauditWizardStepId =
  | "client"
  | "scope"
  | "insulation"
  | "windows"
  | "doors"
  | "heat_source"
  | "advanced"
  | "summary";

type PreauditWizardStep = {
  id: PreauditWizardStepId;
  label: string;
  description: string;
};

type PreauditForm = {
  audit_date: string;
  building_type: string;
  building_storeys: BuildingStoreysValue;
  roof_type: RoofTypeValue;
  has_basement: boolean;
  has_integrated_garage: boolean;
  heated_levels: HeatedLevelValue[];
  heated_area_m2: string;
  total_building_area_m2: string;
  building_length_m: string;
  building_width_m: string;
  average_storey_height_m: string;
  climate_zone: string;
  ventilation_type: string;
  air_change_rate_per_hour: string;
  household_members: string;
  current_heat_source: string;
  heat_source_other: string;
  current_source_power_kw: string;
  current_fuel_type: string;
  annual_fuel_quantity: string;
  wood_type: string;
  wood_seasoning: string;
  fuel_consumption_basis: string;
  current_heating_performance: string;
  supplemental_heating_used: string;
  current_source_heats_dhw: string;
  planned_heat_source: string;
  planned_source_heats_dhw: string;
  heating_distribution_type: string;
  heating_supply_temperature_c: string;
  desired_indoor_temperature_c: string;
  wall_material: string;
  wall_thickness_cm: string;
  wall_insulation_layers: InsulationLayerForm[];
  roof_insulation_layers: InsulationLayerForm[];
  floor_insulation_layers: InsulationLayerForm[];
  planned_wall_insulation_material: string;
  planned_wall_insulation_cm: string;
  planned_roof_insulation_material: string;
  planned_roof_insulation_cm: string;
  planned_roof_area_m2: string;
  planned_floor_insulation_material: string;
  planned_floor_insulation_cm: string;
  planned_floor_area_m2: string;
  planned_window_u_value: string;
  planned_door_u_value: string;
  wall_insulation_surfaces: WallSurfaceForm[];
  window_type: string;
  windows: WindowGroupForm[];
  external_doors: DoorForm[];
  planned_scope: string[];
  advanced_mode_enabled: boolean;
  advanced_footprint_shape: string;
  advanced_storey_heights_m: Partial<Record<HeatedLevelValue, string>>;
  advanced_all_windows_replaced: string;
  advanced_remaining_window_area_m2: string;
  advanced_all_doors_replaced: string;
  advanced_remaining_door_area_m2: string;
  advanced_basement_coverage: string;
  advanced_partial_basement_area_m2: string;
  advanced_airtightness: string;
  advanced_usual_indoor_temperature_c: string;
  advanced_household_type: string;
  advanced_income_band: string;
  notes: string;
  status: "draft" | "completed";
};

const EMPTY_FORM: PreauditForm = {
  audit_date: new Date().toISOString().slice(0, 10),
  building_type: "dom_jednorodzinny",
  building_storeys: "ground_only",
  roof_type: "pitched_without_attic",
  has_basement: false,
  has_integrated_garage: false,
  heated_levels: ["ground_floor"],
  heated_area_m2: "",
  total_building_area_m2: "",
  building_length_m: "",
  building_width_m: "",
  average_storey_height_m: "2.7",
  climate_zone: "III",
  ventilation_type: "natural",
  air_change_rate_per_hour: "",
  household_members: "",
  current_heat_source: "",
  heat_source_other: "",
  current_source_power_kw: "",
  current_fuel_type: "",
  annual_fuel_quantity: "",
  wood_type: "",
  wood_seasoning: "",
  fuel_consumption_basis: "",
  current_heating_performance: "",
  supplemental_heating_used: "",
  current_source_heats_dhw: "",
  planned_heat_source: "",
  planned_source_heats_dhw: "",
  heating_distribution_type: "",
  heating_supply_temperature_c: "",
  desired_indoor_temperature_c: "21",
  wall_material: "",
  wall_thickness_cm: "",
  wall_insulation_layers: [],
  roof_insulation_layers: [],
  floor_insulation_layers: [],
  planned_wall_insulation_material: "graphite_eps",
  planned_wall_insulation_cm: "15",
  planned_roof_insulation_material: "mineral_wool",
  planned_roof_insulation_cm: "25",
  planned_roof_area_m2: "",
  planned_floor_insulation_material: "xps",
  planned_floor_insulation_cm: "10",
  planned_floor_area_m2: "",
  planned_window_u_value: "0.9",
  planned_door_u_value: "1.3",
  wall_insulation_surfaces: [],
  window_type: "",
  windows: [],
  external_doors: [],
  planned_scope: [],
  advanced_mode_enabled: false,
  advanced_footprint_shape: "compact",
  advanced_storey_heights_m: {
    basement: "2.4",
    ground_floor: "2.7",
    floor_1: "2.7",
    floor_2: "2.7",
    floor_3: "2.7",
    attic: "2.4",
    garage: "2.7",
  },
  advanced_all_windows_replaced: "unknown",
  advanced_remaining_window_area_m2: "",
  advanced_all_doors_replaced: "unknown",
  advanced_remaining_door_area_m2: "",
  advanced_basement_coverage: "unknown",
  advanced_partial_basement_area_m2: "",
  advanced_airtightness: "unknown",
  advanced_usual_indoor_temperature_c: "21",
  advanced_household_type: "",
  advanced_income_band: "",
  notes: "",
  status: "draft",
};

function toNullableNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && value.trim() ? parsed : null;
}

function emptyDimension(): DimensionForm {
  return { width_cm: "", height_cm: "" };
}

function emptyDoor(): DoorForm {
  return { type: "", ...emptyDimension() };
}

function emptyWallSurface(): WallSurfaceForm {
  return {
    width_m: "",
    height_m: "",
    manual_area_m2: "",
    use_manual_area: false,
  };
}

function toDimensionForm(value: unknown): DimensionForm {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    width_cm:
      typeof record.width_cm === "number" || typeof record.width_cm === "string"
        ? String(record.width_cm)
        : "",
    height_cm:
      typeof record.height_cm === "number" || typeof record.height_cm === "string"
        ? String(record.height_cm)
        : "",
  };
}

function toWindowGroups(value: unknown): WindowGroupForm[] {
  if (!Array.isArray(value)) return [];
  const allowedKinds = new Set(WINDOW_KINDS.map((kind) => kind.value));
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.kind !== "string" || !allowedKinds.has(record.kind)) {
      return [];
    }
    const dimensions = Array.isArray(record.dimensions)
      ? record.dimensions.map(toDimensionForm)
      : [];
    return [{ kind: record.kind, dimensions: dimensions.length ? dimensions : [emptyDimension()] }];
  });
}

function toDoorForms(value: unknown, legacyType: unknown): DoorForm[] {
  if (!Array.isArray(value)) return [];
  const allowedTypes = new Set(EXTERNAL_DOOR_OPTIONS.map((option) => option.value));
  const fallbackType =
    typeof legacyType === "string" && allowedTypes.has(legacyType)
      ? legacyType
      : "";

  return value.slice(0, 3).map((entry) => {
    const record =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const dimension = toDimensionForm(entry);
    return {
      type:
        typeof record.type === "string" && allowedTypes.has(record.type)
          ? record.type
          : fallbackType,
      ...dimension,
    };
  });
}

function toWallSurfaces(value: unknown): WallSurfaceForm[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const toInputValue = (field: unknown) =>
      typeof field === "number" || typeof field === "string" ? String(field) : "";
    return [
      {
        width_m: toInputValue(record.width_m),
        height_m: toInputValue(record.height_m),
        manual_area_m2: toInputValue(record.manual_area_m2),
        use_manual_area:
          record.area_mode === "manual" ||
          record.use_manual_area === true ||
          (record.manual_area_m2 !== null && record.manual_area_m2 !== undefined),
      },
    ];
  });
}

function toInsulationLayers(
  value: unknown,
  legacyMaterial: unknown,
  legacyThicknessCm: unknown,
  maxLayers: number
): InsulationLayerForm[] {
  const legacyLayer =
    (typeof legacyMaterial === "string" && legacyMaterial.trim()) ||
    legacyThicknessCm !== null && legacyThicknessCm !== undefined
      ? [
          {
            material:
              typeof legacyMaterial === "string" && legacyMaterial.trim()
                ? legacyMaterial.trim()
                : "unknown",
            thickness_cm: legacyThicknessCm,
          },
        ]
      : [];
  const source = Array.isArray(value) && value.length ? value : legacyLayer;
  const allowedMaterials = new Set(
    INSULATION_LAYER_OPTIONS.map((option) => option.value)
  );

  return source.slice(0, maxLayers).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.material !== "string" || !record.material.trim()) {
      return [];
    }

    const storedMaterial = record.material.trim();
    const isCatalogMaterial = allowedMaterials.has(storedMaterial);
    const material = isCatalogMaterial ? storedMaterial : "__other__";
    const customMaterial =
      material === "__other__"
        ? typeof record.custom_material === "string" &&
          record.custom_material.trim()
          ? record.custom_material.trim()
          : storedMaterial === "__other__"
            ? ""
            : storedMaterial
        : "";
    const thickness = record.thickness_cm;

    return [
      {
        material,
        custom_material: customMaterial,
        thickness_cm:
          typeof thickness === "number" || typeof thickness === "string"
            ? String(thickness)
            : "",
      },
    ];
  });
}

function serializeDimensions(dimensions: DimensionForm[]) {
  return dimensions.map((dimension) => ({
    width_cm: toNullableNumber(dimension.width_cm),
    height_cm: toNullableNumber(dimension.height_cm),
  }));
}

function serializeDoors(doors: DoorForm[]) {
  return doors.map((door) => ({
    type: door.type || null,
    width_cm: toNullableNumber(door.width_cm),
    height_cm: toNullableNumber(door.height_cm),
  }));
}

function getWallSurfaceArea(surface: WallSurfaceForm) {
  return calculateWallSurfaceArea(
    toNullableNumber(surface.width_m),
    toNullableNumber(surface.height_m),
    surface.use_manual_area ? toNullableNumber(surface.manual_area_m2) : null
  );
}

function isPositiveNumber(value: string) {
  const parsed = toNullableNumber(value);
  return parsed !== null && parsed > 0;
}

function hasCompleteDimensions(dimension: DimensionForm) {
  return (
    isPositiveNumber(dimension.width_cm) &&
    isPositiveNumber(dimension.height_cm)
  );
}

function getInsulationValidationMessage(form: PreauditForm) {
  if (form.planned_scope.includes(PREAUDIT_SCOPE.wallInsulation)) {
    if (!form.planned_wall_insulation_material) {
      return "Wybierz planowany materiał izolacji ścian.";
    }
    if (!isPositiveNumber(form.planned_wall_insulation_cm)) {
      return "Podaj grubość izolacji ścian większą od 0 cm.";
    }
    if (!form.wall_insulation_surfaces.length) {
      return "Dodaj co najmniej jedną ścianę do docieplenia.";
    }
    if (
      form.wall_insulation_surfaces.some((surface) => {
        const area = getWallSurfaceArea(surface);
        return area === null || area <= 0;
      })
    ) {
      return "Uzupełnij wymiary lub powierzchnię każdej ściany.";
    }
  }

  if (form.planned_scope.includes(PREAUDIT_SCOPE.roofInsulation)) {
    if (!form.planned_roof_insulation_material) {
      return "Wybierz planowany materiał izolacji dachu lub stropu.";
    }
    if (!isPositiveNumber(form.planned_roof_insulation_cm)) {
      return "Podaj grubość izolacji dachu lub stropu większą od 0 cm.";
    }
    if (!isPositiveNumber(form.planned_roof_area_m2)) {
      return "Podaj powierzchnię dachu lub stropu do docieplenia.";
    }
  }

  if (form.planned_scope.includes(PREAUDIT_SCOPE.floorInsulation)) {
    if (!form.planned_floor_insulation_material) {
      return "Wybierz planowany materiał izolacji podłogi lub stropu nad piwnicą.";
    }
    if (!isPositiveNumber(form.planned_floor_insulation_cm)) {
      return "Podaj grubość izolacji podłogi lub stropu nad piwnicą większą od 0 cm.";
    }
    if (!isPositiveNumber(form.planned_floor_area_m2)) {
      return "Podaj powierzchnię podłogi lub stropu nad piwnicą do docieplenia.";
    }
  }

  return null;
}

function getWindowsValidationMessage(form: PreauditForm) {
  if (!form.window_type) return "Wybierz stan obecnych okien.";
  if (!isPositiveNumber(form.planned_window_u_value)) {
    return "Wybierz docelowy współczynnik nowych okien.";
  }
  if (!form.windows.length) {
    return "Wybierz co najmniej jeden rodzaj okna przeznaczonego do wymiany.";
  }
  if (
    form.windows.some(
      (group) =>
        !group.dimensions.length ||
        group.dimensions.some((dimension) => !hasCompleteDimensions(dimension))
    )
  ) {
    return "Uzupełnij szerokość i wysokość każdego okna.";
  }
  return null;
}

function getDoorsValidationMessage(form: PreauditForm) {
  if (!isPositiveNumber(form.planned_door_u_value)) {
    return "Wybierz docelowy współczynnik nowych drzwi.";
  }
  if (!form.external_doors.length) {
    return "Dodaj co najmniej jedne drzwi przeznaczone do wymiany.";
  }
  if (
    form.external_doors.some(
      (door) => !door.type || !hasCompleteDimensions(door)
    )
  ) {
    return "Wybierz rodzaj oraz uzupełnij szerokość i wysokość każdych drzwi.";
  }
  return null;
}

function formatArea(value: number | null) {
  return value === null
    ? ""
    : value.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
}

function serializeWallSurfaces(surfaces: WallSurfaceForm[]) {
  return surfaces.map((surface) => ({
    area_mode: surface.use_manual_area ? "manual" : "dimensions",
    width_m: surface.use_manual_area ? null : toNullableNumber(surface.width_m),
    height_m: surface.use_manual_area ? null : toNullableNumber(surface.height_m),
    manual_area_m2: surface.use_manual_area
      ? toNullableNumber(surface.manual_area_m2)
      : null,
    area_m2: getWallSurfaceArea(surface),
  }));
}

function serializeInsulationLayers(
  layers: InsulationLayerForm[],
  maxLayers: number
) {
  return layers.slice(0, maxLayers).map((layer) => ({
    material: layer.material,
    custom_material:
      layer.material === "__other__"
        ? layer.custom_material.trim() || null
        : null,
    thickness_cm: toNullableNumber(layer.thickness_cm),
  }));
}

function toCalculationInsulationLayers(layers: InsulationLayerForm[]) {
  return layers.map((layer) => ({
    material:
      layer.material === "__other__"
        ? layer.custom_material.trim() || "unknown"
        : layer.material,
    thicknessCm: toNullableNumber(layer.thickness_cm),
  }));
}

function normalizeBuildingType(value: unknown) {
  return value === "lokal" ||
    value === "dom_wielorodzinny" ||
    value === "lokal_mieszkalny_w_budynku_wielorodzinnym"
    ? "lokal_mieszkalny_w_budynku_wielorodzinnym"
    : "dom_jednorodzinny";
}

function normalizeHeatedLevels(
  value: unknown,
  input: {
    buildingStoreys: BuildingStoreysValue;
    roofType: RoofTypeValue;
    hasBasement: boolean;
    hasIntegratedGarage: boolean;
  }
) {
  const allowedLevels = new Set(
    getAvailableHeatedLevels(input).map((level) => level.value)
  );
  if (!Array.isArray(value)) return ["ground_floor"] as HeatedLevelValue[];

  return value.filter(
    (level): level is HeatedLevelValue =>
      typeof level === "string" && allowedLevels.has(level as HeatedLevelValue)
  );
}

function PreauditContent() {
  const searchParams = useSearchParams();
  const clientIdFromUrl = searchParams.get("clientId") || "";
  const [selectedClientId, setSelectedClientId] = useState(clientIdFromUrl);
  const [selectedClient, setSelectedClient] = useState<TermoClient | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<TermoClient[]>([]);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [clientSearchError, setClientSearchError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState("seller");
  const [preauditCreatedBy, setPreauditCreatedBy] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [form, setForm] = useState<PreauditForm>(EMPTY_FORM);
  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [message, setMessage] = useState("");
  const [wizardStep, setWizardStep] =
    useState<PreauditWizardStepId>("client");

  const calculation = useMemo(
    () =>
      calculateIdeaTermoPreaudit({
        buildingType: form.building_type,
        heatedAreaM2: toNullableNumber(form.heated_area_m2),
        buildingStoreys: form.building_storeys,
        roofType: form.roof_type,
        hasBasement: form.has_basement,
        hasIntegratedGarage: form.has_integrated_garage,
        heatedLevels: form.heated_levels,
        buildingLengthM: null,
        buildingWidthM: null,
        averageStoreyHeightM: 2.7,
        climateZone: form.climate_zone,
        ventilationType: form.ventilation_type,
        airChangeRatePerHour: null,
        wallMaterial: form.wall_material,
        wallThicknessCm: toNullableNumber(form.wall_thickness_cm),
        wallInsulationLayers: toCalculationInsulationLayers(
          form.wall_insulation_layers
        ),
        roofInsulationLayers: toCalculationInsulationLayers(
          form.roof_insulation_layers
        ),
        floorInsulationLayers: toCalculationInsulationLayers(
          form.floor_insulation_layers
        ),
        windowType: form.window_type,
        windows: form.windows.map((group) => ({
          kind: group.kind,
          dimensions: group.dimensions.map((dimension) => ({
            widthCm: toNullableNumber(dimension.width_cm),
            heightCm: toNullableNumber(dimension.height_cm),
          })),
        })),
        externalDoors: form.external_doors.map((door) => ({
          type: door.type,
          widthCm: toNullableNumber(door.width_cm),
          heightCm: toNullableNumber(door.height_cm),
        })),
        plannedScope: form.planned_scope,
        wallInsulationSurfaces: form.wall_insulation_surfaces.map(
          (surface) => ({ areaM2: getWallSurfaceArea(surface) })
        ),
        plannedWallInsulationMaterial:
          form.planned_wall_insulation_material,
        plannedWallInsulationCm: toNullableNumber(
          form.planned_wall_insulation_cm
        ),
        plannedRoofInsulationMaterial:
          form.planned_roof_insulation_material,
        plannedRoofInsulationCm: toNullableNumber(
          form.planned_roof_insulation_cm
        ),
        plannedRoofAreaM2: toNullableNumber(form.planned_roof_area_m2),
        plannedFloorInsulationMaterial:
          form.planned_floor_insulation_material,
        plannedFloorInsulationCm: toNullableNumber(
          form.planned_floor_insulation_cm
        ),
        plannedFloorAreaM2: toNullableNumber(form.planned_floor_area_m2),
        plannedWindowUValue: toNullableNumber(form.planned_window_u_value),
        plannedDoorUValue: toNullableNumber(form.planned_door_u_value),
        currentHeatSource: form.current_heat_source,
        currentSourcePowerKw: toNullableNumber(
          form.current_source_power_kw
        ),
        currentFuelType: form.current_fuel_type,
        annualFuelQuantity: toNullableNumber(form.annual_fuel_quantity),
        woodType: form.wood_type,
        woodSeasoning: form.wood_seasoning,
        fuelConsumptionBasis: form.fuel_consumption_basis,
        currentHeatingPerformance: form.current_heating_performance,
        supplementalHeatingUsed:
          form.supplemental_heating_used === "yes"
            ? true
            : form.supplemental_heating_used === "no"
              ? false
              : null,
        currentSourceHeatsDhw:
          form.current_source_heats_dhw === "yes"
            ? true
            : form.current_source_heats_dhw === "no"
              ? false
              : null,
        householdMembers: toNullableNumber(form.household_members),
        plannedHeatSource: form.planned_heat_source,
        plannedSourceHeatsDhw:
          form.planned_source_heats_dhw === "yes"
            ? true
            : form.planned_source_heats_dhw === "no"
              ? false
              : null,
        heatingDistributionType: form.heating_distribution_type,
        heatingSupplyTemperatureC: toNullableNumber(
          form.heating_supply_temperature_c
        ),
        desiredIndoorTemperatureC: toNullableNumber(
          form.desired_indoor_temperature_c
        ),
        advancedSurvey: {
          enabled: form.advanced_mode_enabled,
          totalBuildingAreaM2: toNullableNumber(
            form.total_building_area_m2
          ),
          footprintShape:
            form.advanced_footprint_shape as AdvancedSurveyInput["footprintShape"],
          storeyHeightsM: Object.fromEntries(
            Object.entries(form.advanced_storey_heights_m).map(
              ([level, height]) => [level, toNullableNumber(height || "")]
            )
          ),
          allWindowsReplaced:
            form.advanced_all_windows_replaced as AdvancedSurveyInput["allWindowsReplaced"],
          remainingWindowAreaM2: toNullableNumber(
            form.advanced_remaining_window_area_m2
          ),
          allDoorsReplaced:
            form.advanced_all_doors_replaced as AdvancedSurveyInput["allDoorsReplaced"],
          remainingDoorAreaM2: toNullableNumber(
            form.advanced_remaining_door_area_m2
          ),
          basementCoverage:
            form.advanced_basement_coverage as AdvancedSurveyInput["basementCoverage"],
          partialBasementAreaM2: toNullableNumber(
            form.advanced_partial_basement_area_m2
          ),
          airtightness:
            form.advanced_airtightness as AdvancedSurveyInput["airtightness"],
          usualIndoorTemperatureC: toNullableNumber(
            form.advanced_usual_indoor_temperature_c
          ),
          householdType:
            form.advanced_household_type as AdvancedSurveyInput["householdType"],
          incomeBand:
            form.advanced_income_band as AdvancedSurveyInput["incomeBand"],
        },
      }),
    [form]
  );

  async function loadPreaudit(clientId: string, client?: TermoClient | null) {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase
      .from("ideatermo_preaudits")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      setMessage(`Nie udało się pobrać karty zakresu: ${error.message}`);
      setPreauditCreatedBy(null);
      setForm({ ...EMPTY_FORM });
      setLoading(false);
      return;
    }

    if (!data) {
      setPreauditCreatedBy(null);
      setForm({
        ...EMPTY_FORM,
        audit_date: new Date().toISOString().slice(0, 10),
        climate_zone: estimateClimateZoneFromPostalCode(client?.postal_code),
      });
      setLoading(false);
      return;
    }

    const buildingStoreys = normalizeBuildingStoreys(data.building_storeys);
    const roofType = normalizeRoofType(data.roof_type);
    const hasBasement = data.has_basement === true;
    const hasIntegratedGarage = data.has_integrated_garage === true;
    const storedCalculation =
      data.calculation && typeof data.calculation === "object"
        ? (data.calculation as Record<string, unknown>)
        : {};
    const storedWorkScope =
      storedCalculation.workScope &&
      typeof storedCalculation.workScope === "object"
        ? (storedCalculation.workScope as Record<string, unknown>)
        : {};
    const storedAdvanced =
      data.advanced_survey && typeof data.advanced_survey === "object"
        ? (data.advanced_survey as Record<string, unknown>)
        : {};
    const storedAdvancedHeights =
      storedAdvanced.storey_heights_m &&
      typeof storedAdvanced.storey_heights_m === "object"
        ? (storedAdvanced.storey_heights_m as Record<string, unknown>)
        : {};
    const advancedString = (key: string, fallback = "") =>
      typeof storedAdvanced[key] === "string"
        ? String(storedAdvanced[key])
        : fallback;

    setForm({
      audit_date: data.audit_date || EMPTY_FORM.audit_date,
      building_type: normalizeBuildingType(data.building_type),
      building_storeys: buildingStoreys,
      roof_type: roofType,
      has_basement: hasBasement,
      has_integrated_garage: hasIntegratedGarage,
      heated_levels: normalizeHeatedLevels(data.heated_levels, {
        buildingStoreys,
        roofType,
        hasBasement,
        hasIntegratedGarage,
      }),
      heated_area_m2: data.heated_area_m2?.toString() || "",
      total_building_area_m2:
        data.total_building_area_m2?.toString() || "",
      building_length_m: "",
      building_width_m: "",
      average_storey_height_m: "2.7",
      climate_zone: estimateClimateZoneFromPostalCode(client?.postal_code),
      ventilation_type:
        data.ventilation_type === "balanced_with_heat_recovery"
          ? "balanced_with_heat_recovery"
          : "natural",
      air_change_rate_per_hour: "",
      household_members: data.household_members?.toString() || "",
      current_heat_source: data.current_heat_source || "",
      heat_source_other: data.heat_source_other || "",
      current_source_power_kw: data.current_source_power_kw?.toString() || "",
      current_fuel_type: data.current_fuel_type || "",
      annual_fuel_quantity: data.annual_fuel_quantity?.toString() || "",
      wood_type: data.wood_type || "",
      wood_seasoning: data.wood_seasoning || "",
      fuel_consumption_basis: data.fuel_consumption_basis || "",
      current_heating_performance: data.current_heating_performance || "",
      supplemental_heating_used:
        data.supplemental_heating_used === true
          ? "yes"
          : data.supplemental_heating_used === false
            ? "no"
            : "",
      current_source_heats_dhw:
        data.current_source_heats_dhw === true
          ? "yes"
          : data.current_source_heats_dhw === false
            ? "no"
            : "",
      planned_heat_source: data.planned_heat_source || "",
      planned_source_heats_dhw:
        data.planned_source_heats_dhw === true
          ? "yes"
          : data.planned_source_heats_dhw === false
            ? "no"
            : "",
      heating_distribution_type: data.heating_distribution_type || "",
      heating_supply_temperature_c:
        data.heating_supply_temperature_c?.toString() || "",
      desired_indoor_temperature_c:
        data.desired_indoor_temperature_c?.toString() || "21",
      wall_material: data.wall_material || "",
      wall_thickness_cm: data.wall_thickness_cm?.toString() || "",
      wall_insulation_layers: toInsulationLayers(
        data.wall_insulation_layers,
        data.wall_insulation_material,
        data.wall_insulation_cm,
        MAX_WALL_INSULATION_LAYERS
      ),
      roof_insulation_layers: toInsulationLayers(
        data.roof_insulation_layers,
        data.roof_insulation_material,
        data.roof_insulation_cm,
        MAX_ROOF_INSULATION_LAYERS
      ),
      floor_insulation_layers: toInsulationLayers(
        data.floor_insulation_layers,
        null,
        data.floor_insulation_cm,
        MAX_FLOOR_INSULATION_LAYERS
      ),
      planned_wall_insulation_material:
        data.planned_wall_insulation_material || "graphite_eps",
      planned_wall_insulation_cm:
        data.planned_wall_insulation_cm?.toString() || "15",
      planned_roof_insulation_material:
        data.planned_roof_insulation_material || "mineral_wool",
      planned_roof_insulation_cm:
        data.planned_roof_insulation_cm?.toString() || "25",
      planned_roof_area_m2:
        typeof storedWorkScope.roofAreaM2 === "number"
          ? storedWorkScope.roofAreaM2.toString()
          : "",
      planned_floor_insulation_material:
        data.planned_floor_insulation_material || "xps",
      planned_floor_insulation_cm:
        data.planned_floor_insulation_cm?.toString() || "10",
      planned_floor_area_m2:
        typeof storedWorkScope.floorAreaM2 === "number"
          ? storedWorkScope.floorAreaM2.toString()
          : "",
      planned_window_u_value:
        data.planned_window_u_value?.toString() || "0.9",
      planned_door_u_value:
        data.planned_door_u_value?.toString() || "1.3",
      wall_insulation_surfaces: toWallSurfaces(data.wall_insulation_surfaces),
      window_type: data.window_type || "",
      windows: toWindowGroups(data.windows),
      external_doors: toDoorForms(
        data.external_doors,
        data.external_door_type
      ),
      planned_scope: Array.isArray(data.planned_scope)
        ? data.planned_scope.filter((scope: unknown) =>
            typeof scope === "string" &&
            PLANNED_SCOPE_OPTIONS.some((option) => option === scope)
          )
        : [],
      advanced_mode_enabled: storedAdvanced.enabled === true,
      advanced_footprint_shape: advancedString("footprint_shape", "compact"),
      advanced_storey_heights_m: Object.fromEntries(
        Object.entries(EMPTY_FORM.advanced_storey_heights_m).map(
          ([level, fallback]) => [
            level,
            typeof storedAdvancedHeights[level] === "number" ||
            typeof storedAdvancedHeights[level] === "string"
              ? String(storedAdvancedHeights[level])
              : fallback,
          ]
        )
      ),
      advanced_all_windows_replaced: advancedString(
        "all_windows_replaced",
        "unknown"
      ),
      advanced_remaining_window_area_m2:
        typeof storedAdvanced.remaining_window_area_m2 === "number"
          ? String(storedAdvanced.remaining_window_area_m2)
          : "",
      advanced_all_doors_replaced: advancedString(
        "all_doors_replaced",
        "unknown"
      ),
      advanced_remaining_door_area_m2:
        typeof storedAdvanced.remaining_door_area_m2 === "number"
          ? String(storedAdvanced.remaining_door_area_m2)
          : "",
      advanced_basement_coverage: advancedString(
        "basement_coverage",
        "unknown"
      ),
      advanced_partial_basement_area_m2:
        typeof storedAdvanced.partial_basement_area_m2 === "number"
          ? String(storedAdvanced.partial_basement_area_m2)
          : "",
      advanced_airtightness: advancedString("airtightness", "unknown"),
      advanced_usual_indoor_temperature_c:
        typeof storedAdvanced.usual_indoor_temperature_c === "number"
          ? String(storedAdvanced.usual_indoor_temperature_c)
          : "21",
      advanced_household_type: advancedString("household_type"),
      advanced_income_band: advancedString("income_band"),
      notes: data.notes || "",
      status: data.status === "completed" ? "completed" : "draft",
    });
    setPreauditCreatedBy(data.created_by || null);
    setLoading(false);
  }

  async function initialize() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);
    const [permissionResult, profileResult] = await Promise.all([
      supabase
        .from("user_permissions")
        .select("ideatermo")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const permission = permissionResult.data;
    const permissionError = permissionResult.error;
    const role = String(profileResult.data?.role || "seller").toLowerCase();
    setCurrentUserRole(role);

    if (permissionError || permission?.ideatermo !== true) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    setHasAccess(true);

    if (clientIdFromUrl) {
      let requestedClientQuery = supabase
        .from("clients")
        .select(TERMO_CLIENT_SELECT)
        .eq("business_area", "ideatermo")
        .eq("id", clientIdFromUrl);

      if (!canSearchAllIdeaTermoClients(role)) {
        requestedClientQuery = requestedClientQuery.eq("assigned_user_id", user.id);
      }

      const { data: requestedClient, error: requestedClientError } =
        await requestedClientQuery.maybeSingle();

      if (requestedClientError) {
        setMessage(
          `Nie udało się pobrać klienta IdeaTermo: ${requestedClientError.message}`
        );
      } else if (requestedClient) {
        setSelectedClient(requestedClient as TermoClient);
        setSelectedClientId(requestedClient.id);
        await loadPreaudit(requestedClient.id, requestedClient as TermoClient);
      } else {
        setSelectedClientId("");
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    // Async initialization synchronizes this client view with Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialize();
    // Initial load is intentionally tied to mounting and the URL snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const searchTerm = normalizeClientSearchTerm(clientSearch);
    if (
      !isClientDropdownOpen ||
      hasAccess !== true ||
      !currentUserId ||
      searchTerm.length < MIN_CLIENT_SEARCH_LENGTH
    ) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchingClients(true);
      setClientSearchError("");

      let clientsQuery = supabase
        .from("clients")
        .select(TERMO_CLIENT_SELECT)
        .eq("business_area", "ideatermo")
        .ilike("full_name", `%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(12);

      if (!canSearchAllIdeaTermoClients(currentUserRole)) {
        clientsQuery = clientsQuery.eq("assigned_user_id", currentUserId);
      }

      const { data, error } = await clientsQuery;
      if (cancelled) return;

      setClientSuggestions((data || []) as TermoClient[]);
      setClientSearchError(
        error ? `Nie udało się wyszukać klientów: ${error.message}` : ""
      );
      setIsSearchingClients(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clientSearch, currentUserId, currentUserRole, hasAccess, isClientDropdownOpen]);

  function selectClient(client: TermoClient) {
    setSelectedClient(client);
    setSelectedClientId(client.id);
    setClientSearch("");
    setClientSuggestions([]);
    setClientSearchError("");
    setIsClientDropdownOpen(false);
    void loadPreaudit(client.id, client);
  }

  function updateField<K extends keyof PreauditForm>(key: K, value: PreauditForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateBuildingShape(
    patch: Partial<
      Pick<
        PreauditForm,
        | "building_storeys"
        | "roof_type"
        | "has_basement"
        | "has_integrated_garage"
      >
    >
  ) {
    setForm((current) => {
      const next = { ...current, ...patch };
      const allowedLevels = new Set(
        getAvailableHeatedLevels({
          buildingStoreys: next.building_storeys,
          roofType: next.roof_type,
          hasBasement: next.has_basement,
          hasIntegratedGarage: next.has_integrated_garage,
        }).map((level) => level.value)
      );

      return {
        ...next,
        heated_levels: current.heated_levels.filter((level) =>
          allowedLevels.has(level)
        ),
      };
    });
  }

  function toggleHeatedLevel(level: HeatedLevelValue) {
    setForm((current) => {
      const availableLevels = new Set(
        getAvailableHeatedLevels({
          buildingStoreys: current.building_storeys,
          roofType: current.roof_type,
          hasBasement: current.has_basement,
          hasIntegratedGarage: current.has_integrated_garage,
        }).map((option) => option.value)
      );
      if (!availableLevels.has(level)) return current;

      return {
        ...current,
        heated_levels: current.heated_levels.includes(level)
          ? current.heated_levels.filter((item) => item !== level)
          : [...current.heated_levels, level],
      };
    });
  }

  function updateHeatSource(value: string) {
    setForm((current) => ({
      ...current,
      current_heat_source: value,
      heat_source_other: value === "other" ? current.heat_source_other : "",
      ...(!isSolidFuelHeatSource(value)
        ? {
            current_fuel_type: "",
            annual_fuel_quantity: "",
            wood_type: "",
            wood_seasoning: "",
            fuel_consumption_basis: "",
            supplemental_heating_used: "",
          }
        : {}),
    }));
  }

  function updateCurrentFuelType(value: string) {
    setForm((current) => ({
      ...current,
      current_fuel_type: value,
      annual_fuel_quantity:
        current.current_fuel_type === value ? current.annual_fuel_quantity : "",
      wood_type: value === "firewood" ? current.wood_type : "",
      wood_seasoning: value === "firewood" ? current.wood_seasoning : "",
    }));
  }

  function toggleScope(scope: string) {
    setForm((current) => {
      const isSelected = current.planned_scope.includes(scope);
      return {
        ...current,
        planned_scope: isSelected
          ? current.planned_scope.filter((item) => item !== scope)
          : [...current.planned_scope, scope],
        ...(isSelected && scope === PREAUDIT_SCOPE.windowReplacement
          ? { windows: [] }
          : {}),
        ...(isSelected && scope === PREAUDIT_SCOPE.doorReplacement
          ? { external_doors: [] }
          : {}),
        ...(isSelected && scope === PREAUDIT_SCOPE.wallInsulation
          ? { wall_insulation_surfaces: [] }
          : {}),
      };
    });
  }

  function resizeDimensions(
    dimensions: DimensionForm[],
    requestedCount: number,
    minimum: number
  ) {
    const count = Math.max(minimum, Math.min(50, requestedCount || 0));
    if (count <= dimensions.length) return dimensions.slice(0, count);
    return [
      ...dimensions,
      ...Array.from({ length: count - dimensions.length }, emptyDimension),
    ];
  }

  function toggleWindowKind(kind: string) {
    setForm((current) => ({
      ...current,
      windows: current.windows.some((group) => group.kind === kind)
        ? current.windows.filter((group) => group.kind !== kind)
        : [...current.windows, { kind, dimensions: [emptyDimension()] }],
    }));
  }

  function updateWindowQuantity(kind: string, quantity: number) {
    setForm((current) => ({
      ...current,
      windows: current.windows.map((group) =>
        group.kind === kind
          ? {
              ...group,
              dimensions: resizeDimensions(group.dimensions, quantity, 1),
            }
          : group
      ),
    }));
  }

  function updateWindowDimension(
    kind: string,
    index: number,
    key: keyof DimensionForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      windows: current.windows.map((group) =>
        group.kind === kind
          ? {
              ...group,
              dimensions: group.dimensions.map((dimension, dimensionIndex) =>
                dimensionIndex === index
                  ? { ...dimension, [key]: value }
                  : dimension
              ),
            }
          : group
      ),
    }));
  }

  function updateDoorQuantity(quantity: number) {
    const count = Math.max(0, Math.min(3, quantity || 0));
    setForm((current) => ({
      ...current,
      external_doors:
        count <= current.external_doors.length
          ? current.external_doors.slice(0, count)
          : [
              ...current.external_doors,
              ...Array.from(
                { length: count - current.external_doors.length },
                emptyDoor
              ),
            ],
    }));
  }

  function updateDoor(
    index: number,
    key: keyof DoorForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      external_doors: current.external_doors.map((door, doorIndex) =>
        doorIndex === index ? { ...door, [key]: value } : door
      ),
    }));
  }

  function updateWallQuantity(quantity: number) {
    const count = Math.max(0, Math.min(50, quantity || 0));
    setForm((current) => ({
      ...current,
      wall_insulation_surfaces:
        count <= current.wall_insulation_surfaces.length
          ? current.wall_insulation_surfaces.slice(0, count)
          : [
              ...current.wall_insulation_surfaces,
              ...Array.from(
                { length: count - current.wall_insulation_surfaces.length },
                emptyWallSurface
              ),
            ],
    }));
  }

  function updateWallSurface<K extends keyof WallSurfaceForm>(
    index: number,
    key: K,
    value: WallSurfaceForm[K]
  ) {
    setForm((current) => ({
      ...current,
      wall_insulation_surfaces: current.wall_insulation_surfaces.map(
        (surface, surfaceIndex) =>
          surfaceIndex === index ? { ...surface, [key]: value } : surface
      ),
    }));
  }

  async function savePreaudit(status: "draft" | "completed") {
    if (!selectedClientId || !currentUserId) {
      setMessage("Wybierz klienta IdeaTermo.");
      return;
    }

    setSaving(true);
    setMessage("");
    const now = new Date().toISOString();
    const primaryWallInsulationLayer = form.wall_insulation_layers[0];
    const primaryRoofInsulationLayer = form.roof_insulation_layers[0];
    const primaryFloorInsulationLayer = form.floor_insulation_layers[0];
    const payload = {
      client_id: selectedClientId,
      created_by: preauditCreatedBy || currentUserId,
      updated_by: currentUserId,
      status,
      audit_date: form.audit_date,
      building_type: form.building_type || null,
      building_storeys: form.building_storeys,
      roof_type: form.roof_type,
      has_basement: form.has_basement,
      has_integrated_garage: form.has_integrated_garage,
      heated_levels: form.heated_levels,
      building_length_m: null,
      building_width_m: null,
      average_storey_height_m: 2.7,
      climate_zone: form.climate_zone,
      ventilation_type: form.ventilation_type,
      air_change_rate_per_hour: null,
      building_year: null,
      heated_area_m2: toNullableNumber(form.heated_area_m2),
      total_building_area_m2: toNullableNumber(form.total_building_area_m2),
      household_members: toNullableNumber(form.household_members),
      current_heat_source: form.current_heat_source || null,
      heat_source_other:
        form.current_heat_source === "other"
          ? form.heat_source_other.trim() || null
          : null,
      current_source_power_kw: toNullableNumber(
        form.current_source_power_kw
      ),
      current_fuel_type: form.current_fuel_type || null,
      annual_fuel_quantity: toNullableNumber(form.annual_fuel_quantity),
      annual_fuel_unit: form.current_fuel_type
        ? form.current_fuel_type === "firewood"
          ? "m3"
          : "t"
        : null,
      wood_type:
        form.current_fuel_type === "firewood" ? form.wood_type || null : null,
      wood_seasoning:
        form.current_fuel_type === "firewood"
          ? form.wood_seasoning || null
          : null,
      fuel_consumption_basis: form.current_fuel_type
        ? form.fuel_consumption_basis || null
        : null,
      current_heating_performance:
        form.current_heating_performance || null,
      supplemental_heating_used:
        form.supplemental_heating_used === "yes"
          ? true
          : form.supplemental_heating_used === "no"
            ? false
            : null,
      current_source_heats_dhw:
        form.current_source_heats_dhw === "yes"
          ? true
          : form.current_source_heats_dhw === "no"
            ? false
            : null,
      planned_heat_source: form.planned_heat_source || null,
      planned_source_heats_dhw:
        form.planned_source_heats_dhw === "yes"
          ? true
          : form.planned_source_heats_dhw === "no"
            ? false
            : null,
      heating_distribution_type: form.heating_distribution_type || null,
      heating_supply_temperature_c: toNullableNumber(
        form.heating_supply_temperature_c
      ),
      desired_indoor_temperature_c: toNullableNumber(
        form.desired_indoor_temperature_c
      ),
      annual_fuel_consumption: null,
      annual_heating_cost: null,
      wall_material:
        form.wall_material === "__other__"
          ? null
          : form.wall_material.trim() || null,
      wall_thickness_cm: toNullableNumber(form.wall_thickness_cm),
      wall_insulation_material: primaryWallInsulationLayer
        ? primaryWallInsulationLayer.material === "__other__"
          ? primaryWallInsulationLayer.custom_material.trim() || null
          : primaryWallInsulationLayer.material
        : null,
      wall_insulation_cm: primaryWallInsulationLayer
        ? toNullableNumber(primaryWallInsulationLayer.thickness_cm)
        : null,
      wall_insulation_layers: serializeInsulationLayers(
        form.wall_insulation_layers,
        MAX_WALL_INSULATION_LAYERS
      ),
      roof_insulation_material: primaryRoofInsulationLayer
        ? primaryRoofInsulationLayer.material === "__other__"
          ? primaryRoofInsulationLayer.custom_material.trim() || null
          : primaryRoofInsulationLayer.material
        : null,
      roof_insulation_cm: primaryRoofInsulationLayer
        ? toNullableNumber(primaryRoofInsulationLayer.thickness_cm)
        : null,
      roof_insulation_layers: serializeInsulationLayers(
        form.roof_insulation_layers,
        MAX_ROOF_INSULATION_LAYERS
      ),
      wall_insulation_surfaces: form.planned_scope.includes(
        PREAUDIT_SCOPE.wallInsulation
      )
        ? serializeWallSurfaces(form.wall_insulation_surfaces)
        : [],
      floor_insulation_cm: primaryFloorInsulationLayer
        ? toNullableNumber(primaryFloorInsulationLayer.thickness_cm)
        : null,
      floor_insulation_layers: serializeInsulationLayers(
        form.floor_insulation_layers,
        MAX_FLOOR_INSULATION_LAYERS
      ),
      planned_wall_insulation_material: form.planned_scope.includes(
        PREAUDIT_SCOPE.wallInsulation
      )
        ? form.planned_wall_insulation_material || null
        : null,
      planned_wall_insulation_cm: form.planned_scope.includes(
        PREAUDIT_SCOPE.wallInsulation
      )
        ? toNullableNumber(form.planned_wall_insulation_cm)
        : null,
      planned_roof_insulation_material: form.planned_scope.includes(
        PREAUDIT_SCOPE.roofInsulation
      )
        ? form.planned_roof_insulation_material || null
        : null,
      planned_roof_insulation_cm: form.planned_scope.includes(
        PREAUDIT_SCOPE.roofInsulation
      )
        ? toNullableNumber(form.planned_roof_insulation_cm)
        : null,
      planned_floor_insulation_material: form.planned_scope.includes(
        PREAUDIT_SCOPE.floorInsulation
      )
        ? form.planned_floor_insulation_material || null
        : null,
      planned_floor_insulation_cm: form.planned_scope.includes(
        PREAUDIT_SCOPE.floorInsulation
      )
        ? toNullableNumber(form.planned_floor_insulation_cm)
        : null,
      planned_window_u_value: form.planned_scope.includes(
        PREAUDIT_SCOPE.windowReplacement
      )
        ? toNullableNumber(form.planned_window_u_value)
        : null,
      planned_door_u_value: form.planned_scope.includes(
        PREAUDIT_SCOPE.doorReplacement
      )
        ? toNullableNumber(form.planned_door_u_value)
        : null,
      window_type: form.window_type || null,
      windows: form.planned_scope.includes(PREAUDIT_SCOPE.windowReplacement)
        ? form.windows.map((group) => ({
            kind: group.kind,
            dimensions: serializeDimensions(group.dimensions),
          }))
        : [],
      external_door_type: form.planned_scope.includes(
        PREAUDIT_SCOPE.doorReplacement
      )
        ? form.external_doors[0]?.type || null
        : null,
      external_doors: form.planned_scope.includes(PREAUDIT_SCOPE.doorReplacement)
        ? serializeDoors(form.external_doors)
        : [],
      planned_scope: form.planned_scope,
      recommended_scope: [],
      advanced_survey: {
        enabled: form.advanced_mode_enabled,
        footprint_shape: form.advanced_footprint_shape || "unknown",
        storey_heights_m: Object.fromEntries(
          Object.entries(form.advanced_storey_heights_m).map(
            ([level, height]) => [level, toNullableNumber(height || "")]
          )
        ),
        all_windows_replaced: form.advanced_all_windows_replaced || "unknown",
        remaining_window_area_m2: toNullableNumber(
          form.advanced_remaining_window_area_m2
        ),
        all_doors_replaced: form.advanced_all_doors_replaced || "unknown",
        remaining_door_area_m2: toNullableNumber(
          form.advanced_remaining_door_area_m2
        ),
        basement_coverage: form.advanced_basement_coverage || "unknown",
        partial_basement_area_m2: toNullableNumber(
          form.advanced_partial_basement_area_m2
        ),
        airtightness: form.advanced_airtightness || "unknown",
        usual_indoor_temperature_c: toNullableNumber(
          form.advanced_usual_indoor_temperature_c
        ),
        household_type: form.advanced_household_type || null,
        income_band: form.advanced_income_band || null,
      },
      notes: form.notes || null,
      calculation,
      updated_at: now,
    };

    const { error } = await supabase
      .from("ideatermo_preaudits")
      .upsert(payload, { onConflict: "client_id" });

    if (error) {
      setMessage(`Nie udało się zapisać karty zakresu: ${error.message}`);
    } else {
      updateField("status", status);
      setMessage(status === "completed" ? "Zakres prac zatwierdzony i zapisany." : "Zapisano wersję roboczą.");
    }
    setSaving(false);
  }

  async function downloadPdf() {
    if (!selectedClientId) return;
    await savePreaudit(form.status);
    setGeneratingPdf(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch(
      `/api/ideatermo/preaudits/${encodeURIComponent(selectedClientId)}/pdf`,
      { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } }
    );

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setMessage(result?.error || "Nie udało się wygenerować PDF.");
      setGeneratingPdf(false);
      return;
    }

    const blobUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `IdeaTermo-zakres-prac-${selectedClientId.slice(0, 8)}.pdf`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
    setGeneratingPdf(false);
  }

  if (hasAccess === false) {
    return (
      <main className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black text-red-700">Brak dostępu do IdeaTermo</h1>
        <p className="mt-2 text-sm text-slate-600">
          Administrator musi nadać Ci uprawnienie IdeaTermo.
        </p>
      </main>
    );
  }

  const availableHeatedLevels = getAvailableHeatedLevels({
    buildingStoreys: form.building_storeys,
    roofType: form.roof_type,
    hasBasement: form.has_basement,
    hasIntegratedGarage: form.has_integrated_garage,
  });
  const windowsPlanned = form.planned_scope.includes(
    PREAUDIT_SCOPE.windowReplacement
  );
  const doorsPlanned = form.planned_scope.includes(
    PREAUDIT_SCOPE.doorReplacement
  );
  const heatSourcePlanned = form.planned_scope.includes(
    PREAUDIT_SCOPE.heatSourceModernization
  );
  const solidFuelCurrentlyUsed = isSolidFuelHeatSource(
    form.current_heat_source
  );
  const firewoodCurrentlyUsed = form.current_fuel_type === "firewood";
  const wallsPlanned = form.planned_scope.includes(
    PREAUDIT_SCOPE.wallInsulation
  );
  const insulationPlanned =
    wallsPlanned ||
    form.planned_scope.includes(PREAUDIT_SCOPE.roofInsulation) ||
    form.planned_scope.includes(PREAUDIT_SCOPE.floorInsulation);
  const totalWallArea = form.wall_insulation_surfaces.reduce(
    (total, surface) => total + (getWallSurfaceArea(surface) || 0),
    0
  );
  const selectedInsulationScopes = [
    PREAUDIT_SCOPE.wallInsulation,
    PREAUDIT_SCOPE.roofInsulation,
    PREAUDIT_SCOPE.floorInsulation,
  ].filter((scope) => form.planned_scope.includes(scope));
  const totalWindowCount = form.windows.reduce(
    (total, group) => total + group.dimensions.length,
    0
  );
  const baseWizardSteps: PreauditWizardStep[] = [
    {
      id: "client",
      label: "Klient i ankieta",
      description: selectedClient
        ? selectedClient.full_name || selectedClient.company_name || "Wybrany klient"
        : "Wybierz klienta i uzupełnij dane",
    },
    {
      id: "scope",
      label: "Zakres prac",
      description: form.planned_scope.length
        ? `${form.planned_scope.length} wybranych pozycji`
        : "Wybierz planowane prace",
    },
    ...(insulationPlanned
      ? [
          {
            id: "insulation" as const,
            label: "Ocieplenia",
            description: `${selectedInsulationScopes.length} wybrane zakresy`,
          },
        ]
      : []),
    ...(windowsPlanned
      ? [
          {
            id: "windows" as const,
            label: "Okna",
            description: totalWindowCount
              ? `${totalWindowCount} okien do wymiany`
              : "Rodzaje, ilości i wymiary",
          },
        ]
      : []),
    ...(doorsPlanned
      ? [
          {
            id: "doors" as const,
            label: "Drzwi",
            description: form.external_doors.length
              ? `${form.external_doors.length} drzwi do wymiany`
              : "Rodzaje i wymiary",
          },
        ]
      : []),
    ...(heatSourcePlanned
      ? [
          {
            id: "heat_source" as const,
            label: "Źródło ciepła",
            description: form.planned_heat_source
              ? "Źródło docelowe i szacowany przedział mocy"
              : "Zużycie paliwa i parametry instalacji",
          },
        ]
      : []),
  ];
  const lastBaseWizardStepId = baseWizardSteps.at(-1)?.id || "scope";
  const wizardSteps: PreauditWizardStep[] = [
    ...baseWizardSteps,
    ...(form.advanced_mode_enabled
      ? [
          {
            id: "advanced" as const,
            label: "Tryb zaawansowany",
            description: "Szacunek EU i warunków programu",
          },
        ]
      : []),
    {
      id: "summary",
      label: "Podsumowanie",
      description:
        form.status === "completed" ? "Zakres zatwierdzony" : "Dokument dla wykonawcy",
    },
  ];
  const activeWizardStep = wizardSteps.some((step) => step.id === wizardStep)
    ? wizardStep
    : "scope";
  const activeWizardStepIndex = wizardSteps.findIndex(
    (step) => step.id === activeWizardStep
  );
  const activeWizardStepData = wizardSteps[activeWizardStepIndex];
  const stepValidationMessages: Record<
    PreauditWizardStepId,
    string | null
  > = {
    client: selectedClient ? null : "Najpierw wybierz klienta IdeaTermo.",
    scope: form.planned_scope.length
      ? null
      : "Wybierz co najmniej jeden zakres prac.",
    insulation: getInsulationValidationMessage(form),
    windows: getWindowsValidationMessage(form),
    doors: getDoorsValidationMessage(form),
    heat_source: null,
    advanced: null,
    summary: null,
  };
  const activeValidationMessage = stepValidationMessages[activeWizardStep];
  const firstIncompleteWizardStepIndex = wizardSteps.findIndex(
    (step) => stepValidationMessages[step.id] !== null
  );
  const maxReachableWizardStepIndex =
    firstIncompleteWizardStepIndex >= 0
      ? firstIncompleteWizardStepIndex
      : wizardSteps.length - 1;
  const canContinue = activeValidationMessage === null;
  const nextWizardStep = wizardSteps[activeWizardStepIndex + 1] || null;
  const previousWizardStep = wizardSteps[activeWizardStepIndex - 1] || null;
  const automaticClimateDescription = selectedClient?.postal_code
    ? `Strefa ${form.climate_zone}, oszacowana z kodu pocztowego ${selectedClient.postal_code}.`
    : "Brak kodu pocztowego klienta — przyjęto domyślną strefę III.";
  const advancedPhysicalLevels = availableHeatedLevels.filter(
    (level) => level.value !== "garage"
  );
  const advancedIncomeBandOptions = getIncomeBandOptions(
    form.advanced_household_type === "single" ||
    form.advanced_household_type === "multi"
      ? form.advanced_household_type
      : ""
  );

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-5 sm:py-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30">
          <div className="relative flex flex-wrap items-center justify-between gap-4 bg-slate-950 px-5 py-4 text-white dark:bg-black">
            <div>
              <p className="text-[11px] font-bold tracking-[0.14em] text-termo-400">
                IdeaTermo - konfigurator.
              </p>
              <h1 className="mt-1 text-xl font-black tracking-tight">
                Karta zakresu prac termomodernizacyjnych
              </h1>
            </div>
            {selectedClient && (
              <Link
                href={`/clients/${selectedClient.id}`}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
              >
                Karta klienta
              </Link>
            )}
          </div>

          <div className="grid xl:grid-cols-[220px_minmax(0,1fr)]">
            <nav className="border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950 xl:border-b-0 xl:border-r">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-1">
                {wizardSteps.map((step, index) => {
                  const isActive = activeWizardStep === step.id;
                  const isVisited = index < activeWizardStepIndex;
                  const isDisabled = index > maxReachableWizardStepIndex;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setWizardStep(step.id)}
                      className={`group rounded-2xl p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        isActive
                          ? "bg-slate-950 text-white shadow-lg shadow-slate-300 dark:bg-termo-500 dark:text-white dark:shadow-none"
                          : "text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${
                            isActive
                              ? "ideatermo-active-step-index bg-termo-400 text-[#172a49]"
                              : isVisited
                                ? "bg-termo-100 text-termo-700 dark:bg-termo-950 dark:text-termo-300"
                                : "bg-slate-200 text-slate-500 dark:bg-slate-800"
                          }`}
                        >
                          {isVisited
                            ? "✓"
                            : String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm font-bold">{step.label}</span>
                      </div>
                      <p
                        className={`mt-2 truncate text-[11px] ${
                          isActive
                            ? "text-slate-300 dark:text-white/80"
                            : "text-slate-400"
                        }`}
                      >
                        {step.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="min-w-0 p-4 sm:p-6">
              <div className="mb-6 flex items-end justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-termo-600">
                    Etap {String(activeWizardStepIndex + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                    {activeWizardStepData.label}
                  </h2>
                </div>
                <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:block">
                  {activeWizardStepIndex + 1} / {wizardSteps.length}
                </span>
              </div>

              {activeWizardStep === "client" && (
                <div className="space-y-6">
                  <QuestionnaireSection
                    title="Klient IdeaTermo"
                    description="Wybierz klienta, dla którego przygotowujesz zakres prac."
                  >
                    <div className="relative">
                      <label className="block">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
                          Klient CRM
                          <span className="normal-case tracking-normal text-slate-500 dark:text-slate-400">
                            wymagany do przygotowania zakresu
                          </span>
                        </span>
                        <input
                          type="text"
                          value={
                            isClientDropdownOpen
                              ? clientSearch
                              : selectedClient
                                ? selectedClient.full_name ||
                                  selectedClient.company_name ||
                                  "Klient"
                                : ""
                          }
                          onFocus={() => {
                            setIsClientDropdownOpen(true);
                            setIsSearchingClients(false);
                            setClientSearch("");
                            setClientSuggestions([]);
                            setClientSearchError("");
                          }}
                          onChange={(event) => {
                            const value = event.target.value;
                            setClientSearch(value);
                            setIsClientDropdownOpen(true);
                            setClientSearchError("");
                            if (
                              normalizeClientSearchTerm(value).length <
                              MIN_CLIENT_SEARCH_LENGTH
                            ) {
                              setClientSuggestions([]);
                              setIsSearchingClients(false);
                            }
                          }}
                          placeholder="Wpisz co najmniej 2 znaki nazwiska klienta"
                          autoComplete="off"
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-termo-400 focus:bg-white focus:ring-4 focus:ring-termo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:placeholder:text-slate-500 dark:focus:border-termo-500 dark:focus:bg-slate-950 dark:focus:ring-termo-500/20"
                        />
                      </label>

                      {isClientDropdownOpen && (
                        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
                          <div className="mb-2 flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>
                              {isSearchingClients
                                ? "Wyszukuję klientów..."
                                : normalizeClientSearchTerm(clientSearch).length >=
                                    MIN_CLIENT_SEARCH_LENGTH
                                  ? "Wyniki wyszukiwania"
                                  : "Wpisz minimum 2 znaki nazwiska"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsClientDropdownOpen(false);
                                setIsSearchingClients(false);
                              }}
                              className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                            >
                              Zamknij
                            </button>
                          </div>

                          {clientSearchError ? (
                            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">
                              {clientSearchError}
                            </div>
                          ) : normalizeClientSearchTerm(clientSearch).length <
                            MIN_CLIENT_SEARCH_LENGTH ? (
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                              Zacznij pisać nazwisko. Wyniki pojawią się automatycznie.
                            </div>
                          ) : clientSuggestions.length > 0 ? (
                            <div className="space-y-2">
                              {clientSuggestions.map((client) => (
                                <button
                                  key={client.id}
                                  type="button"
                                  onClick={() => selectClient(client)}
                                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-termo-200 hover:bg-termo-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-termo-500/50 dark:hover:bg-slate-800"
                                >
                                  <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
                                    <div className="min-w-0">
                                      <div className="break-words font-semibold text-slate-950 dark:text-slate-100">
                                        {client.full_name ||
                                          client.company_name ||
                                          "Klient bez nazwy"}
                                      </div>
                                      <div className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                                        {[
                                          client.phone || client.contact_phone,
                                          client.email,
                                          client.city,
                                        ]
                                          .filter(Boolean)
                                          .join(" • ") || "Brak danych kontaktowych"}
                                      </div>
                                    </div>
                                    {client.public_id && (
                                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-termo-700 ring-1 ring-termo-100 dark:bg-slate-950 dark:text-termo-300 dark:ring-termo-500/40">
                                        LeadID {client.public_id}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : isSearchingClients ? (
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                              Pobieram klientów IdeaTermo...
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                              Nie znaleziono przypisanego klienta IdeaTermo.
                            </div>
                          )}
                        </div>
                      )}

                      {selectedClient && (
                        <div className="mt-3 border-l-2 border-termo-400 pl-3 text-sm text-slate-700 dark:text-slate-200">
                          Wybrany klient CRM: {" "}
                          <strong>
                            {selectedClient.full_name ||
                              selectedClient.company_name ||
                              "Klient"}
                          </strong>
                          {selectedClient.public_id
                            ? ` • LeadID ${selectedClient.public_id}`
                            : ""}
                        </div>
                      )}
                    </div>
                  </QuestionnaireSection>

                  {selectedClient && (
                    <>
                      <QuestionnaireSection
                        title="Podstawowa ankieta"
                        description="Dane budynku i obecny sposób ogrzewania."
                      >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <Field
                            label="Data ankiety"
                            type="date"
                            value={form.audit_date}
                            onChange={(value) => updateField("audit_date", value)}
                          />
                          <SelectField
                            label="Typ budynku"
                            value={form.building_type}
                            onChange={(value) => updateField("building_type", value)}
                            options={BUILDING_TYPE_OPTIONS}
                          />
                          <Field
                            label="Powierzchnia ogrzewana (m²)"
                            type="number"
                            step="1"
                            value={form.heated_area_m2}
                            onChange={(value) => updateField("heated_area_m2", value)}
                          />
                          <Field
                            label="Powierzchnia całkowita budynku (m²)"
                            type="number"
                            step="1"
                            value={form.total_building_area_m2}
                            onChange={(value) =>
                              updateField("total_building_area_m2", value)
                            }
                          />
                          <SelectField
                            label="Liczba mieszkańców"
                            value={form.household_members}
                            onChange={(value) => updateField("household_members", value)}
                            options={HOUSEHOLD_MEMBERS_OPTIONS}
                            placeholder="Wybierz liczbę mieszkańców"
                          />
                          <SelectField
                            label="Obecne źródło ciepła"
                            value={form.current_heat_source}
                            onChange={updateHeatSource}
                            options={HEAT_SOURCE_OPTIONS}
                            placeholder="Wybierz źródło ciepła"
                          />
                          {form.current_heat_source === "other" && (
                            <Field
                              label="Inne źródło ciepła – jakie?"
                              value={form.heat_source_other}
                              onChange={(value) =>
                                updateField("heat_source_other", value)
                              }
                            />
                          )}
                        </div>
                      </QuestionnaireSection>

                      <QuestionnaireSection
                        title="Bryła budynku i ogrzewane kondygnacje"
                        description="Wybory od razu zmieniają podgląd domu. Ogrzewane poziomy możesz zaznaczyć na liście albo bezpośrednio na grafice."
                        accent
                      >
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
                          <div className="space-y-5">
                            <div className="grid gap-4 md:grid-cols-2">
                              <SelectField
                                label="Liczba kondygnacji"
                                value={form.building_storeys}
                                onChange={(value) =>
                                  updateBuildingShape({
                                    building_storeys:
                                      normalizeBuildingStoreys(value),
                                  })
                                }
                                options={BUILDING_STOREY_OPTIONS}
                              />
                              <SelectField
                                label="Dach"
                                value={form.roof_type}
                                onChange={(value) =>
                                  updateBuildingShape({
                                    roof_type: normalizeRoofType(value),
                                  })
                                }
                                options={ROOF_TYPE_OPTIONS}
                              />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                              <BooleanChoice
                                label="Czy dom jest podpiwniczony?"
                                value={form.has_basement}
                                onChange={(value) =>
                                  updateBuildingShape({ has_basement: value })
                                }
                              />
                              <BooleanChoice
                                label="Czy w bryle budynku jest garaż?"
                                value={form.has_integrated_garage}
                                onChange={(value) =>
                                  updateBuildingShape({
                                    has_integrated_garage: value,
                                  })
                                }
                              />
                              <BooleanChoice
                                label="Czy w budynku jest rekuperacja?"
                                value={
                                  form.ventilation_type ===
                                  "balanced_with_heat_recovery"
                                }
                                onChange={(value) =>
                                  updateField(
                                    "ventilation_type",
                                    value
                                      ? "balanced_with_heat_recovery"
                                      : "natural"
                                  )
                                }
                              />
                            </div>

                            <div className="rounded-2xl border border-termo-200 bg-white p-4 text-xs leading-5 text-slate-600 dark:border-termo-800 dark:bg-slate-950 dark:text-slate-300">
                              <p className="font-black text-slate-900 dark:text-white">
                                Założenia obliczane automatycznie
                              </p>
                              <p className="mt-1">
                                Rzut, obwód i kubaturę szacujemy z powierzchni oraz
                                ogrzewanych kondygnacji. Przyjmujemy wysokość 2,7 m;
                                wymiary ścian podane później określają wyłącznie
                                faktyczną powierzchnię planowanego docieplenia.
                              </p>
                              <p className="mt-1">{automaticClimateDescription}</p>
                              <p className="mt-1">
                                Wymiana powietrza jest dobierana automatycznie do
                                odpowiedzi o rekuperacji — nie trzeba podawać
                                technicznego wskaźnika 1/h.
                              </p>
                            </div>

                            <fieldset>
                              <legend className="text-sm font-black text-slate-800 dark:text-slate-100">
                                Które kondygnacje są ogrzewane?
                              </legend>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Lista dopasowuje się do liczby pięter, piwnicy i
                                poddasza.
                              </p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {availableHeatedLevels.map((level) => {
                                  const selected = form.heated_levels.includes(
                                    level.value
                                  );
                                  return (
                                    <label
                                      key={level.value}
                                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-bold transition ${
                                        selected
                                          ? "border-termo-400 bg-termo-100 text-termo-950 dark:border-termo-500 dark:bg-termo-500/15 dark:text-termo-100"
                                          : "border-slate-200 bg-white text-slate-700 hover:border-termo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() =>
                                          toggleHeatedLevel(level.value)
                                        }
                                        className="h-4 w-4 accent-termo-500"
                                      />
                                      {level.label}
                                    </label>
                                  );
                                })}
                              </div>
                            </fieldset>
                          </div>

                          <BuildingShapePreview
                            buildingStoreys={form.building_storeys}
                            roofType={form.roof_type}
                            hasBasement={form.has_basement}
                            hasIntegratedGarage={form.has_integrated_garage}
                            heatedLevels={form.heated_levels}
                            onToggleLevel={toggleHeatedLevel}
                          />
                        </div>
                      </QuestionnaireSection>

                      <QuestionnaireSection
                        title="Obecne przegrody budynku"
                        description="Wskaż konstrukcję ścian oraz wszystkie występujące warstwy izolacyjne."
                      >
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <MaterialSelectField
                            label="Materiał ścian"
                            value={form.wall_material}
                            onChange={(value) => updateField("wall_material", value)}
                            options={WALL_MATERIAL_OPTIONS}
                          />
                          <Field
                            label="Grubość ściany bez docieplenia (cm)"
                            type="number"
                            step="1"
                            value={form.wall_thickness_cm}
                            onChange={(value) =>
                              updateField("wall_thickness_cm", value)
                            }
                          />
                          <div className="hidden xl:block" />
                          <div className="md:col-span-2 xl:col-span-3">
                            <InsulationLayersField
                              label="Obecna izolacja ścian"
                              value={form.wall_insulation_layers}
                              maxLayers={MAX_WALL_INSULATION_LAYERS}
                              onChange={(value) =>
                                updateField("wall_insulation_layers", value)
                              }
                            />
                          </div>
                          <div className="md:col-span-2 xl:col-span-3">
                            <InsulationLayersField
                              label="Obecna izolacja dachu / stropu"
                              value={form.roof_insulation_layers}
                              maxLayers={MAX_ROOF_INSULATION_LAYERS}
                              onChange={(value) =>
                                updateField("roof_insulation_layers", value)
                              }
                            />
                          </div>
                          <div className="md:col-span-2 xl:col-span-3">
                            <InsulationLayersField
                              label={
                                form.has_basement &&
                                !form.heated_levels.includes("basement")
                                  ? "Obecna izolacja stropu nad nieogrzewaną piwnicą"
                                  : "Obecna izolacja podłogi na gruncie"
                              }
                              value={form.floor_insulation_layers}
                              maxLayers={MAX_FLOOR_INSULATION_LAYERS}
                              onChange={(value) =>
                                updateField("floor_insulation_layers", value)
                              }
                            />
                          </div>
                        </div>
                      </QuestionnaireSection>
                    </>
                  )}
                </div>
              )}

              {activeWizardStep === "scope" && (
                <QuestionnaireSection
                  title="Planowany zakres termomodernizacji"
                  description="Na podstawie wyboru utworzymy kolejne ekrany ankiety."
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    {PLANNED_SCOPE_OPTIONS.map((scope) => {
                      const selected = form.planned_scope.includes(scope);
                      return (
                        <label
                          key={scope}
                          className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                            selected
                                ? "cursor-pointer border-slate-950 bg-slate-950 text-white shadow-md dark:border-termo-500 dark:bg-termo-500/15 dark:text-termo-100 dark:shadow-none"
                                : "cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleScope(scope)}
                            className="h-4 w-4 accent-termo-500"
                          />
                          {scope}
                        </label>
                      );
                    })}
                  </div>
                </QuestionnaireSection>
              )}

              {insulationPlanned && activeWizardStep === "insulation" && (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {selectedInsulationScopes.map((scope) => (
                      <div
                        key={scope}
                        className="flex items-center gap-3 rounded-2xl border border-termo-200 bg-termo-50 px-4 py-3 text-sm font-bold text-termo-950 dark:border-termo-500/40 dark:bg-slate-900 dark:text-termo-100"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-termo-500 text-xs text-white">
                          ✓
                        </span>
                        {scope}
                      </div>
                    ))}
                  </div>

                  {wallsPlanned && (
                    <QuestionnaireSection
                      title="Ściany do docieplenia"
                      description="Wybierz liczbę ścian. Dla prostokątnej ściany powierzchnia obliczy się automatycznie, a przy nietypowym kształcie możesz podać ją ręcznie."
                      accent
                    >
                      <div className="mb-5 grid gap-4 md:grid-cols-2">
                        <SelectField
                          label="Planowany materiał izolacji ścian"
                          value={form.planned_wall_insulation_material}
                          onChange={(value) =>
                            updateField(
                              "planned_wall_insulation_material",
                              value
                            )
                          }
                          options={PLANNED_INSULATION_MATERIAL_OPTIONS}
                        />
                        <Field
                          label="Planowana grubość izolacji ścian (cm)"
                          type="number"
                          min={1}
                          max={60}
                          step="1"
                          value={form.planned_wall_insulation_cm}
                          onChange={(value) =>
                            updateField("planned_wall_insulation_cm", value)
                          }
                        />
                      </div>
                      <div className="max-w-xs">
                        <Field
                          label="Liczba ścian do docieplenia"
                          type="number"
                          min={0}
                          step="1"
                          value={String(form.wall_insulation_surfaces.length)}
                          onChange={(value) =>
                            updateWallQuantity(Number.parseInt(value, 10))
                          }
                        />
                      </div>
                      <div className="mt-5 space-y-4">
                        {form.wall_insulation_surfaces.map((surface, index) => {
                          const area = getWallSurfaceArea(surface);
                          return (
                            <div
                              key={index}
                              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm font-black">Ściana {index + 1}</p>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={surface.use_manual_area}
                                    onChange={(event) =>
                                      updateWallSurface(
                                        index,
                                        "use_manual_area",
                                        event.target.checked
                                      )
                                    }
                                    className="h-4 w-4 accent-termo-600"
                                  />
                                  Nietypowy kształt – wpisz powierzchnię ręcznie
                                </label>
                              </div>
                              {surface.use_manual_area ? (
                                <div className="mt-4 max-w-xs">
                                  <Field
                                    label="Powierzchnia ściany (m²)"
                                    type="number"
                                    value={surface.manual_area_m2}
                                    onChange={(value) =>
                                      updateWallSurface(index, "manual_area_m2", value)
                                    }
                                  />
                                </div>
                              ) : (
                                <div className="mt-4 grid items-end gap-4 md:grid-cols-3">
                                  <Field
                                    label="Wysokość (m)"
                                    type="number"
                                    value={surface.height_m}
                                    onChange={(value) =>
                                      updateWallSurface(index, "height_m", value)
                                    }
                                  />
                                  <Field
                                    label="Szerokość (m)"
                                    type="number"
                                    value={surface.width_m}
                                    onChange={(value) =>
                                      updateWallSurface(index, "width_m", value)
                                    }
                                  />
                                  <ReadOnlyField
                                    label="Powierzchnia (m²)"
                                    value={formatArea(area)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {form.wall_insulation_surfaces.length > 0 && (
                        <div className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white dark:border dark:border-termo-500/40 dark:bg-termo-500/10 dark:text-termo-100">
                          Łączna powierzchnia ścian: {formatArea(totalWallArea)} m²
                        </div>
                      )}
                    </QuestionnaireSection>
                  )}

                  {form.planned_scope.includes(
                    PREAUDIT_SCOPE.roofInsulation
                  ) && (
                    <QuestionnaireSection
                      title="Planowane docieplenie dachu / stropu"
                      description="Materiał, grubość i powierzchnia stanowią kompletną pozycję do wyceny wykonawcy."
                    >
                      <div className="grid gap-4 md:grid-cols-3">
                        <SelectField
                          label="Planowany materiał izolacji"
                          value={form.planned_roof_insulation_material}
                          onChange={(value) =>
                            updateField(
                              "planned_roof_insulation_material",
                              value
                            )
                          }
                          options={PLANNED_INSULATION_MATERIAL_OPTIONS}
                        />
                        <Field
                          label="Planowana grubość izolacji (cm)"
                          type="number"
                          min={1}
                          max={80}
                          step="1"
                          value={form.planned_roof_insulation_cm}
                          onChange={(value) =>
                            updateField("planned_roof_insulation_cm", value)
                          }
                        />
                        <Field
                          label="Powierzchnia do docieplenia (m²)"
                          type="number"
                          min={1}
                          step="1"
                          value={form.planned_roof_area_m2}
                          onChange={(value) =>
                            updateField("planned_roof_area_m2", value)
                          }
                        />
                      </div>
                    </QuestionnaireSection>
                  )}

                  {form.planned_scope.includes(
                    PREAUDIT_SCOPE.floorInsulation
                  ) && (
                    <QuestionnaireSection
                      title={
                        form.has_basement &&
                        !form.heated_levels.includes("basement")
                          ? "Planowane docieplenie stropu nad piwnicą"
                          : "Planowane docieplenie podłogi"
                      }
                      description="Materiał, grubość i powierzchnia stanowią kompletną pozycję do wyceny wykonawcy."
                    >
                      <div className="grid gap-4 md:grid-cols-3">
                        <SelectField
                          label="Planowany materiał izolacji"
                          value={form.planned_floor_insulation_material}
                          onChange={(value) =>
                            updateField(
                              "planned_floor_insulation_material",
                              value
                            )
                          }
                          options={PLANNED_INSULATION_MATERIAL_OPTIONS}
                        />
                        <Field
                          label="Planowana grubość izolacji (cm)"
                          type="number"
                          min={1}
                          max={50}
                          step="1"
                          value={form.planned_floor_insulation_cm}
                          onChange={(value) =>
                            updateField("planned_floor_insulation_cm", value)
                          }
                        />
                        <Field
                          label="Powierzchnia do docieplenia (m²)"
                          type="number"
                          min={1}
                          step="1"
                          value={form.planned_floor_area_m2}
                          onChange={(value) =>
                            updateField("planned_floor_area_m2", value)
                          }
                        />
                      </div>
                    </QuestionnaireSection>
                  )}
                </div>
              )}

              {windowsPlanned && activeWizardStep === "windows" && (
                <QuestionnaireSection
                  title="Stolarka okienna"
                  description="Wybierz stan obecnych okien, ich rodzaje, liczbę oraz wymiary każdej sztuki."
                  accent
                >
                  <SelectField
                    label="Jakie są obecne okna?"
                    value={form.window_type}
                    onChange={(value) => updateField("window_type", value)}
                    options={WINDOW_GLAZING_OPTIONS}
                    placeholder="Proszę wybrać"
                  />
                  <div className="mt-4 max-w-md">
                    <SelectField
                      label="Docelowy współczynnik nowych okien"
                      value={form.planned_window_u_value}
                      onChange={(value) =>
                        updateField("planned_window_u_value", value)
                      }
                      options={PLANNED_WINDOW_U_VALUE_OPTIONS}
                    />
                  </div>
                  <div className="mt-5">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                      Rodzaje okien przeznaczonych do wymiany
                    </p>
                    <div className="mt-3 grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {WINDOW_KINDS.map((kind) => {
                        const selectedGroup = form.windows.find(
                          (group) => group.kind === kind.value
                        );
                        const selected = Boolean(selectedGroup);
                        return (
                          <div
                            key={kind.value}
                            className={`flex h-52 flex-col rounded-2xl border p-4 transition ${
                              selected
                                ? "border-termo-500 bg-termo-50 text-slate-950 ring-2 ring-termo-100 dark:border-termo-500 dark:bg-termo-500/10 dark:text-slate-100 dark:ring-termo-500/20"
                                : "border-slate-200 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
                            }`}
                          >
                            <button
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleWindowKind(kind.value)}
                              className="flex min-h-0 w-full flex-1 flex-col text-left"
                            >
                              <WindowIcon kind={kind} selected={selected} />
                              <span className="mt-3 block text-sm font-bold">
                                {kind.label}
                              </span>
                            </button>
                            <div
                              className={`mt-3 flex min-h-10 items-center justify-between gap-3 border-t pt-3 text-xs font-black ${
                                selected
                                  ? "border-termo-200 text-slate-700 dark:border-termo-500/30 dark:text-slate-200"
                                  : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
                              }`}
                            >
                              <span>Ilość:</span>
                              {selected ? (
                                <input
                                  aria-label={`Ilość okien: ${kind.label}`}
                                  type="number"
                                  min={1}
                                  step="1"
                                  value={String(selectedGroup?.dimensions.length || 1)}
                                  onChange={(event) =>
                                    updateWindowQuantity(
                                      kind.value,
                                      Number.parseInt(event.target.value, 10)
                                    )
                                  }
                                  className="h-8 w-20 rounded-lg border border-termo-200 bg-white px-2 text-sm font-normal text-slate-950 outline-none focus:border-termo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                />
                              ) : (
                                <span aria-hidden="true" className="text-slate-400">
                                  —
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 space-y-4">
                    {form.windows.map((group) => {
                      const kind = WINDOW_KINDS.find(
                        (item) => item.value === group.kind
                      );
                      if (!kind) return null;
                      return (
                        <div
                          key={group.kind}
                          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <p className="text-sm font-black">{kind.label}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Podaj wymiary każdego okna osobno.
                          </p>
                          <DimensionsEditor
                            dimensions={group.dimensions}
                            itemLabel="Okno"
                            onChange={(index, key, value) =>
                              updateWindowDimension(group.kind, index, key, value)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </QuestionnaireSection>
              )}

              {doorsPlanned && activeWizardStep === "doors" && (
                <QuestionnaireSection
                  title="Drzwi zewnętrzne"
                  description="Najpierw wybierz liczbę drzwi, a następnie uzupełnij rodzaj i wymiary każdej sztuki. Można wskazać maksymalnie 3 drzwi."
                  accent
                >
                  <div className="mb-4 max-w-md">
                    <SelectField
                      label="Docelowy współczynnik nowych drzwi"
                      value={form.planned_door_u_value}
                      onChange={(value) =>
                        updateField("planned_door_u_value", value)
                      }
                      options={PLANNED_DOOR_U_VALUE_OPTIONS}
                    />
                  </div>
                  <div className="max-w-xs">
                    <Field
                      label="Liczba drzwi zewnętrznych"
                      type="number"
                      min={0}
                      max={3}
                      step="1"
                      value={String(form.external_doors.length)}
                      onChange={(value) =>
                        updateDoorQuantity(Number.parseInt(value, 10))
                      }
                    />
                  </div>
                  <div className="mt-5 space-y-4">
                    {form.external_doors.map((door, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"
                      >
                        <p className="text-sm font-black">Drzwi {index + 1}</p>
                        <div className="mt-3 grid gap-4 md:grid-cols-3">
                          <SelectField
                            label="Rodzaj drzwi"
                            value={door.type}
                            onChange={(value) => updateDoor(index, "type", value)}
                            options={EXTERNAL_DOOR_OPTIONS}
                            placeholder="Proszę wybrać"
                          />
                          <Field
                            label="Szerokość (cm)"
                            type="number"
                            value={door.width_cm}
                            onChange={(value) =>
                              updateDoor(index, "width_cm", value)
                            }
                          />
                          <Field
                            label="Wysokość (cm)"
                            type="number"
                            value={door.height_cm}
                            onChange={(value) =>
                              updateDoor(index, "height_cm", value)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </QuestionnaireSection>
              )}

              {heatSourcePlanned && activeWizardStep === "heat_source" && (
                <div className="space-y-5">
                  <QuestionnaireSection
                    title="Dane obecnego ogrzewania"
                    description="Dane obecnego źródła i zużycia opału są informacją dla wykonawcy. Moc starego urządzenia nie wyznacza automatycznie mocy nowego."
                    accent
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <ReadOnlyField
                        label="Obecne źródło ciepła"
                        value={getOptionLabel(
                          HEAT_SOURCE_OPTIONS,
                          form.current_heat_source,
                          "Nie wskazano"
                        )}
                      />
                      <Field
                        label="Moc znamionowa obecnego źródła (kW)"
                        type="number"
                        min={1}
                        max={200}
                        step="0.1"
                        value={form.current_source_power_kw}
                        onChange={(value) =>
                          updateField("current_source_power_kw", value)
                        }
                      />
                      <SelectField
                        label="Czy obecne źródło przygotowuje też CWU?"
                        value={form.current_source_heats_dhw}
                        onChange={(value) =>
                          updateField("current_source_heats_dhw", value)
                        }
                        options={YES_NO_UNKNOWN_OPTIONS}
                        placeholder="Proszę wybrać"
                      />
                      <SelectField
                        label="Czy budynek osiąga zadaną temperaturę podczas mrozów?"
                        value={form.current_heating_performance}
                        onChange={(value) =>
                          updateField("current_heating_performance", value)
                        }
                        options={CURRENT_HEATING_PERFORMANCE_OPTIONS}
                        placeholder="Proszę wybrać"
                      />
                      {!windowsPlanned && (
                        <SelectField
                          label="Rodzaj obecnych okien"
                          value={form.window_type}
                          onChange={(value) => updateField("window_type", value)}
                          options={WINDOW_GLAZING_OPTIONS}
                          placeholder="Proszę wybrać"
                        />
                      )}
                    </div>

                    {solidFuelCurrentlyUsed && (
                      <div className="mt-5 rounded-2xl border border-termo-200 bg-white p-4 dark:border-termo-800 dark:bg-slate-950">
                        <h4 className="font-black text-slate-950 dark:text-white">
                          Rzeczywiste zużycie opału
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          Najlepsza jest średnia z kilku pełnych sezonów. Dla drewna
                          podaj metry przestrzenne drewna ułożonego, nie luźnego.
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <SelectField
                            label="Używany opał"
                            value={form.current_fuel_type}
                            onChange={updateCurrentFuelType}
                            options={CURRENT_FUEL_OPTIONS}
                            placeholder="Proszę wybrać"
                          />
                          <Field
                            label={
                              firewoodCurrentlyUsed
                                ? "Roczne zużycie drewna (m³/rok)"
                                : "Roczne zużycie opału (t/rok)"
                            }
                            type="number"
                            min={0.1}
                            max={100}
                            step="0.1"
                            value={form.annual_fuel_quantity}
                            onChange={(value) =>
                              updateField("annual_fuel_quantity", value)
                            }
                          />
                          <SelectField
                            label="Podstawa podanego zużycia"
                            value={form.fuel_consumption_basis}
                            onChange={(value) =>
                              updateField("fuel_consumption_basis", value)
                            }
                            options={FUEL_CONSUMPTION_BASIS_OPTIONS}
                            placeholder="Proszę wybrać"
                          />
                          <SelectField
                            label="Czy używano dodatkowego źródła ciepła?"
                            value={form.supplemental_heating_used}
                            onChange={(value) =>
                              updateField("supplemental_heating_used", value)
                            }
                            options={YES_NO_UNKNOWN_OPTIONS}
                            placeholder="Proszę wybrać"
                          />

                          {firewoodCurrentlyUsed ? (
                            <>
                              <SelectField
                                label="Rodzaj drewna"
                                value={form.wood_type}
                                onChange={(value) =>
                                  updateField("wood_type", value)
                                }
                                options={WOOD_TYPE_OPTIONS}
                                placeholder="Proszę wybrać"
                              />
                              <SelectField
                                label="Stopień wysuszenia drewna"
                                value={form.wood_seasoning}
                                onChange={(value) =>
                                  updateField("wood_seasoning", value)
                                }
                                options={WOOD_SEASONING_OPTIONS}
                                placeholder="Proszę wybrać"
                              />
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </QuestionnaireSection>

                  <QuestionnaireSection
                    title="Nowe źródło i instalacja"
                    description="Parametry instalacji decydują nie tylko o mocy, ale też o tym, czy wybrane urządzenie będzie pracować efektywnie."
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <SelectField
                        label="Planowane nowe źródło ciepła"
                        value={form.planned_heat_source}
                        onChange={(value) =>
                          updateField("planned_heat_source", value)
                        }
                        options={PLANNED_HEAT_SOURCE_OPTIONS}
                        placeholder="Proszę wybrać"
                      />
                      <SelectField
                        label="Czy nowe źródło ma przygotowywać CWU?"
                        value={form.planned_source_heats_dhw}
                        onChange={(value) =>
                          updateField("planned_source_heats_dhw", value)
                        }
                        options={YES_NO_UNKNOWN_OPTIONS}
                        placeholder="Proszę wybrać"
                      />
                      <SelectField
                        label="Sposób oddawania ciepła"
                        value={form.heating_distribution_type}
                        onChange={(value) =>
                          updateField("heating_distribution_type", value)
                        }
                        options={HEATING_DISTRIBUTION_OPTIONS}
                        placeholder="Proszę wybrać"
                      />
                      <Field
                        label="Wymagana temperatura zasilania przy mrozie (°C)"
                        type="number"
                        min={20}
                        max={95}
                        step="1"
                        value={form.heating_supply_temperature_c}
                        onChange={(value) =>
                          updateField("heating_supply_temperature_c", value)
                        }
                      />
                      <Field
                        label="Oczekiwana temperatura w budynku (°C)"
                        type="number"
                        min={16}
                        max={26}
                        step="0.5"
                        value={form.desired_indoor_temperature_c}
                        onChange={(value) =>
                          updateField("desired_indoor_temperature_c", value)
                        }
                      />
                    </div>
                  </QuestionnaireSection>

                  <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-termo-400">
                          Wynik na żywo
                        </p>
                        <h3 className="mt-1 text-lg font-black">
                          Szacowany przedział mocy nowego źródła
                        </h3>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-300">
                        Margines maks. ±15%
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <Result
                        label="Planowane źródło"
                        value={
                          getOptionLabel(
                            PLANNED_HEAT_SOURCE_OPTIONS,
                            form.planned_heat_source,
                            "Nie wybrano"
                          )
                        }
                      />
                      <Result
                        label="Moc do wyceny"
                        value={
                          calculation.indicativeRequiredPowerKw !== null
                            ? `${calculation.indicativeRequiredPowerKw} kW`
                            : "Nie podajemy bez kompletu danych"
                        }
                      />
                      <Result
                        label="Dopuszczalny przedział"
                        value={
                          calculation.indicativePowerMinKw !== null &&
                          calculation.indicativePowerMaxKw !== null
                            ? `${calculation.indicativePowerMinKw}–${calculation.indicativePowerMaxKw} kW`
                            : "Brak wiarygodnego przedziału"
                        }
                      />
                    </div>
                    {calculation.powerEstimateMissingInputs.length > 0 ? (
                      <p className="mt-4 text-xs leading-5 text-amber-300">
                        Aby podać moc z marginesem do ±15%, uzupełnij: {calculation.powerEstimateMissingInputs.join(", ")}.
                      </p>
                    ) : (
                      <p className="mt-4 text-xs leading-5 text-slate-400">
                        Przedział służy wykonawcy do wstępnej wyceny. Ostateczny dobór urządzenia potwierdzi audytor lub projektant.
                      </p>
                    )}
                  </section>
                </div>
              )}

              {activeWizardStep === "advanced" && (
                <div className="space-y-5">
                  <section className="rounded-3xl border border-termo-200 bg-termo-50/60 p-5 dark:border-termo-500/40 dark:bg-termo-500/10">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-termo-700 dark:text-termo-300">
                          Moduł nieobowiązkowy
                        </p>
                        <h3 className="mt-2 text-xl font-black">
                          Ankieta zaawansowana
                        </h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                          Kilka prostych pytań zawęża przedział szacowanego EU przed i po wybranej modernizacji. Nie tworzymy zaleceń — liczymy wyłącznie efekt zakresu wskazanego wcześniej.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateField("advanced_mode_enabled", false);
                          setWizardStep(lastBaseWizardStepId);
                        }}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Wyłącz tryb zaawansowany
                      </button>
                    </div>
                  </section>

                  <QuestionnaireSection
                    title="Uproszczona geometria"
                    description="Bez mierzenia długości i szerokości budynku. Powierzchnię całkowitą łączymy z liczbą poziomów i prostą oceną kształtu."
                  >
                    <div className="grid gap-5">
                      <FootprintShapeChoiceGroup
                        label="Jaki kształt ma rzut budynku?"
                        value={form.advanced_footprint_shape}
                        options={FOOTPRINT_SHAPE_OPTIONS}
                        onChange={(value) =>
                          updateField("advanced_footprint_shape", value)
                        }
                      />
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                          Wysokości kondygnacji
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Wpisz typową wysokość pomieszczeń na każdym istniejącym poziomie.
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {advancedPhysicalLevels.map((level) => (
                            <Field
                              key={level.value}
                              label={`${HEATED_LEVEL_LABELS[level.value]} (m)`}
                              type="number"
                              min={1.8}
                              max={6}
                              step="0.1"
                              value={
                                form.advanced_storey_heights_m[level.value] || ""
                              }
                              onChange={(value) =>
                                setForm((current) => ({
                                  ...current,
                                  advanced_storey_heights_m: {
                                    ...current.advanced_storey_heights_m,
                                    [level.value]: value,
                                  },
                                }))
                              }
                            />
                          ))}
                        </div>
                      </div>
                      {form.has_basement && (
                        <div className="grid gap-4">
                          <ChoiceTileGroup
                            label="Jak duża część budynku jest podpiwniczona?"
                            value={form.advanced_basement_coverage}
                            options={BASEMENT_COVERAGE_OPTIONS}
                            onChange={(value) =>
                              updateField("advanced_basement_coverage", value)
                            }
                          />
                          {form.advanced_basement_coverage === "partial" && (
                            <div className="max-w-sm">
                              <Field
                                label="Powierzchnia piwnicy (m²) – opcjonalnie"
                                type="number"
                                min={0}
                                step="0.1"
                                value={form.advanced_partial_basement_area_m2}
                                onChange={(value) =>
                                  updateField(
                                    "advanced_partial_basement_area_m2",
                                    value
                                  )
                                }
                              />
                              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                Podaj przybliżoną powierzchnię, jeżeli ją znasz. Brak wartości nie blokuje obliczenia.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </QuestionnaireSection>

                  <QuestionnaireSection
                    title="Okna i drzwi pozostające w budynku"
                    description="Wymiary elementów wybranych do wymiany już znamy. Potrzebujemy tylko powierzchni tych, które pozostaną."
                  >
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                        <h4 className="font-black">Okna</h4>
                        {windowsPlanned ? (
                          <>
                            <ChoiceTileGroup
                              label="Czy wszystkie okna podlegają wymianie?"
                              value={form.advanced_all_windows_replaced}
                              options={YES_NO_UNKNOWN_OPTIONS}
                              onChange={(value) =>
                                updateField("advanced_all_windows_replaced", value)
                              }
                              compact
                            />
                            {form.advanced_all_windows_replaced !== "yes" && (
                              <Field
                                label="Powierzchnia okien, które nie wymagają wymiany (m²)"
                                type="number"
                                min={0}
                                step="0.1"
                                value={form.advanced_remaining_window_area_m2}
                                onChange={(value) =>
                                  updateField(
                                    "advanced_remaining_window_area_m2",
                                    value
                                  )
                                }
                              />
                            )}
                          </>
                        ) : (
                          <Field
                            label="Łączna powierzchnia wszystkich istniejących okien (m²)"
                            type="number"
                            min={0}
                            step="0.1"
                            value={form.advanced_remaining_window_area_m2}
                            onChange={(value) =>
                              updateField(
                                "advanced_remaining_window_area_m2",
                                value
                              )
                            }
                          />
                        )}
                      </div>
                      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                        <h4 className="font-black">Drzwi zewnętrzne</h4>
                        {doorsPlanned ? (
                          <>
                            <ChoiceTileGroup
                              label="Czy wszystkie drzwi zewnętrzne podlegają wymianie?"
                              value={form.advanced_all_doors_replaced}
                              options={YES_NO_UNKNOWN_OPTIONS}
                              onChange={(value) =>
                                updateField("advanced_all_doors_replaced", value)
                              }
                              compact
                            />
                            {form.advanced_all_doors_replaced !== "yes" && (
                              <Field
                                label="Powierzchnia drzwi pozostających bez wymiany (m²)"
                                type="number"
                                min={0}
                                step="0.1"
                                value={form.advanced_remaining_door_area_m2}
                                onChange={(value) =>
                                  updateField(
                                    "advanced_remaining_door_area_m2",
                                    value
                                  )
                                }
                              />
                            )}
                          </>
                        ) : (
                          <Field
                            label="Łączna powierzchnia istniejących drzwi zewnętrznych (m²)"
                            type="number"
                            min={0}
                            step="0.1"
                            value={form.advanced_remaining_door_area_m2}
                            onChange={(value) =>
                              updateField(
                                "advanced_remaining_door_area_m2",
                                value
                              )
                            }
                          />
                        )}
                      </div>
                    </div>
                  </QuestionnaireSection>

                  <QuestionnaireSection
                    title="Sposób użytkowania budynku"
                    description="Pytania opisowe zastępują specjalistyczny pomiar szczelności i ręczny wybór strefy klimatycznej."
                  >
                    <div className="grid gap-5">
                      <ChoiceTileGroup
                        label="Jak ocenisz szczelność budynku?"
                        value={form.advanced_airtightness}
                        options={AIRTIGHTNESS_OPTIONS}
                        onChange={(value) =>
                          updateField("advanced_airtightness", value)
                        }
                      />
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field
                          label="Zwyczajowa temperatura w domu (°C)"
                          type="number"
                          min={16}
                          max={26}
                          step="0.5"
                          value={form.advanced_usual_indoor_temperature_c}
                          onChange={(value) =>
                            updateField(
                              "advanced_usual_indoor_temperature_c",
                              value
                            )
                          }
                        />
                        <ReadOnlyField
                          label="Strefa klimatyczna z kodu pocztowego klienta"
                          value={automaticClimateDescription}
                        />
                      </div>
                    </div>
                  </QuestionnaireSection>

                  <QuestionnaireSection
                    title="Przewidywany próg dochodowy"
                    description="Nie zapisujemy dokładnego dochodu — tylko wybrany przedział potrzebny do wstępnej oceny poziomu programu."
                  >
                    <div className="grid gap-5">
                      <ChoiceTileGroup
                        label="Rodzaj gospodarstwa"
                        value={form.advanced_household_type}
                        options={HOUSEHOLD_TYPE_OPTIONS}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            advanced_household_type: value,
                            advanced_income_band: "",
                          }))
                        }
                        compact
                      />
                      {advancedIncomeBandOptions.length > 0 && (
                        <ChoiceTileGroup
                          label="Wybierz przedział dochodowy"
                          value={form.advanced_income_band}
                          options={advancedIncomeBandOptions}
                          onChange={(value) =>
                            updateField("advanced_income_band", value)
                          }
                        />
                      )}
                    </div>
                  </QuestionnaireSection>

                  <AdvancedEnergySummary calculation={calculation.advancedEnergy} />
                </div>
              )}

              {activeWizardStep === "summary" && (
                <div className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-termo-600">
                        Klient
                      </p>
                      <h3 className="mt-2 text-xl font-black">
                        {selectedClient?.full_name ||
                          selectedClient?.company_name ||
                          "Nie wybrano klienta"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {[selectedClient?.street, selectedClient?.building_number, selectedClient?.city]
                          .filter(Boolean)
                          .join(" ") || "Brak adresu"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {form.planned_scope.map((scope) => (
                          <span
                            key={scope}
                            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-termo-400">
                        Status dokumentu
                      </p>
                      <p className="mt-2 text-2xl font-black">
                        {form.status === "completed" ? "Zakres zatwierdzony" : "Wersja robocza"}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Dokument opisuje zakres do wyceny. Nie jest ofertą ani umową.
                      </p>
                    </section>
                  </div>

                  <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-10 w-1 shrink-0 rounded-full bg-termo-500" />
                      <div>
                        <h3 className="text-lg font-black text-slate-950 dark:text-slate-100">
                          Zestawienie zakresu do wyceny
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Poniższe ilości i parametry zostaną przeniesione do dokumentu dla wykonawcy.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <ScopeResult
                        label="Ściany"
                        value={
                          wallsPlanned
                            ? calculation.workScope.wallAreaM2 !== null
                              ? `${formatArea(calculation.workScope.wallAreaM2)} m²`
                              : "Brak powierzchni"
                            : "Poza zakresem"
                        }
                      />
                      <ScopeResult
                        label="Dach / strop"
                        value={
                          form.planned_scope.includes(PREAUDIT_SCOPE.roofInsulation)
                            ? calculation.workScope.roofAreaM2 !== null
                              ? `${formatArea(calculation.workScope.roofAreaM2)} m²`
                              : "Brak powierzchni"
                            : "Poza zakresem"
                        }
                      />
                      <ScopeResult
                        label="Podłoga / strop nad piwnicą"
                        value={
                          form.planned_scope.includes(PREAUDIT_SCOPE.floorInsulation)
                            ? calculation.workScope.floorAreaM2 !== null
                              ? `${formatArea(calculation.workScope.floorAreaM2)} m²`
                              : "Brak powierzchni"
                            : "Poza zakresem"
                        }
                      />
                      <ScopeResult
                        label="Okna"
                        value={
                          windowsPlanned
                            ? `${calculation.workScope.windowCount} szt. • ${
                                calculation.workScope.windowAreaM2 !== null
                                  ? `${formatArea(calculation.workScope.windowAreaM2)} m²`
                                  : "brak wymiarów"
                              }`
                            : "Poza zakresem"
                        }
                      />
                      <ScopeResult
                        label="Drzwi"
                        value={
                          doorsPlanned
                            ? `${calculation.workScope.doorCount} szt. • ${
                                calculation.workScope.doorAreaM2 !== null
                                  ? `${formatArea(calculation.workScope.doorAreaM2)} m²`
                                  : "brak wymiarów"
                              }`
                            : "Poza zakresem"
                        }
                      />
                      <ScopeResult
                        label="Źródło ciepła"
                        value={
                          heatSourcePlanned
                            ? `${getOptionLabel(HEAT_SOURCE_OPTIONS, form.current_heat_source, "Nie wskazano")} → ${getOptionLabel(PLANNED_HEAT_SOURCE_OPTIONS, form.planned_heat_source, "Nie wskazano")}`
                            : "Poza zakresem"
                        }
                      />
                    </div>

                    {heatSourcePlanned && (
                      <div className="mt-4 rounded-2xl border border-slate-200 border-l-4 border-l-termo-500 bg-slate-50 p-4 dark:border-slate-700 dark:border-l-termo-500 dark:bg-slate-950">
                        <p className="text-xs font-black uppercase tracking-wide text-termo-700 dark:text-termo-300">
                          Moc źródła po modernizacji
                        </p>
                        {calculation.indicativeRequiredPowerKw !== null &&
                        calculation.indicativePowerMinKw !== null &&
                        calculation.indicativePowerMaxKw !== null ? (
                          <p className="mt-2 text-lg font-black">
                            {calculation.indicativeRequiredPowerKw} kW • przedział {calculation.indicativePowerMinKw}–{calculation.indicativePowerMaxKw} kW
                          </p>
                        ) : (
                          <>
                            <p className="mt-2 text-lg font-black">
                              Nie podajemy mocy bez wymaganej dokładności
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                              Brakuje: {calculation.powerEstimateMissingInputs.join(", ") || "danych do weryfikacji"}.
                            </p>
                          </>
                        )}
                        <p className="mt-3 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                          {calculation.disclaimer}
                        </p>
                      </div>
                    )}

                    {heatSourcePlanned && calculation.calculationAssumptions.length > 0 && (
                      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                        <summary className="cursor-pointer font-black">
                          Założenia użyte wyłącznie do oszacowania mocy
                        </summary>
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5">
                          {calculation.calculationAssumptions.map((assumption) => (
                            <li key={assumption}>{assumption}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </section>

                  {form.advanced_mode_enabled && (
                    <AdvancedEnergySummary calculation={calculation.advancedEnergy} />
                  )}

                  <label className="block text-sm font-black">
                    Uwagi dla wykonawcy i do wyceny
                    <textarea
                      value={form.notes}
                      onChange={(event) => updateField("notes", event.target.value)}
                      className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white p-4 font-normal outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
                    />
                  </label>

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      disabled={saving || !selectedClient}
                      onClick={() => savePreaudit("draft")}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
                    >
                      Zapisz wersję roboczą
                    </button>
                    <button
                      type="button"
                      disabled={saving || !selectedClient}
                      onClick={() => savePreaudit("completed")}
                      className="rounded-xl bg-termo-500 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-termo-200 transition hover:bg-termo-400 disabled:opacity-50 dark:shadow-black/30"
                    >
                      Zatwierdź zakres
                    </button>
                    <button
                      type="button"
                      disabled={generatingPdf || saving || !selectedClient}
                      onClick={downloadPdf}
                      className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    >
                      {generatingPdf ? "Generowanie…" : "Pobierz PDF"}
                    </button>
                  </div>
                </div>
              )}

              {activeWizardStep === lastBaseWizardStepId && (
                <label className="mt-6 flex cursor-pointer items-start gap-4 rounded-2xl border border-termo-200 bg-termo-50/60 p-4 transition hover:border-termo-400 dark:border-termo-500/40 dark:bg-termo-500/10 dark:hover:border-termo-400">
                  <input
                    type="checkbox"
                    checked={form.advanced_mode_enabled}
                    onChange={(event) =>
                      updateField("advanced_mode_enabled", event.target.checked)
                    }
                    className="mt-1 h-5 w-5 shrink-0 accent-termo-500"
                  />
                  <span>
                    <span className="block font-black text-slate-950 dark:text-white">
                      Tryb zaawansowany
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-slate-600 dark:text-slate-300">
                      Dodaj krótką, nieobowiązkową ankietę i oszacuj EU przed oraz po wybranej modernizacji, procent redukcji i wstępne warunki programu.
                    </span>
                  </span>
                </label>
              )}

              {nextWizardStep && activeValidationMessage && (
                <div
                  role="alert"
                  className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200"
                >
                  <span className="font-black">Uzupełnij dane, aby przejść dalej.</span>{" "}
                  {activeValidationMessage}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  disabled={!previousWizardStep}
                  onClick={() =>
                    previousWizardStep && setWizardStep(previousWizardStep.id)
                  }
                  className="rounded-xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 disabled:invisible dark:hover:bg-slate-800"
                >
                  ← Wstecz
                </button>
                {nextWizardStep ? (
                  <button
                    type="button"
                    disabled={!canContinue}
                    title={activeValidationMessage || undefined}
                    onClick={() => setWizardStep(nextWizardStep.id)}
                      className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:bg-termo-500 dark:text-white dark:shadow-none dark:hover:bg-termo-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                  >
                    Dalej: {nextWizardStep.label.toLocaleLowerCase("pl-PL")} →
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-slate-400">
                    Koniec ankiety
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {message && (
          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm dark:border-slate-700 dark:bg-slate-900">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}

function QuestionnaireSection({
  title,
  description,
  children,
  accent = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-termo-200 bg-termo-50/50 dark:border-termo-500/40 dark:bg-slate-900"
          : "border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FootprintShapeDiagram({
  shape,
  selected,
}: {
  shape: string;
  selected: boolean;
}) {
  const strokeClass = selected
    ? "stroke-termo-600 dark:stroke-termo-300"
    : "stroke-slate-500 dark:stroke-slate-300";
  const fillClass = selected
    ? "fill-termo-100 dark:fill-termo-500/20"
    : "fill-slate-100 dark:fill-slate-800";
  const commonProps = {
    className: `${fillClass} ${strokeClass}`,
    strokeWidth: 2.4,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      viewBox="0 0 120 64"
      className="h-16 w-full"
      role="img"
      aria-label="Schemat rzutu budynku"
    >
      {shape === "compact" && (
        <>
          <rect x="35" y="7" width="50" height="50" rx="4" {...commonProps} />
          <path d="M35 24h50M52 7v50" className={strokeClass} strokeWidth="1" opacity="0.35" />
        </>
      )}
      {shape === "elongated" && (
        <>
          <rect x="12" y="17" width="96" height="30" rx="4" {...commonProps} />
          <path d="M43 17v30M77 17v30" className={strokeClass} strokeWidth="1" opacity="0.35" />
        </>
      )}
      {shape === "irregular" && (
        <>
          <polygon
            points="17,10 70,10 70,24 103,24 103,55 52,55 52,43 17,43"
            {...commonProps}
          />
          <path d="M52 10v33M70 24h33" className={strokeClass} strokeWidth="1" opacity="0.35" />
        </>
      )}
      {shape === "unknown" && (
        <>
          <path
            d="M24 18c15-13 54-15 72 0 13 12 9 31-5 38-17 8-52 4-65-8-9-9-10-21-2-30Z"
            className={`${fillClass} ${strokeClass}`}
            strokeWidth="2.4"
            strokeDasharray="5 4"
          />
          <text
            x="60"
            y="43"
            textAnchor="middle"
            className="fill-slate-500 text-[30px] font-black dark:fill-slate-300"
          >
            ?
          </text>
        </>
      )}
    </svg>
  );
}

function FootprintShapeChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-black text-slate-800 dark:text-slate-100">
        {label}
      </legend>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        Wybierz schemat najbardziej zbliżony do obrysu budynku widzianego z góry.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`relative flex min-h-40 cursor-pointer flex-col rounded-2xl border p-3 transition ${
                selected
                  ? "border-termo-500 bg-termo-50 text-slate-950 ring-2 ring-termo-500/25 dark:bg-termo-500/15 dark:text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-termo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              }`}
            >
              <input
                type="radio"
                name={label}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900">
                {selected && (
                  <span className="h-2.5 w-2.5 rounded-full bg-termo-500" />
                )}
              </span>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1 dark:border-slate-700 dark:bg-slate-900">
                <FootprintShapeDiagram
                  shape={option.value}
                  selected={selected}
                />
              </div>
              <span className="mt-3 text-sm font-black leading-5">
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ChoiceTileGroup({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-black text-slate-800 dark:text-slate-100">
        {label}
      </legend>
      <div
        className={`mt-3 grid gap-2 ${
          compact ? "sm:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold leading-5 transition ${
                selected
                  ? "border-termo-500 bg-termo-50 text-slate-950 ring-1 ring-termo-500 dark:bg-termo-500/15 dark:text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-termo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              }`}
            >
              <input
                type="radio"
                name={label}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-termo-500"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function AdvancedEnergySummary({
  calculation,
}: {
  calculation: AdvancedEnergyResult;
}) {
  const formatEnergyRange = (range: { min: number; max: number } | null) =>
    range ? `${range.min}–${range.max} kWh/(m²·rok)` : "Brak wyniku";
  const formatReductionRange = (range: { min: number; max: number } | null) =>
    range ? `${range.min}–${range.max}%` : "Brak wyniku";

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white dark:border-termo-500/50 dark:bg-black">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-termo-400">
            Wynik ankiety zaawansowanej
          </p>
          <h3 className="mt-2 text-xl font-black">
            Szacowane zapotrzebowanie na energię użytkową
          </h3>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200">
          Pewność: {calculation.confidence}
          {calculation.uncertaintyPercent !== null
            ? ` • ±${calculation.uncertaintyPercent}%`
            : ""}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Result
          label="Przed modernizacją"
          value={formatEnergyRange(calculation.currentRange)}
        />
        <Result
          label="Po wybranej modernizacji"
          value={formatEnergyRange(calculation.postRange)}
        />
        <Result
          label="Szacowana redukcja"
          value={formatReductionRange(calculation.reductionRange)}
        />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-termo-500/40 bg-termo-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-termo-300">
            Warunek energetyczny programu
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {calculation.programmeAssessmentLabel}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-300">
            Próg dochodowy i ocena łączna
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {calculation.combinedAssessmentLabel}
          </p>
        </div>
      </div>
      {calculation.missingInputs.length > 0 && (
        <p className="mt-4 text-xs leading-5 text-amber-300">
          Wynik można zawęzić, uzupełniając: {calculation.missingInputs.join(", ")}.
        </p>
      )}
      <p className="mt-4 text-xs leading-5 text-slate-400">
        {calculation.disclaimer}
      </p>
    </section>
  );
}

function BooleanChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold text-slate-700 dark:text-slate-200">
        {label}
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {[
          { value: true, label: "Tak" },
          { value: false, label: "Nie" },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3 py-2.5 text-sm font-black transition ${
              value === option.value
                ? "bg-termo-500 text-white shadow-sm"
                : "text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="grid content-start gap-2 text-sm font-bold leading-5 text-slate-700 dark:text-slate-200">
      {label}
      <input
        type={type}
        min={type === "number" ? min ?? 0 : undefined}
        max={type === "number" ? max : undefined}
        step={type === "number" ? step ?? "0.1" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`block h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-normal text-slate-900 outline-none transition focus:border-termo-500 focus:ring-4 focus:ring-termo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-termo-500 dark:focus:ring-termo-500/20 ${
          type === "date" ? "ideatermo-date-input" : ""
        }`}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid content-start gap-2 text-sm font-bold leading-5 text-slate-700 dark:text-slate-200">
      {label}
      <input
        readOnly
        value={value}
        placeholder="Obliczy się automatycznie"
        className="block h-12 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
}) {
  return (
    <label className="grid content-start gap-2 text-sm font-bold leading-5 text-slate-700 dark:text-slate-200">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="block h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-normal text-slate-900 outline-none transition focus:border-termo-500 focus:ring-4 focus:ring-termo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-termo-500 dark:focus:ring-termo-500/20">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MaterialSelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
}) {
  const hasCatalogValue = options.some((option) => option.value === value);
  const selectValue = hasCatalogValue ? value : value ? "__other__" : "";
  const customValue =
    selectValue === "__other__" && value !== "__other__" ? value : "";

  return (
    <div>
      <SelectField
        label={label}
        value={selectValue}
        onChange={(nextValue) => onChange(nextValue)}
        options={[...options, { value: "__other__", label: "Inny – wpisz ręcznie" }]}
        placeholder="Proszę wybrać"
      />
      {selectValue === "__other__" && (
        <input
          aria-label={`${label} – wartość własna`}
          value={customValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Wpisz materiał"
          className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-termo-500 focus:ring-4 focus:ring-termo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-termo-500/20"
        />
      )}
    </div>
  );
}

function InsulationLayersField({
  label,
  value,
  maxLayers,
  onChange,
}: {
  label: string;
  value: InsulationLayerForm[];
  maxLayers: number;
  onChange: (value: InsulationLayerForm[]) => void;
}) {
  const selectedMaterials = new Set(value.map((layer) => layer.material));
  const reachedLimit = value.length >= maxLayers;

  function toggleMaterial(material: string) {
    if (selectedMaterials.has(material)) {
      onChange(value.filter((layer) => layer.material !== material));
      return;
    }
    if (reachedLimit) return;
    onChange([
      ...value,
      { material, custom_material: "", thickness_cm: "" },
    ]);
  }

  function updateLayer(
    material: string,
    key: "custom_material" | "thickness_cm",
    nextValue: string
  ) {
    onChange(
      value.map((layer) =>
        layer.material === material ? { ...layer, [key]: nextValue } : layer
      )
    );
  }

  return (
    <fieldset>
      <legend className="text-sm font-bold leading-5 text-slate-700 dark:text-slate-200">
        {label}
      </legend>
      <details className="group relative mt-2">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between rounded-xl border border-slate-300 bg-white px-4 text-sm font-normal text-slate-900 outline-none transition focus:border-termo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
          <span>
            {value.length
              ? `Wybrano ${value.length} z ${maxLayers}`
              : "Brak izolacji"}
          </span>
          <span
            aria-hidden="true"
            className="text-slate-400 transition group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/50">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-termo-50 dark:hover:bg-termo-500/10">
            <input
              type="checkbox"
              checked={value.length === 0}
              onChange={() => onChange([])}
              className="h-4 w-4 accent-termo-500"
            />
            Brak izolacji
          </label>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          {INSULATION_LAYER_OPTIONS.map((option) => {
            const selected = selectedMaterials.has(option.value);
            const disabled = !selected && reachedLimit;
            return (
              <label
                key={option.value}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-termo-50 dark:hover:bg-termo-500/10 ${
                  disabled
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onChange={() => toggleMaterial(option.value)}
                  className="h-4 w-4 accent-termo-500"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </details>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Możesz wskazać maksymalnie {maxLayers} warstwy. Dla każdej podaj jej
        grubość w pełnych centymetrach.
      </p>

      {value.length > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {value.map((layer, index) => {
            const label =
              INSULATION_LAYER_OPTIONS.find(
                (option) => option.value === layer.material
              )?.label || "Inny materiał";
            return (
              <div
                key={layer.material}
                className="rounded-2xl border border-termo-200 bg-termo-50/60 p-4 dark:border-termo-500/40 dark:bg-termo-500/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-termo-700 dark:text-termo-300">
                      Warstwa {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
                      {label}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleMaterial(layer.material)}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-300"
                  >
                    Usuń
                  </button>
                </div>
                <div
                  className={`mt-3 grid gap-3 ${
                    layer.material === "__other__" ? "sm:grid-cols-2" : ""
                  }`}
                >
                  {layer.material === "__other__" && (
                    <Field
                      label="Jaki materiał?"
                      value={layer.custom_material}
                      onChange={(nextValue) =>
                        updateLayer(
                          layer.material,
                          "custom_material",
                          nextValue
                        )
                      }
                    />
                  )}
                  <Field
                    label="Grubość (cm)"
                    type="number"
                    step="1"
                    value={layer.thickness_cm}
                    onChange={(nextValue) =>
                      updateLayer(
                        layer.material,
                        "thickness_cm",
                        nextValue
                      )
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function DimensionsEditor({
  dimensions,
  itemLabel,
  onChange,
}: {
  dimensions: DimensionForm[];
  itemLabel: string;
  onChange: (
    index: number,
    key: keyof DimensionForm,
    value: string
  ) => void;
}) {
  if (!dimensions.length) return null;

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {dimensions.map((dimension, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            {itemLabel} {index + 1}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field
              label="Szerokość (cm)"
              type="number"
              value={dimension.width_cm}
              onChange={(value) => onChange(index, "width_cm", value)}
            />
            <Field
              label="Wysokość (cm)"
              type="number"
              value={dimension.height_cm}
              onChange={(value) => onChange(index, "height_cm", value)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function WindowIcon({
  kind,
  selected,
}: {
  kind: WindowKind;
  selected: boolean;
}) {
  const sashWidth = 104 / kind.wings;
  return (
    <div className="flex items-start justify-between gap-3">
      <svg
        aria-hidden="true"
        viewBox="0 0 120 72"
        className={`h-16 w-28 rounded-lg border bg-white p-1 dark:bg-slate-950 ${
          selected ? "border-termo-300 text-termo-600 dark:border-termo-500 dark:text-termo-400" : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
        }`}
      >
        <rect x="7" y="6" width="106" height="60" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        {Array.from({ length: kind.wings }, (_, index) => {
          const x = 8 + sashWidth * index;
          const centerX = x + sashWidth / 2;
          return (
            <g key={index}>
              {index > 0 && (
                <line x1={x} y1="7" x2={x} y2="65" stroke="currentColor" strokeWidth="1.5" />
              )}
              {kind.operation === "turn" && (
                <path d={`M ${x + 3} 10 L ${x + sashWidth - 3} 36 L ${x + 3} 62`} fill="none" stroke="currentColor" strokeWidth="1.4" />
              )}
              {kind.operation === "tilt" && (
                <path d={`M ${x + 3} 62 L ${centerX} 10 L ${x + sashWidth - 3} 62`} fill="none" stroke="currentColor" strokeWidth="1.4" />
              )}
              {kind.operation === "tilt_turn" && (
                <>
                  <path d={`M ${x + 3} 10 L ${x + sashWidth - 3} 36 L ${x + 3} 62`} fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d={`M ${x + 3} 62 L ${centerX} 10 L ${x + sashWidth - 3} 62`} fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="3 2" />
                </>
              )}
              {kind.operation === "fixed" && (
                <rect x={x + 4} y="11" width={sashWidth - 8} height="50" fill="none" stroke="currentColor" strokeWidth="1" />
              )}
            </g>
          );
        })}
      </svg>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-black ${
          selected
            ? "border-termo-500 bg-termo-500 text-white"
            : "border-slate-300 text-transparent dark:border-slate-600"
        }`}
      >
        ✓
      </span>
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-termo-200 bg-white p-4 text-slate-950 dark:border-termo-800 dark:bg-slate-900 dark:text-white">
      <p className="text-xs font-black uppercase tracking-wide text-termo-700 dark:text-termo-300">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function ScopeResult({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

export default function IdeaTermoPreauditPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Ładowanie karty zakresu…</div>}>
      <PreauditContent />
    </Suspense>
  );
}
