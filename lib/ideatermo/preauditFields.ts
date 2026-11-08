export type SelectOption = {
  value: string;
  label: string;
};

export const BUILDING_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: "dom_jednorodzinny", label: "Dom jednorodzinny" },
  {
    value: "lokal_mieszkalny_w_budynku_wielorodzinnym",
    label: "Lokal mieszkalny w budynku wielorodzinnym",
  },
];

export const HOUSEHOLD_MEMBERS_OPTIONS: readonly SelectOption[] = [
  ...Array.from({ length: 9 }, (_, index) => {
    const value = String(index + 1);
    return { value, label: value };
  }),
  { value: "10", label: "10+" },
];

export type BuildingStoreysValue =
  | "ground_only"
  | "ground_plus_1"
  | "ground_plus_2"
  | "ground_plus_3";

export const BUILDING_STOREY_OPTIONS: readonly SelectOption[] = [
  { value: "ground_only", label: "Parterowy" },
  { value: "ground_plus_1", label: "Parter + 1 piętro" },
  { value: "ground_plus_2", label: "Parter + 2 piętra" },
  { value: "ground_plus_3", label: "Parter + 3 piętra" },
];

export type RoofTypeValue =
  | "flat"
  | "pitched_with_attic"
  | "pitched_without_attic";

export const ROOF_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: "flat", label: "Płaski" },
  { value: "pitched_with_attic", label: "Skośny z poddaszem" },
  { value: "pitched_without_attic", label: "Skośny bez poddasza" },
];

export const CLIMATE_ZONE_OPTIONS: readonly SelectOption[] = [
  { value: "I", label: "Strefa I (temp. projektowa −16°C)" },
  { value: "II", label: "Strefa II (temp. projektowa −18°C)" },
  { value: "III", label: "Strefa III (temp. projektowa −20°C)" },
  { value: "IV", label: "Strefa IV (temp. projektowa −22°C)" },
  { value: "V", label: "Strefa V (temp. projektowa −24°C)" },
];

export const VENTILATION_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: "natural", label: "Grawitacyjna / naturalna" },
  { value: "mechanical_exhaust", label: "Mechaniczna wywiewna" },
  {
    value: "balanced_without_heat_recovery",
    label: "Nawiewno-wywiewna bez odzysku ciepła",
  },
  {
    value: "balanced_with_heat_recovery",
    label: "Nawiewno-wywiewna z odzyskiem ciepła",
  },
];

export type HeatedLevelValue =
  | "basement"
  | "ground_floor"
  | "floor_1"
  | "floor_2"
  | "floor_3"
  | "attic"
  | "garage";

export type HeatedLevelOption = {
  value: HeatedLevelValue;
  label: string;
};

export const HEATED_LEVEL_LABELS: Record<HeatedLevelValue, string> = {
  basement: "Piwnica",
  ground_floor: "Parter",
  floor_1: "1. piętro",
  floor_2: "2. piętro",
  floor_3: "3. piętro",
  attic: "Poddasze",
  garage: "Garaż",
};

export function normalizeBuildingStoreys(
  value: unknown
): BuildingStoreysValue {
  return BUILDING_STOREY_OPTIONS.some((option) => option.value === value)
    ? (value as BuildingStoreysValue)
    : "ground_only";
}

export function normalizeRoofType(value: unknown): RoofTypeValue {
  return ROOF_TYPE_OPTIONS.some((option) => option.value === value)
    ? (value as RoofTypeValue)
    : "pitched_without_attic";
}

export function getAboveGroundFloorCount(value: BuildingStoreysValue) {
  switch (value) {
    case "ground_plus_1":
      return 1;
    case "ground_plus_2":
      return 2;
    case "ground_plus_3":
      return 3;
    default:
      return 0;
  }
}

export function getAvailableHeatedLevels(input: {
  buildingStoreys: BuildingStoreysValue;
  roofType: RoofTypeValue;
  hasBasement: boolean;
  hasIntegratedGarage: boolean;
}): HeatedLevelOption[] {
  const levels: HeatedLevelOption[] = [];
  if (input.hasBasement) {
    levels.push({ value: "basement", label: HEATED_LEVEL_LABELS.basement });
  }
  levels.push({ value: "ground_floor", label: HEATED_LEVEL_LABELS.ground_floor });

  const floorCount = getAboveGroundFloorCount(input.buildingStoreys);
  for (let floor = 1; floor <= floorCount; floor += 1) {
    const value = `floor_${floor}` as HeatedLevelValue;
    levels.push({ value, label: HEATED_LEVEL_LABELS[value] });
  }

  if (input.roofType === "pitched_with_attic") {
    levels.push({ value: "attic", label: HEATED_LEVEL_LABELS.attic });
  }
  if (input.hasIntegratedGarage) {
    levels.push({ value: "garage", label: HEATED_LEVEL_LABELS.garage });
  }
  return levels;
}

