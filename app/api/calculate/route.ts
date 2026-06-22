import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { calculateOffer } from "@/lib/calculator/calculateOffer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

type PanelItem = {
  name: string;
  displayName: string;
  powerWp: number;
  priceNet: number;
  catalogCardUrl?: string | null;
};

type InverterItem = {
  name: string;
  displayName: string;
  maxPvKw: number;
  priceNet: number;
  type: "ongrid" | "hybrid";
  batteryVoltageType?: "low_voltage" | "high_voltage" | null;
  catalogCardUrl?: string | null;
};

type StorageItem = {
  name: string;
  displayName: string;
  capacityKwh: number;
  voltageType: "low_voltage" | "high_voltage";
  priceNet: number;
  installationNet: number;
  catalogCardUrl?: string | null;
};

type AdditionalServiceInput = {
  id?: number;
  name?: string;
  price_net?: number;
  priceNet?: number;
  allows_quantity?: boolean;
  allowsQuantity?: boolean;
  quantity?: number;
};

const FALLBACK_PANELS: Record<string, PanelItem> = {
  AMERISOLAR_450_FB: {
    name: "AMERISOLAR 450 FB",
    displayName: "AMERISOLAR 450 FB",
    powerWp: 450,
    priceNet: 230,
  },
  HORAY_435_BIFACIAL: {
    name: "HORAY 435 BIFACIAL",
    displayName: "HORAY 435 BIFACIAL",
    powerWp: 435,
    priceNet: 240,
  },
};

