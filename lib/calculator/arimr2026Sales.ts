type JsonRecord = Record<string, unknown>;

export type CalculatorProgram = "standard" | "arimr2026";

export type Arimr2026ProgramSettings = {
  planKw: number;
  pvPlanKwPerKwp: number;
  storagePlanKwPerUnit: number;
  pvCompensationNetPerKwp: number;
  storageCompensationNetPerKwh: number;
  maxMultiplierPercent: number;
};

export type Arimr2026AdvisorProgramRow = {
  advisorId: string;
  advisorName: string;
  salesCount: number;
  pvPowerKwp: number;
  storageUnits: number;
  storageCapacityKwh: number;
  planContributionKw: number;
  planKw: number;
  planCompletionPercent: number;
  payoutMultiplierPercent: number;
  pvCompensationNet: number;
  storageCompensationNet: number;
  compensationNet: number;
};

export type Arimr2026ProgramSummary = {
  salesCount: number;
  pvPowerKwp: number;
  storageUnits: number;
  storageCapacityKwh: number;
  planContributionKw: number;
  compensationNet: number;
  advisors: Arimr2026AdvisorProgramRow[];
};

export const DEFAULT_ARIMR_2026_PROGRAM_SETTINGS: Arimr2026ProgramSettings = {
  planKw: 40,
  pvPlanKwPerKwp: 1,
  storagePlanKwPerUnit: 5,
  pvCompensationNetPerKwp: 200,
  storageCompensationNetPerKwh: 150,
  maxMultiplierPercent: 150,
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readPath(source: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    const record = asRecord(current);
    return record ? record[key] : undefined;
  }, source);
}

