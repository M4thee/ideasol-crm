import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";

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
  powerWp: number;
  priceNet: number;
};

type InverterItem = {
  name: string;
  type: string;
  maxPvKw: number;
  priceNet: number;
};

type StorageItem = {
  name: string;
  capacityKwh: number;
  priceNet: number;
  installationNet: number;
};

const FALLBACK_PANELS: Record<string, PanelItem> = {
  AMERISOLAR_450_FB: {
    name: "AMERISOLAR 450 FB",
    powerWp: 450,
    priceNet: 230,
  },
  HORAY_435_BIFACIAL: {
    name: "HORAY 435 BIFACIAL",
    powerWp: 435,
    priceNet: 240,
  },
};

const FALLBACK_INVERTERS: InverterItem[] = [
  { maxPvKw: 5.5, name: "Deye SUN-5K-SG04LP3-EU", type: "hybrid", priceNet: 5223.25 },
  { maxPvKw: 6.8, name: "Deye SUN-6K-SG04LP3-EU", type: "hybrid", priceNet: 5359.25 },
  { maxPvKw: 8.8, name: "Deye SUN-8K-SG04LP3-EU", type: "hybrid", priceNet: 5478.25 },
  { maxPvKw: 10.8, name: "Deye SUN-10K-SG05LP3-EU", type: "hybrid", priceNet: 5631.25 },
  { maxPvKw: 12.8, name: "Deye SUN-12K-SG05LP3-EU", type: "hybrid", priceNet: 5780 },
  { maxPvKw: 14.8, name: "Deye SUN-14K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 7089 },
  { maxPvKw: 15.8, name: "Deye SUN-15K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 6630 },
  { maxPvKw: 18, name: "Deye SUN-16K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 7650 },
  { maxPvKw: 999, name: "Deye SUN-20K-SG05LP3-EU-SM2", type: "hybrid", priceNet: 8946.25 },
  { maxPvKw: 5.5, name: "Falownik Sieciowy 5K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 6.8, name: "Falownik Sieciowy 6K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 8.8, name: "Falownik Sieciowy 8K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 10.8, name: "Falownik Sieciowy 10K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 12.8, name: "Falownik Sieciowy 12K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 14.8, name: "Falownik Sieciowy 14K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 15.8, name: "Falownik Sieciowy 15K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 18, name: "Falownik Sieciowy 16K", type: "ongrid", priceNet: 1000 },
  { maxPvKw: 999, name: "Falownik Sieciowy 20K", type: "ongrid", priceNet: 1000 },
];

const FALLBACK_STORAGES: Record<string, StorageItem> = {
  none: {
    name: "Brak",
    capacityKwh: 0,
    priceNet: 0,
    installationNet: 0,
  },
  ZBPOWER_10: {
    name: "ZBPOWER ZB-G512200 10 kWh",
    capacityKwh: 10,
    priceNet: 4394.5,
    installationNet: 1500,
  },
  ZBPOWER_16: {
    name: "ZBPOWER ZB-G512314 16 kWh",
    capacityKwh: 16,
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

async function loadCatalogFromSupabase() {
  const [panelsResponse, invertersResponse, storagesResponse] = await Promise.all([
    supabase
      .from("panels")
      .select("code, name, power_wp, price_net, active")
      .eq("active", true),
    supabase
      .from("inverters")
      .select("name, type, max_pv_kw, price_net, active")
      .eq("active", true)
      .order("max_pv_kw", { ascending: true }),
    supabase
      .from("storages")
      .select("code, name, capacity_kwh, price_net, installation_net, active")
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
            powerWp: Number(panel.power_wp),
            priceNet: Number(panel.price_net),
          },
        ])
      )
    : FALLBACK_PANELS;

  const inverters = invertersFromDb.length
    ? invertersFromDb.map((inverter: any) => ({
        name: inverter.name,
        type: inverter.type,
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
            capacityKwh: Number(storage.capacity_kwh),
            priceNet: Number(storage.price_net),
            installationNet: Number(storage.installation_net),
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

export async function POST(request: Request) {
  const body = await request.json();

  const authProfile = await getCurrentProfile();

  const sellerProfileId =
    body?.advisor?.id ||
    body?.createdBy ||
    null;

  const sellerEmail = body?.advisor?.email || null;

  let currentUser = authProfile;

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
      .select("*")
      .eq("id", 1)
      .single(),
    loadCatalogFromSupabase(),
  ]);

  const currentOverrides = body.pricingOverrides || {};

  body.pricingOverrides = {
    ...currentOverrides,
    installation: {
      ...(currentOverrides.installation || {}),
      pvPerKwNet: Number(
        settingsRow?.installation_pv_per_kw ??
          currentOverrides?.installation?.pvPerKwNet ??
          500
      ),
    },
    placeholders: {
      ...(currentOverrides.placeholders || {}),
      protections: Number(
        settingsRow?.protections_cost ??
          currentOverrides?.placeholders?.protections ??
          1500
      ),
      wiring: Number(
        settingsRow?.wiring_cost ?? currentOverrides?.placeholders?.wiring ?? 800
      ),
      transport: Number(
        settingsRow?.transport_cost ??
          currentOverrides?.placeholders?.transport ??
          500
      ),
      documentation: Number(
        settingsRow?.documentation_cost ??
          currentOverrides?.placeholders?.documentation ??
          700
      ),
      ems: Number(
        settingsRow?.ems_cost ?? currentOverrides?.placeholders?.ems ?? 1200
      ),
    },
    operator: {
      ...(currentOverrides.operator || {}),
      percent: Number(
        settingsRow?.warranty_percent ?? currentOverrides?.operator?.percent ?? 15
      ),
    },
    margins: {
      ...(currentOverrides.margins || {}),
      marketing: Number(
        settingsRow?.marketing_cost ?? currentOverrides?.margins?.marketing ?? 500
      ),

      ownersCount: Number(
        settingsRow?.owners_count ??
          currentOverrides?.margins?.ownersCount ??
          3
      ),

      pvSmallPerKw: Number(
        settingsRow?.pv_small_per_kw ??
          currentOverrides?.margins?.pvSmallPerKw ??
          250
      ),

      pvSmallFixed: Number(
        settingsRow?.pv_small_fixed ??
          currentOverrides?.margins?.pvSmallFixed ??
          500
      ),

      pvLargePerKw: Number(
        settingsRow?.pv_large_per_kw ??
          currentOverrides?.margins?.pvLargePerKw ??
          150
      ),

      pvLargeFixed: Number(
        settingsRow?.pv_large_fixed ??
          currentOverrides?.margins?.pvLargeFixed ??
          700
      ),

      storagePerOwner: Number(
        settingsRow?.storage_per_owner ??
          currentOverrides?.margins?.storagePerOwner ??
          500
      ),

      managerFeeNet: Number(
        settingsRow?.manager_fee_percent ??
          currentOverrides?.margins?.managerFeeNet ??
          500
      ),
    },
  };

  const pricing = buildPricing(body, catalog);

  const offerType = String(body.offerType || "pv_storage");
  const isStorageOnly = offerType === "storage";
  const isPvOnly = offerType === "pv";
  const hasPv = !isStorageOnly;

  const billingSystem =
    body.billingSystem === "net_metering"
      ? "net_metering"
      : "net_billing";

  const shouldAddEms = Boolean(body.withEms);

  const panel = pricing.panels[body.panelModel as keyof typeof pricing.panels];
  const requestedStorageKey = isPvOnly ? "none" : body.storage;
  const storage = pricing.storages[requestedStorageKey as keyof typeof pricing.storages];

  if ((!panel && !isStorageOnly) || !storage) {
    return NextResponse.json(
      { error: "Nieprawidłowe dane formularza" },
      { status: 400 }
    );
  }

  const panelCount = Number(body.panelCount || 0);
  const sellerMarkupNet = Number(body.sellerMarkup || 0);
  const vatRate = Number(body.vatRate || 8);
  const roofType = body.roofType as keyof typeof pricing.roofPlaceholders;

  const pvPowerKw = isStorageOnly
    ? 0
    : Number(((panelCount * panel.powerWp) / 1000).toFixed(2));

  const hasStorageSelected = storage.name !== "Brak";
  const selectedInverterName = String(body.selectedInverterName || "auto");

  const manuallySelectedInverter =
    selectedInverterName !== "auto" && selectedInverterName !== "none"
      ? pricing.inverters.find((item) => item.name === selectedInverterName)
      : null;

  const autoInverterType = isStorageOnly || hasStorageSelected ? "hybrid" : "ongrid";

  const automaticallySelectedInverter =
    pricing.inverters.find(
      (item) => item.type === autoInverterType && pvPowerKw <= item.maxPvKw
    ) || pricing.inverters.find((item) => pvPowerKw <= item.maxPvKw);

  const inverter =
    selectedInverterName === "none"
      ? { name: "Brak", priceNet: 0 }
      : manuallySelectedInverter || automaticallySelectedInverter || { name: "Brak", priceNet: 0 };

  const panelsCostNet = isStorageOnly ? 0 : panelCount * panel.priceNet;
  const inverterCostNet = inverter.priceNet;
  const pvInstallationNet = isStorageOnly
    ? 0
    : pvPowerKw * pricing.pvInstallationPerKwNet;

  const roofExtraNet = isStorageOnly
    ? 0
    : pricing.roofPlaceholders[roofType] ?? 2000;

  const emsNet = shouldAddEms ? pricing.placeholders.ems : 0;

  const placeholdersTotalNet =
    pricing.placeholders.protections +
    pricing.placeholders.wiring +
    pricing.placeholders.transport +
    pricing.placeholders.documentation +
    emsNet;

  const purchaseCostNet =
    panelsCostNet +
    inverterCostNet +
    pvInstallationNet +
    roofExtraNet +
    storage.priceNet +
    storage.installationNet +
    placeholdersTotalNet;

  const managerOverride = calculateManagerOverrideNet({
    pvPowerKw,
    hasPv,
    hasStorage: hasStorageSelected,
    isStorageOnly,
    pricing,
  });

  const operatorPercent = pricing.operatorPercent;

  const grossManagerMarginsBeforeOperatorNet =
    managerOverride.totalGrossBeforeOperatorNet;

  const marketingNet = pricing.margins.marketingNet;

const shouldApplyManagerFee = Boolean(
  currentUser?.role === "seller" && currentUser?.manager_id
);

let managerFeeMultiplier = 0;

if (shouldApplyManagerFee) {
  if (hasPv) {
    managerFeeMultiplier += 1;
  }

  if (hasStorageSelected) {
    managerFeeMultiplier += 1;
  }
}

const managerFeeNet = Math.round(
  pricing.margins.managerFeeNet * managerFeeMultiplier
);

const finalNet = Math.round(
  purchaseCostNet +
    grossManagerMarginsBeforeOperatorNet +
    sellerMarkupNet +
    marketingNet +
    managerFeeNet
);

const operatorFeeNet = Math.round(finalNet * (operatorPercent / 100));
const sellerWarrantyFeeNet = Math.round(
  sellerMarkupNet * (operatorPercent / 100)
);

const sellerCommissionNet = Math.max(
  0,
  sellerMarkupNet
);


  const managerWarrantyFeeNet = Math.max(0, operatorFeeNet - sellerWarrantyFeeNet);

  const operatorFeePerOwnerNet =
    managerOverride.ownersCount > 0
      ? Math.round(managerWarrantyFeeNet / managerOverride.ownersCount)
      : 0;

  const managerMarginAfterOperatorTotalNet = Math.max(
    0,
    grossManagerMarginsBeforeOperatorNet - managerWarrantyFeeNet
  );

  const managerMarginAfterOperatorPerOwnerNet =
    managerOverride.ownersCount > 0
      ? Math.round(managerMarginAfterOperatorTotalNet / managerOverride.ownersCount)
      : 0;

  const finalGross = Math.round(finalNet * (1 + vatRate / 100));

  const companyMargin = Math.round(
    managerMarginAfterOperatorTotalNet +
      managerFeeNet
  );

  const subsidyProgramCap = billingSystem === "net_billing" ? 16000 : 8000;
  const hasStorageForSubsidy = hasStorageSelected && storage.capacityKwh >= 10;
  const storageCapByKwh = storage.capacityKwh * 800;
  const maxStorageSubsidy = hasStorageForSubsidy
    ? Math.min(storageCapByKwh, subsidyProgramCap)
    : 0;

  const optimizedEmsNet = shouldAddEms
    ? Math.min(4000, finalNet)
    : 0;

  const availableForStorageAfterEmsNet = Math.max(finalNet - optimizedEmsNet, 0);
  const idealStorageNetForMaxSubsidy = maxStorageSubsidy / 0.3;

  const optimizedStorageNet = hasStorageForSubsidy
    ? Math.min(idealStorageNetForMaxSubsidy, availableForStorageAfterEmsNet)
    : 0;

  const storageSubsidy = hasStorageForSubsidy
    ? Math.min(
        optimizedStorageNet * 0.3,
        storageCapByKwh,
        subsidyProgramCap
      )
    : 0;

  const emsBonus = shouldAddEms
    ? Math.min(optimizedEmsNet * 0.5, 2000)
    : 0;

  const optimizedPvNet = Math.max(
    finalNet - optimizedStorageNet - optimizedEmsNet,
    0
  );

  const subsidyTotal = Math.round(storageSubsidy + emsBonus);

  const subsidyAllocation = {
    enabled: hasStorageForSubsidy || shouldAddEms,
    billingSystem,
    pvNet: Math.round(optimizedPvNet),
    storageNet: Math.round(optimizedStorageNet),
    emsNet: Math.round(optimizedEmsNet),
    storageSubsidy: Math.round(storageSubsidy),
    emsBonus: Math.round(emsBonus),
    total: subsidyTotal,
    programCap: subsidyProgramCap,
    storageCapByKwh: Math.round(storageCapByKwh),
    maxStorageSubsidy: Math.round(maxStorageSubsidy),
  };

  return NextResponse.json({
    pvPowerKw,
    inverter: inverter.name,
    energyStorage: storage.name,
    offerType,
    billingSystem,
    withEms: shouldAddEms,
    basePriceNet: Math.round(
      purchaseCostNet +
        grossManagerMarginsBeforeOperatorNet +
        marketingNet +
        managerFeeNet
    ),
    sellerMarkupNet,
    finalNet,
    finalGross,
    vatRate,
    companyMargin,
    operatorPercent,
    operatorFeeNet,
    operatorFeePerOwnerNet,
    sellerWarrantyFeeNet,
    sellerCommissionNet,
    managerFeeNet,
    managerWarrantyFeeNet,
    managerOwnersCount: managerOverride.ownersCount,
    marketingNet,
    subsidyProgramCap,
    subsidyAllocation,
    managerOverrideNet: Math.round(managerMarginAfterOperatorTotalNet),
    managerOverridePerOwnerNet: Math.round(managerMarginAfterOperatorPerOwnerNet),
    managerOverrideGrossNet: Math.round(grossManagerMarginsBeforeOperatorNet),
    managerOverrideGrossPerOwnerNet: Math.round(
      managerOverride.perOwnerGrossBeforeOperatorNet
    ),
    adminPricingEnabled:
      process.env.NODE_ENV === "development"
        ? true
        : currentUser?.role === "admin" ||
          currentUser?.role === "owner",
    breakdown: [
      ...(isStorageOnly
        ? [{ label: "Falownik", value: Math.round(inverterCostNet) }]
        : [
            { label: "Panele", value: Math.round(panelsCostNet) },
            { label: "Falownik", value: Math.round(inverterCostNet) },
            { label: "Montaż PV", value: Math.round(pvInstallationNet) },
            {
              label: "Konstrukcja / dach / grunt",
              value: Math.round(roofExtraNet),
            },
          ]),
      { label: "Magazyn energii", value: Math.round(storage.priceNet) },
      { label: "Montaż ME", value: Math.round(storage.installationNet) },
      {
        label: "Zabezpieczenia",
        value: Math.round(pricing.placeholders.protections),
      },
      {
        label: "Okablowanie",
        value: Math.round(pricing.placeholders.wiring),
      },
      {
        label: "Transport",
        value: Math.round(pricing.placeholders.transport),
      },
      {
        label: "Dokumentacja",
        value: Math.round(pricing.placeholders.documentation),
      },
      ...(shouldAddEms
        ? [
            {
              label: "System EMS",
              value: Math.round(emsNet),
            },
          ]
        : []),
      {
        label: "Marketing",
        value: Math.round(marketingNet),
      },
      {
        label: "Manager Fee",
        value: Math.round(managerFeeNet),
      },
      {
        label: `Fundusz gwarancyjny ${operatorPercent}% od kwoty netto`,
        value: operatorFeeNet,
      },
      {
        label: "Marża wspólników sumarycznie",
        value: Math.round(managerMarginAfterOperatorTotalNet),
      },
      {
        label: `Marża wspólnik / osoba (${managerOverride.ownersCount} osoby)`,
        value: Math.round(managerMarginAfterOperatorPerOwnerNet),
      },
      {
        label: "Prowizja handlowca",
        value: Math.round(sellerCommissionNet),
      },
    ],
  });
}