const FALLBACK_INVERTERS: InverterItem[] = [
  { maxPvKw: 5.5, name: "Deye SUN-5K-SG04LP3-EU", displayName: "Deye SUN-5K-SG04LP3-EU", type: "hybrid", priceNet: 5223.25 },
  { maxPvKw: 6.8, name: "Deye SUN-6K-SG04LP3-EU", displayName: "Deye SUN-6K-SG04LP3-EU", type: "hybrid", priceNet: 5359.25 },
  { maxPvKw: 8.8, name: "Deye SUN-8K-SG04LP3-EU", displayName: "Deye SUN-8K-SG04LP3-EU", type: "hybrid", priceNet: 5478.25 },
  { maxPvKw: 10.8, name: "Deye SUN-10K-SG05LP3-EU", displayName: "Deye SUN-10K-SG05LP3-EU", type: "hybrid", priceNet: 5631.25 },
  { maxPvKw: 12.8, name: "Deye SUN-12K-SG05LP3-EU", displayName: "Deye SUN-12K-SG05LP3-EU", type: "hybrid", priceNet: 5780 },
  { maxPvKw: 14.8, name: "Deye SUN-14K-SG05LP3-EU-SM2", displayName: "Deye SUN-14K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 7089 },
  { maxPvKw: 15.8, name: "Deye SUN-15K-SG05LP3-EU-SM2", displayName: "Deye SUN-15K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 6630 },
  { maxPvKw: 18, name: "Deye SUN-16K-SG05LP3-EU-SM2", displayName: "Deye SUN-16K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 7650 },
  { maxPvKw: 999, name: "Deye SUN-20K-SG05LP3-EU-SM2", displayName: "Deye SUN-20K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 8946.25 },
  { maxPvKw: 5.5, name: "Falownik Sieciowy 5K", displayName: "Falownik Sieciowy 5K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 6.8, name: "Falownik Sieciowy 6K", displayName: "Falownik Sieciowy 6K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 8.8, name: "Falownik Sieciowy 8K", displayName: "Falownik Sieciowy 8K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 10.8, name: "Falownik Sieciowy 10K", displayName: "Falownik Sieciowy 10K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 12.8, name: "Falownik Sieciowy 12K", displayName: "Falownik Sieciowy 12K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 14.8, name: "Falownik Sieciowy 14K", displayName: "Falownik Sieciowy 14K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 15.8, name: "Falownik Sieciowy 15K", displayName: "Falownik Sieciowy 15K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 18, name: "Falownik Sieciowy 16K", displayName: "Falownik Sieciowy 16K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 999, name: "Falownik Sieciowy 20K", displayName: "Falownik Sieciowy 20K", type: "ongrid", priceNet: 1000 },
];

const FALLBACK_STORAGES: Record<string, StorageItem> = {
  none: {
    name: "Brak",
    displayName: "Brak",
    capacityKwh: 0,
    voltageType: "low_voltage",
    priceNet: 0,
    installationNet: 0,
  },
  ZBPOWER_10: {
    name: "ZBPOWER ZB-G512200 10 kWh",
    displayName: "ZBPOWER ZB-G512200 10 kWh",
    capacityKwh: 10,
    voltageType: "low_voltage",
    priceNet: 4394.5,
    installationNet: 1500,
  },
  ZBPOWER_16: {
    name: "ZBPOWER ZB-G512314 16 kWh",
    displayName: "ZBPOWER ZB-G512314 16 kWh",
    capacityKwh: 16,
    voltageType: "low_voltage",
    priceNet: 5372,
    installationNet: 1500,
  },
};

const ROOF_PLACEHOLDERS = {
  blacha: 1500,
  dachowka: 2000,
  papa: 2200,
  grunt: 4500,
};

const PLACEHOLDERS_NET = {
  protections: 1500,
  wiring: 800,
  transport: 500,
  documentation: 700,
  ems: 1200,
};

function getNumberOverride(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 90);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function grossFromNet(netValue: number, vatRate: number) {
  return roundMoney(netValue * (1 + vatRate / 100));
}

function beforeDiscountFromAfterDiscountGross(grossAfterDiscount: number) {
  return roundMoney(grossAfterDiscount * 1.1111);
}

function buildContractBreakdown(params: {
  includeSubsidy: boolean;
  hasPv: boolean;
  hasStorageSelected: boolean;
  shouldAddEms: boolean;
  vatRate: number;
  finalNet: number;
  additionalServicesNet: number;
  panelsCostNet: number;
  inverterCostNet: number;
  pvInstallationNet: number;
  roofExtraNet: number;
  storageCostNet: number;
  storageInstallationNet: number;
  protectionsNet: number;
  transportNet: number;
  documentationNet: number;
  marketingNet: number;
  managerFeeNet: number;
  managerMarginsNet: number;
  sellerCommissionNet: number;
  subsidyAllocation: {
    enabled: boolean;
    pvNet: number;
    storageNet: number;
    emsNet: number;
  };
}) {
  const backupAfterDiscountGross = 1;
  const backupBeforeDiscountGross = 3000;
  const backupAfterDiscountNet = roundMoney(backupAfterDiscountGross / (1 + params.vatRate / 100));

  const emsContractNet = params.shouldAddEms ? 4000 : 0;

  let pvAfterDiscountNet = 0;
  let storageAfterDiscountNet = 0;
  let emsAfterDiscountNet = emsContractNet;
  let additionalServicesAfterDiscountNet = params.additionalServicesNet;

  if (params.includeSubsidy && params.subsidyAllocation.enabled) {
    pvAfterDiscountNet = params.hasPv ? Math.max(1 / (1 + params.vatRate / 100), params.subsidyAllocation.pvNet) : 0;
    storageAfterDiscountNet = params.hasStorageSelected ? params.subsidyAllocation.storageNet : 0;
    emsAfterDiscountNet = params.shouldAddEms ? Math.max(emsContractNet, params.subsidyAllocation.emsNet) : 0;
  } else {
    const sharedCostsNet =
      params.protectionsNet +
      params.transportNet +
      params.documentationNet +
      params.marketingNet +
      params.managerFeeNet +
      params.managerMarginsNet +
      params.sellerCommissionNet;

    const sharedPvPartNet = params.hasPv && params.hasStorageSelected ? sharedCostsNet / 2 : params.hasPv ? sharedCostsNet : 0;
    const sharedStoragePartNet = params.hasPv && params.hasStorageSelected ? sharedCostsNet / 2 : params.hasStorageSelected ? sharedCostsNet : 0;

    pvAfterDiscountNet = params.hasPv
      ? params.panelsCostNet + params.inverterCostNet + params.pvInstallationNet + params.roofExtraNet + sharedPvPartNet
      : 0;

    storageAfterDiscountNet = params.hasStorageSelected
      ? params.storageCostNet + params.storageInstallationNet + sharedStoragePartNet
      : 0;

    if (params.shouldAddEms) {
      const emsDeltaNet = Math.max(emsContractNet - 1200, 0);
      const correctionBaseNet = pvAfterDiscountNet + storageAfterDiscountNet;

      if (correctionBaseNet > 0) {
        const pvShare = pvAfterDiscountNet / correctionBaseNet;
        const pvCorrection = roundMoney(emsDeltaNet * pvShare);
        const storageCorrection = roundMoney(emsDeltaNet - pvCorrection);

        pvAfterDiscountNet = Math.max(0, pvAfterDiscountNet - pvCorrection);
        storageAfterDiscountNet = Math.max(0, storageAfterDiscountNet - storageCorrection);
      }
    }
  }

  const knownNet = pvAfterDiscountNet + storageAfterDiscountNet + emsAfterDiscountNet + backupAfterDiscountNet + additionalServicesAfterDiscountNet;
  const netDifference = roundMoney(params.finalNet - knownNet);

  if (params.hasPv) {
    pvAfterDiscountNet = roundMoney(pvAfterDiscountNet + netDifference);
  } else if (params.hasStorageSelected) {
    storageAfterDiscountNet = roundMoney(storageAfterDiscountNet + netDifference);
  } else {
    additionalServicesAfterDiscountNet = roundMoney(additionalServicesAfterDiscountNet + netDifference);
  }

  const makeLine = (netAfterDiscount: number, fixedBeforeDiscountGross?: number) => {
    const afterDiscountGross = grossFromNet(Math.max(0, netAfterDiscount), params.vatRate);
    const beforeDiscountGross = fixedBeforeDiscountGross ?? beforeDiscountFromAfterDiscountGross(afterDiscountGross);

    return {
      netAfterDiscount: roundMoney(Math.max(0, netAfterDiscount)),
      grossAfterDiscount: afterDiscountGross,
      grossBeforeDiscount: beforeDiscountGross,
    };
  };

  return {
    pv: makeLine(pvAfterDiscountNet),
    storage: makeLine(storageAfterDiscountNet),
    ems: makeLine(emsAfterDiscountNet),
    backup: makeLine(backupAfterDiscountNet, backupBeforeDiscountGross),
    additionalServices: makeLine(additionalServicesAfterDiscountNet),
    total: {
      netAfterDiscount: roundMoney(params.finalNet),
      grossAfterDiscount: grossFromNet(params.finalNet, params.vatRate),
      grossBeforeDiscount: beforeDiscountFromAfterDiscountGross(grossFromNet(params.finalNet, params.vatRate)),
    },
  };
}

async function loadCatalogFromSupabase() {
  const [panelsResponse, invertersResponse, storagesResponse] = await Promise.all([
    supabase
      .from("panels")
      .select("code, name, display_name, power_wp, price_net, catalog_card_url, active")
      .eq("active", true),
    supabase
      .from("inverters")
      .select("name, display_name, type, battery_voltage_type, max_pv_kw, price_net, catalog_card_url, active")
      .eq("active", true)
      .order("max_pv_kw", { ascending: true }),
    supabase
      .from("storages")
      .select("code, name, display_name, capacity_kwh, voltage_type, price_net, installation_net, catalog_card_url, active")
      .eq("active", true),
  ]);

  const panelsFromDb = panelsResponse.data || [];
  const invertersFromDb = invertersResponse.data || [];
  const storagesFromDb = storagesResponse.data || [];

  const panels = panelsFromDb.length
    ? Object.fromEntries(
      panelsFromDb.map((panel: any) => [
        panel.code,
        {
          name: panel.name,
          displayName: panel.display_name || panel.name,
          powerWp: Number(panel.power_wp),
          priceNet: Number(panel.price_net),
          catalogCardUrl: panel.catalog_card_url || null,
        },
      ])
    )
    : FALLBACK_PANELS;

  const inverters = invertersFromDb.length
    ? invertersFromDb.map((inverter: any) => ({
      name: inverter.name,
      displayName: inverter.display_name || inverter.name,
      type: inverter.type,
      batteryVoltageType: inverter.battery_voltage_type || null,
      catalogCardUrl: inverter.catalog_card_url || null,
      maxPvKw: Number(inverter.max_pv_kw),
      priceNet: Number(inverter.price_net),
    }))
    : FALLBACK_INVERTERS;

  const storages = storagesFromDb.length
    ? Object.fromEntries(
      storagesFromDb.map((storage: any) => [
        storage.code,
        {
          name: storage.name,
          displayName: storage.display_name || storage.name,
          capacityKwh: Number(storage.capacity_kwh),
          voltageType: storage.voltage_type || "low_voltage",
          priceNet: Number(storage.price_net),
          installationNet: Number(storage.installation_net),
          catalogCardUrl: storage.catalog_card_url || null,
        },
      ])
    )
    : FALLBACK_STORAGES;

  if (!storages.none) {
    storages.none = FALLBACK_STORAGES.none;
  }

  return { panels, inverters, storages };
}

function buildPricing(
  body: any,
  catalog: {
    panels: Record<string, PanelItem>;
    inverters: InverterItem[];
    storages: Record<string, StorageItem>;
  }
) {
  const overrides = body.pricingOverrides || {};

  const panels = Object.fromEntries(
    Object.entries(catalog.panels).map(([code, panel]) => [
      code,
      {
        ...panel,
        priceNet: getNumberOverride(
          overrides?.panels?.[code]?.priceNet,
          panel.priceNet
        ),
      },
    ])
  ) as Record<string, PanelItem>;

  const inverters = catalog.inverters.map((inverter) => ({
    ...inverter,
    priceNet: getNumberOverride(
      overrides?.inverters?.[inverter.name]?.priceNet,
      inverter.priceNet
    ),
  }));

  const storages = Object.fromEntries(
    Object.entries(catalog.storages).map(([code, storage]) => [
      code,
      {
        ...storage,
        priceNet: getNumberOverride(
          overrides?.storages?.[code]?.priceNet,
          storage.priceNet
        ),
        installationNet: getNumberOverride(
          overrides?.storages?.[code]?.installationNet,
          storage.installationNet
        ),
      },
    ])
  ) as Record<string, StorageItem>;

  const roofPlaceholders = {
    blacha: getNumberOverride(overrides?.roof?.blacha, ROOF_PLACEHOLDERS.blacha),
    dachowka: getNumberOverride(overrides?.roof?.dachowka, ROOF_PLACEHOLDERS.dachowka),
    papa: getNumberOverride(overrides?.roof?.papa, ROOF_PLACEHOLDERS.papa),
    grunt: getNumberOverride(overrides?.roof?.grunt, ROOF_PLACEHOLDERS.grunt),
  };

  const placeholders = {
    protections: getNumberOverride(
      overrides?.placeholders?.protections,
      PLACEHOLDERS_NET.protections
    ),
    wiring: getNumberOverride(overrides?.placeholders?.wiring, PLACEHOLDERS_NET.wiring),
    transport: getNumberOverride(
      overrides?.placeholders?.transport,
      PLACEHOLDERS_NET.transport
    ),
    documentation: getNumberOverride(
      overrides?.placeholders?.documentation,
      PLACEHOLDERS_NET.documentation
    ),
    ems: getNumberOverride(overrides?.placeholders?.ems, PLACEHOLDERS_NET.ems),
  };

  const operatorPercent = clampPercent(
    getNumberOverride(overrides?.operator?.percent, 15)
  );

  const marketingNet = getNumberOverride(overrides?.margins?.marketing, 500);
  const margins = {
    marketingNet,

    ownersCount: getNumberOverride(
      overrides?.margins?.ownersCount,
      3
    ),

    pvSmallPerKw: getNumberOverride(
      overrides?.margins?.pvSmallPerKw,
      250
    ),

    pvSmallFixed: getNumberOverride(
      overrides?.margins?.pvSmallFixed,
      500
    ),

    pvLargePerKw: getNumberOverride(
      overrides?.margins?.pvLargePerKw,
      150
    ),

    pvLargeFixed: getNumberOverride(
      overrides?.margins?.pvLargeFixed,
      700
    ),

    storagePerOwner: getNumberOverride(
      overrides?.margins?.storagePerOwner,
      500
    ),

    managerFeeNet: getNumberOverride(
      overrides?.margins?.managerFeeNet,
      500
    ),
  };

  return {
    panels,
    inverters,
    storages,
    roofPlaceholders,
    placeholders,
    operatorPercent,
    margins,
    pvInstallationPerKwNet: getNumberOverride(
      overrides?.installation?.pvPerKwNet,
      500
    ),
  };
}

function calculateManagerOverrideNet(params: {
  pvPowerKw: number;
  hasPv: boolean;
  hasStorage: boolean;
  isStorageOnly: boolean;
  pricing: ReturnType<typeof buildPricing>;
}) {
  const { pvPowerKw, hasPv, hasStorage, isStorageOnly, pricing } = params;
  const config = pricing.margins;
  const ownersCount = Math.max(0, config.ownersCount);

  let pvOverridePerOwnerNet = 0;

  if (hasPv) {
    const isSmallPv = pvPowerKw <= 5;

    pvOverridePerOwnerNet = isSmallPv
      ? pvPowerKw * config.pvSmallPerKw + config.pvSmallFixed
      : pvPowerKw * config.pvLargePerKw + config.pvLargeFixed;
  }

  let storageOverridePerOwnerNet = 0;

  if (hasStorage) {
    storageOverridePerOwnerNet = config.storagePerOwner;
  }

  const perOwnerGrossBeforeOperatorNet =
    pvOverridePerOwnerNet + storageOverridePerOwnerNet;

  const totalGrossBeforeOperatorNet =
    perOwnerGrossBeforeOperatorNet * ownersCount;

  return {
    ownersCount,
    perOwnerGrossBeforeOperatorNet,
    totalGrossBeforeOperatorNet,
    pvOverridePerOwnerNet,
    storageOverridePerOwnerNet,
  };
}

export async function GET() {
  try {
    const [{ data: settingsRow, error: settingsError }, catalog] = await Promise.all([
      supabase
        .from("pricing_settings")
        .select(
          "installation_pv_per_kw, protections_cost, wiring_cost, transport_cost, documentation_cost, ems_cost, warranty_percent, marketing_cost, owners_count, pv_small_per_kw, pv_small_fixed, pv_large_per_kw, pv_large_fixed, storage_per_owner, manager_fee_percent"
        )
        .eq("id", 1)
        .single(),
      loadCatalogFromSupabase(),
    ]);

    if (settingsError) {
      console.warn("Nie udało się pobrać pricing_settings dla katalogu kalkulatora", settingsError);
    }

    return NextResponse.json({
      catalog,
      settingsRow: settingsRow || null,
    });
  } catch (error) {
    console.error("Nie udało się pobrać katalogu kalkulatora", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać katalogu kalkulatora",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const sellerProfileId =
    body?.advisor?.id ||
    body?.createdBy ||
    null;
  const sellerEmail = body?.advisor?.email || null;
  let currentUser: any = null;
  if (sellerProfileId) {
    const { data: resolvedProfile } = await supabase
      .from("profiles")
      .select("id, role, manager_id, display_name, email")
      .eq("id", sellerProfileId)
      .maybeSingle();
    if (resolvedProfile) {
      currentUser = resolvedProfile;
    }
  }
  if ((!currentUser || !currentUser.manager_id) && sellerEmail) {
    const { data: resolvedByEmail } = await supabase
      .from("profiles")
      .select("id, role, manager_id, display_name, email")
      .eq("email", sellerEmail)
      .maybeSingle();
    if (resolvedByEmail) {
      currentUser = resolvedByEmail;
    }
  }
  const [{ data: settingsRow }, catalog] = await Promise.all([
    supabase
      .from("pricing_settings")
      .select(
        "installation_pv_per_kw, protections_cost, wiring_cost, transport_cost, documentation_cost, ems_cost, warranty_percent, marketing_cost, owners_count, pv_small_per_kw, pv_small_fixed, pv_large_per_kw, pv_large_fixed, storage_per_owner, manager_fee_percent"
      )
      .eq("id", 1)
      .single(),
    loadCatalogFromSupabase(),
  ]);

  try {
    const result = calculateOffer({
      body,
      catalog,
      currentUser,
      settingsRow,
      nodeEnv: process.env.NODE_ENV,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Błąd kalkulacji oferty", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się przeliczyć oferty",
      },
      { status: 400 }
    );
  }
}