function firstString(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const value = readPath(source, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function firstNumber(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value === null || value === undefined || value === "") continue;

    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return Math.max(0, numberValue);
  }

  return 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getInstallationCount(source: unknown) {
  const savedCount = firstNumber(source, [
    ["installation_count"],
    ["installationCount"],
    ["customer_data", "installation_count"],
    ["customer_data", "installationCount"],
    ["offer_data", "installation_count"],
    ["offer_data", "installationCount"],
    ["offer_snapshot", "installation_count"],
    ["offer_snapshot", "installationCount"],
    ["offer_snapshot", "offer_data", "installationCount"],
  ]);

  return savedCount > 0 ? Math.min(Math.max(Math.floor(savedCount), 1), 100) : 1;
}

function normalizeProgram(value: string) {
  return value.toLocaleLowerCase("pl-PL").replace(/[^a-z0-9]/g, "");
}

export function getCalculatorProgram(source: unknown): CalculatorProgram {
  const program = normalizeProgram(
    firstString(source, [
      ["calculator_program"],
      ["sales_program"],
      ["calculatorProgram"],
      ["customer_data", "calculator_program"],
      ["customer_data", "sales_program"],
      ["customer_data", "calculatorProgram"],
      ["offer_data", "calculator_program"],
      ["offer_data", "calculatorProgram"],
      ["offer_data", "result", "calculatorProgram"],
      ["offer_data", "form", "calculatorProgram"],
      ["offer_snapshot", "calculator_program"],
      ["offer_snapshot", "calculatorProgram"],
      ["offer_snapshot", "offer_data", "calculator_program"],
      ["offer_snapshot", "offer_data", "calculatorProgram"],
      ["offer_snapshot", "offer_data", "result", "calculatorProgram"],
      ["offer_snapshot", "offer_data", "form", "calculatorProgram"],
    ])
  );

  return program === "arimr2026" || program === "armir2026"
    ? "arimr2026"
    : "standard";
}

export function isArimr2026Sale(source: unknown) {
  return getCalculatorProgram(source) === "arimr2026";
}

function getSaleSellerId(source: unknown) {
  return firstString(source, [
    ["seller_id"],
    ["created_by"],
    ["assigned_user_id"],
    ["user_id"],
  ]);
}

function getSaleStatus(source: unknown) {
  return firstString(source, [["status"]])
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isArimr2026SaleCountedInProgram(source: unknown) {
  if (!isArimr2026Sale(source)) return false;

  const status = getSaleStatus(source);
  return !(
    status.includes("anul") ||
    status.includes("utrac") ||
    status.includes("rezygn") ||
    status.includes("nieurat")
  );
}

function getArimr2026SaleQuantities(source: unknown) {
  const pvPowerKwp = firstNumber(source, [
    ["pv_power_kw"],
    ["pvPowerKw"],
    ["customer_data", "pv_power_kw"],
    ["customer_data", "pvPowerKw"],
    ["offer_data", "pv_power_kw"],
    ["offer_data", "result", "pvPowerKw"],
    ["offer_snapshot", "pv_power_kw"],
    ["offer_snapshot", "offer_data", "result", "pvPowerKw"],
  ]);
  const storageCapacityKwh = firstNumber(source, [
    ["storage_capacity_kwh"],
    ["storageCapacityKwh"],
    ["customer_data", "storage_capacity_kwh"],
    ["customer_data", "storageCapacityKwh"],
    ["offer_data", "storage_capacity_kwh"],
    ["offer_data", "result", "storageCapacityKwh"],
    ["offer_snapshot", "storage_capacity_kwh"],
    ["offer_snapshot", "offer_data", "result", "storageCapacityKwh"],
  ]);
  const storageUnits = storageCapacityKwh > 0 ? getInstallationCount(source) : 0;

  return { pvPowerKwp, storageCapacityKwh, storageUnits };
}

export function getArimr2026ProgramSettings(
  pricingSettings: unknown
): Arimr2026ProgramSettings {
  const defaults = DEFAULT_ARIMR_2026_PROGRAM_SETTINGS;
  const readSetting = (key: string, fallback: number) => {
    const value = Number(asRecord(pricingSettings)?.[key]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };

  return {
    planKw: Math.max(
      0.1,
      readSetting("arimr_seller_program_plan_kw", readSetting("arimr_seller_monthly_plan_kw", defaults.planKw))
    ),
    pvPlanKwPerKwp: readSetting("arimr_seller_pv_plan_kw_per_kwp", defaults.pvPlanKwPerKwp),
    storagePlanKwPerUnit: readSetting(
      "arimr_seller_storage_plan_kw_per_unit",
      defaults.storagePlanKwPerUnit
    ),
    pvCompensationNetPerKwp: readSetting(
      "arimr_seller_pv_compensation_net_per_kwp",
      defaults.pvCompensationNetPerKwp
    ),
    storageCompensationNetPerKwh: readSetting(
      "arimr_seller_storage_compensation_net_per_kwh",
      defaults.storageCompensationNetPerKwh
    ),
    maxMultiplierPercent: readSetting(
      "arimr_seller_max_multiplier_percent",
      defaults.maxMultiplierPercent
    ),
  };
}

export function summarizeArimr2026Program(
  sales: unknown[],
  advisors: Array<{ id: string; name: string }>,
  settings: Arimr2026ProgramSettings = DEFAULT_ARIMR_2026_PROGRAM_SETTINGS
): Arimr2026ProgramSummary {
  const advisorRows = new Map<string, Arimr2026AdvisorProgramRow>(
    advisors.map((advisor) => [
      advisor.id,
      {
        advisorId: advisor.id,
        advisorName: advisor.name,
        salesCount: 0,
        pvPowerKwp: 0,
        storageUnits: 0,
        storageCapacityKwh: 0,
        planContributionKw: 0,
        planKw: settings.planKw,
        planCompletionPercent: 0,
        payoutMultiplierPercent: 0,
        pvCompensationNet: 0,
        storageCompensationNet: 0,
        compensationNet: 0,
      },
    ])
  );

  sales.filter(isArimr2026SaleCountedInProgram).forEach((sale) => {
    const sellerId = getSaleSellerId(sale);
    const row = advisorRows.get(sellerId);
    if (!row) return;

    const quantities = getArimr2026SaleQuantities(sale);
    row.salesCount += 1;
    row.pvPowerKwp += quantities.pvPowerKwp;
    row.storageUnits += quantities.storageUnits;
    row.storageCapacityKwh += quantities.storageCapacityKwh;
  });

  const rows = Array.from(advisorRows.values()).map((row) => {
    const planContributionKw =
      row.pvPowerKwp * settings.pvPlanKwPerKwp +
      row.storageUnits * settings.storagePlanKwPerUnit;
    const planCompletionPercent =
      settings.planKw > 0 ? (planContributionKw / settings.planKw) * 100 : 0;
    const payoutMultiplierPercent = Math.min(
      planCompletionPercent,
      settings.maxMultiplierPercent
    );
    const multiplier = payoutMultiplierPercent / 100;
    const pvCompensationNet =
      row.pvPowerKwp * settings.pvCompensationNetPerKwp * multiplier;
    const storageCompensationNet =
      row.storageCapacityKwh * settings.storageCompensationNetPerKwh * multiplier;

    return {
      ...row,
      pvPowerKwp: roundMoney(row.pvPowerKwp),
      storageCapacityKwh: roundMoney(row.storageCapacityKwh),
      planContributionKw: roundMoney(planContributionKw),
      planCompletionPercent: roundMoney(planCompletionPercent),
      payoutMultiplierPercent: roundMoney(payoutMultiplierPercent),
      pvCompensationNet: roundMoney(pvCompensationNet),
      storageCompensationNet: roundMoney(storageCompensationNet),
      compensationNet: roundMoney(pvCompensationNet + storageCompensationNet),
    };
  });

  return {
    salesCount: rows.reduce((sum, row) => sum + row.salesCount, 0),
    pvPowerKwp: roundMoney(rows.reduce((sum, row) => sum + row.pvPowerKwp, 0)),
    storageUnits: rows.reduce((sum, row) => sum + row.storageUnits, 0),
    storageCapacityKwh: roundMoney(
      rows.reduce((sum, row) => sum + row.storageCapacityKwh, 0)
    ),
    planContributionKw: roundMoney(
      rows.reduce((sum, row) => sum + row.planContributionKw, 0)
    ),
    compensationNet: roundMoney(
      rows.reduce((sum, row) => sum + row.compensationNet, 0)
    ),
    advisors: rows.sort(
      (first, second) =>
        second.planCompletionPercent - first.planCompletionPercent ||
        second.compensationNet - first.compensationNet ||
        first.advisorName.localeCompare(second.advisorName, "pl")
    ),
  };
}