export const HEAT_SOURCE_OPTIONS: readonly SelectOption[] = [
  {
    value: "solid_fuel_below_class_5",
    label: "Kocioł na paliwo stałe poniżej 5. klasy",
  },
  {
    value: "solid_fuel_class_5",
    label: "Kocioł na paliwo stałe 5. klasy",
  },
  { value: "gas", label: "Gazowe" },
  { value: "electric", label: "Elektryczne" },
  { value: "other", label: "Inne" },
];

export const CURRENT_FUEL_OPTIONS: readonly SelectOption[] = [
  { value: "pellet", label: "Pellet" },
  { value: "hard_coal", label: "Węgiel" },
  { value: "eco_pea_coal", label: "Groszek / ekogroszek" },
  { value: "firewood", label: "Drewno opałowe" },
];

export const PLANNED_HEAT_SOURCE_OPTIONS: readonly SelectOption[] = [
  { value: "air_to_water_heat_pump", label: "Pompa ciepła powietrze–woda" },
  { value: "ground_source_heat_pump", label: "Pompa ciepła gruntowa" },
  { value: "pellet_boiler", label: "Kocioł na pellet" },
  {
    value: "wood_gasification_boiler",
    label: "Kocioł zgazowujący drewno",
  },
  { value: "electric_boiler", label: "Kocioł elektryczny" },
  { value: "other", label: "Inne / do ustalenia" },
];

export const HEATING_DISTRIBUTION_OPTIONS: readonly SelectOption[] = [
  { value: "radiators", label: "Grzejniki" },
  { value: "underfloor", label: "Ogrzewanie podłogowe" },
  { value: "mixed", label: "Instalacja mieszana" },
  { value: "other", label: "Inna / nie wiem" },
];

export const WOOD_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: "hardwood", label: "Głównie drewno liściaste twarde" },
  { value: "softwood", label: "Głównie drewno iglaste lub miękkie" },
  { value: "mixed", label: "Mieszane" },
  { value: "unknown", label: "Nie wiem" },
];

export const WOOD_SEASONING_OPTIONS: readonly SelectOption[] = [
  { value: "fresh", label: "Świeże lub sezonowane krócej niż rok" },
  { value: "seasoned", label: "Sezonowane około 1–2 lat" },
  { value: "dry", label: "Suche, sezonowane ponad 2 lata" },
  { value: "unknown", label: "Nie wiem" },
];

export const FUEL_CONSUMPTION_BASIS_OPTIONS: readonly SelectOption[] = [
  {
    value: "average_2_3_years",
    label: "Średnia z 2–3 pełnych sezonów grzewczych",
  },
  { value: "last_complete_season", label: "Ostatni pełny sezon grzewczy" },
  { value: "estimate", label: "Wartość szacunkowa" },
];

export const CURRENT_HEATING_PERFORMANCE_OPTIONS: readonly SelectOption[] = [
  {
    value: "maintains_temperature",
    label: "Tak, także podczas największych mrozów",
  },
  {
    value: "sometimes_underheated",
    label: "Czasami budynek jest niedogrzany",
  },
  {
    value: "frequently_underheated",
    label: "Często nie osiąga zadanej temperatury",
  },
  { value: "unknown", label: "Nie wiem" },
];

export const YES_NO_UNKNOWN_OPTIONS: readonly SelectOption[] = [
  { value: "yes", label: "Tak" },
  { value: "no", label: "Nie" },
  { value: "unknown", label: "Nie wiem" },
];

export const FOOTPRINT_SHAPE_OPTIONS: readonly SelectOption[] = [
  {
    value: "compact",
    label: "Zwarta – zbliżona do kwadratu",
  },
  {
    value: "elongated",
    label: "Wydłużona – wyraźnie dłuższa niż szersza",
  },
  {
    value: "irregular",
    label: "Nieregularna – uskoki, dobudówki lub kilka skrzydeł",
  },
  { value: "unknown", label: "Nie wiem" },
];

export const BASEMENT_COVERAGE_OPTIONS: readonly SelectOption[] = [
  { value: "full", label: "Piwnica jest pod całym budynkiem" },
  { value: "partial", label: "Piwnica jest tylko pod częścią budynku" },
  { value: "unknown", label: "Nie wiem" },
];

export const AIRTIGHTNESS_OPTIONS: readonly SelectOption[] = [
  {
    value: "leaky",
    label: "Nieszczelny – wyraźne przeciągi przy oknach lub drzwiach",
  },
  {
    value: "average",
    label: "Przeciętny – bez dużych przeciągów, standard starszego domu",
  },
  {
    value: "tight",
    label: "Szczelny – nowe okna i brak odczuwalnych nieszczelności",
  },
  { value: "unknown", label: "Nie wiem" },
];

export const HOUSEHOLD_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: "single", label: "Gospodarstwo jednoosobowe" },
  { value: "multi", label: "Gospodarstwo wieloosobowe" },
];

export function getIncomeBandOptions(
  householdType: "single" | "multi" | ""
): readonly SelectOption[] {
  if (householdType === "single") {
    return [
      { value: "highest", label: "Do 1 800 zł miesięcznie na osobę" },
      {
        value: "elevated",
        label: "Powyżej 1 800 zł do 3 150 zł miesięcznie na osobę",
      },
      {
        value: "basic",
        label: "Powyżej 3 150 zł; roczny dochód wnioskodawcy do 135 000 zł",
      },
      {
        value: "ineligible",
        label: "Roczny dochód wnioskodawcy powyżej 135 000 zł",
      },
    ];
  }
  if (householdType === "multi") {
    return [
      { value: "highest", label: "Do 1 300 zł miesięcznie na osobę" },
      {
        value: "elevated",
        label: "Powyżej 1 300 zł do 2 250 zł miesięcznie na osobę",
      },
      {
        value: "basic",
        label: "Powyżej 2 250 zł; roczny dochód wnioskodawcy do 135 000 zł",
      },
      {
        value: "ineligible",
        label: "Roczny dochód wnioskodawcy powyżej 135 000 zł",
      },
    ];
  }
  return [];
}

export function isSolidFuelHeatSource(value: string) {
  return value === "solid_fuel_below_class_5" || value === "solid_fuel_class_5";
}

export const WINDOW_GLAZING_OPTIONS: readonly SelectOption[] = [
  { value: "2021_plus_triple", label: "2021+ trzyszybowe" },
  { value: "2021_plus_double", label: "2021+ dwuszybowe" },
  { value: "2011_2020_triple", label: "2011–2020 trzyszybowe" },
  { value: "2011_2020_double", label: "2011–2020 dwuszybowe" },
  {
    value: "older_insulated_glass",
    label: "Starsze z szybami zespolonymi",
  },
  {
    value: "older_two_plain_panes",
    label: "Starsze z min. dwiema zwykłymi szybami",
  },
  {
    value: "older_single_plain_pane",
    label: "Starsze z pojedynczą zwykłą szybą",
  },
];

export const EXTERNAL_DOOR_OPTIONS: readonly SelectOption[] = [
  { value: "old_wooden", label: "Stare drewniane" },
  { value: "old_metal", label: "Stare metalowe" },
  { value: "new_wooden", label: "Nowe drewniane" },
  { value: "new_metal", label: "Nowe metalowe" },
  { value: "new_plastic", label: "Nowe z tworzywa" },
];

export const WALL_MATERIAL_OPTIONS: readonly SelectOption[] = [
  { value: "aerated_concrete", label: "Beton komórkowy" },
  { value: "ceramic_hollow_block", label: "Pustak ceramiczny" },
  { value: "solid_brick", label: "Cegła pełna" },
  {
    value: "perforated_or_lattice_brick",
    label: "Cegła dziurawka lub kratówka",
  },
  { value: "silicate", label: "Silikat" },
  {
    value: "concrete_or_reinforced_concrete",
    label: "Beton lub żelbet",
  },
  { value: "expanded_clay_concrete", label: "Keramzytobeton" },
  { value: "slag_concrete", label: "Żużlobeton lub pustak żużlowy" },
  { value: "timber_logs", label: "Drewno lub bale drewniane" },
  { value: "timber_frame", label: "Konstrukcja szkieletowa drewniana" },
  { value: "natural_stone", label: "Kamień naturalny" },
  { value: "clay", label: "Glina" },
  { value: "unknown", label: "Nie wiem" },
];
export const INSULATION_MATERIAL_OPTIONS: readonly SelectOption[] = [
  { value: "mineral_wool", label: "Wełna mineralna" },
  { value: "cellulose_or_granulate", label: "Celuloza lub ekofiber" },
  { value: "white_eps", label: "Styropian biały EPS" },
  { value: "graphite_eps", label: "Styropian grafitowy EPS" },
  { value: "xps", label: "Styropian twardy XPS" },
  { value: "pur_foam", label: "Piana PUR" },
  { value: "pir_pur_phenolic_board", label: "Płyta PIR" },
  { value: "expanded_clay", label: "Keramzyt" },
  { value: "wood_fiber", label: "Wełna drzewna" },
  { value: "wood_sawdust", label: "Trociny drzewne" },
  { value: "slag", label: "Żużel" },
  { value: "air_gap", label: "Pustka powietrzna" },
  { value: "unknown", label: "Nie wiem" },
];

export const PLANNED_INSULATION_MATERIAL_OPTIONS: readonly SelectOption[] =
  INSULATION_MATERIAL_OPTIONS.filter(
    (option) => option.value !== "air_gap" && option.value !== "unknown"
  );

export const PLANNED_WINDOW_U_VALUE_OPTIONS: readonly SelectOption[] = [
  { value: "0.7", label: "Uw 0,7 W/(m²·K) – bardzo ciepłe" },
  { value: "0.9", label: "Uw 0,9 W/(m²·K) – standard docelowy" },
  { value: "1.1", label: "Uw 1,1 W/(m²·K)" },
];

export const PLANNED_DOOR_U_VALUE_OPTIONS: readonly SelectOption[] = [
  { value: "0.9", label: "Ud 0,9 W/(m²·K) – bardzo ciepłe" },
  { value: "1.1", label: "Ud 1,1 W/(m²·K)" },
  { value: "1.3", label: "Ud 1,3 W/(m²·K) – standard docelowy" },
];

export const PREAUDIT_SCOPE = {
  wallInsulation: "Docieplenie ścian",
  roofInsulation: "Docieplenie dachu / stropu",
  floorInsulation: "Docieplenie podłogi",
  windowReplacement: "Wymiana okien",
  doorReplacement: "Wymiana drzwi",
  heatSourceModernization: "Modernizacja źródła ciepła",
  heatingInstallationModernization: "Modernizacja instalacji CO/CWU",
} as const;

export const PLANNED_SCOPE_OPTIONS = Object.values(PREAUDIT_SCOPE);

export type WindowOperation = "tilt_turn" | "turn" | "tilt" | "fixed";

export type WindowKind = {
  value: string;
  label: string;
  wings: 1 | 2 | 3;
  operation: WindowOperation;
};

const WINDOW_OPERATIONS: readonly {
  value: WindowOperation;
  label: string;
}[] = [
  { value: "tilt_turn", label: "uchylno-rozwierne" },
  { value: "turn", label: "rozwierne" },
  { value: "tilt", label: "uchylne" },
  { value: "fixed", label: "stałe" },
];

const WINDOW_WING_GROUPS = [
  { wings: 1 as const, label: "Jednoskrzydłowe" },
  { wings: 2 as const, label: "Dwuskrzydłowe" },
  { wings: 3 as const, label: "Trójskrzydłowe" },
];

export const WINDOW_KINDS: readonly WindowKind[] = WINDOW_WING_GROUPS.flatMap(
  ({ wings, label }) =>
    WINDOW_OPERATIONS.map(({ value, label: operationLabel }) => ({
      value: `${wings}_${value}`,
      label: `${label} – ${operationLabel}`,
      wings,
      operation: value,
    }))
);

export function getOptionLabel(
  options: readonly SelectOption[],
  value: unknown,
  fallback = "Brak danych"
) {
  if (typeof value !== "string" || !value) return fallback;
  return options.find((option) => option.value === value)?.label || value;
}

export function getWindowKindLabel(value: unknown) {
  if (typeof value !== "string" || !value) return "Nieznany rodzaj okna";
  return WINDOW_KINDS.find((kind) => kind.value === value)?.label || value;
}

export function calculateWallSurfaceArea(
  widthM: number | null,
  heightM: number | null,
  manualAreaM2: number | null
) {
  const area =
    manualAreaM2 !== null
      ? manualAreaM2
      : widthM !== null && heightM !== null
        ? widthM * heightM
        : null;

  return area !== null && Number.isFinite(area) && area >= 0
    ? Math.round(area * 100) / 100
    : null;
}
