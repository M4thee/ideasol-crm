import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { calculateOffer } from "@/lib/calculator/calculateOffer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const catalogSupabase = supabaseUrl && (serviceRoleKey || anonKey)
  ? createClient(supabaseUrl, serviceRoleKey || anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

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
  isEu?: boolean;
  hasEms?: boolean;
};

type StorageItem = {
  name: string;
  displayName: string;
  capacityKwh: number;
  voltageType: "low_voltage" | "high_voltage";
  priceNet: number;
  installationNet: number;
  catalogCardUrl?: string | null;
  isEu?: boolean;
};

const NO_STORAGE_ITEM: StorageItem = {
  name: "Brak",
  displayName: "Brak",
  capacityKwh: 0,
  voltageType: "low_voltage",
  priceNet: 0,
  installationNet: 0,
};

const EMPTY_STORAGE_CATALOG: Record<string, StorageItem> = {
  none: {
    ...NO_STORAGE_ITEM,
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
  if (!catalogSupabase) {
    throw new Error("Brak konfiguracji połączenia z bazą sprzętu Supabase.");
  }

  const [panelsResponse, invertersResponse, storagesResponse] = await Promise.all([
    catalogSupabase
      .from("panels")
      .select("code, name, display_name, power_wp, price_net, catalog_card_url, active")
      .eq("active", true)
      .order("power_wp", { ascending: true }),
    catalogSupabase
      .from("inverters")
      .select("name, display_name, type, battery_voltage_type, max_pv_kw, price_net, catalog_card_url, is_eu, has_ems, active")
      .eq("active", true)
      .order("max_pv_kw", { ascending: true }),
    catalogSupabase
      .from("storages")
      .select("code, name, display_name, capacity_kwh, voltage_type, price_net, installation_net, catalog_card_url, is_eu, active")
      .eq("active", true)
      .order("capacity_kwh", { ascending: true }),
  ]);

  const catalogError = panelsResponse.error || invertersResponse.error || storagesResponse.error;
  if (catalogError) {
    throw new Error(`Nie udało się pobrać katalogu sprzętu z Supabase: ${catalogError.message}`);
  }

  const panelsFromDb = panelsResponse.data || [];
  const invertersFromDb = invertersResponse.data || [];
  const storagesFromDb = storagesResponse.data || [];

  if (panelsFromDb.length === 0 || invertersFromDb.length === 0 || storagesFromDb.length === 0) {
    throw new Error(
      `Baza sprzętu nie zawiera pełnego aktywnego katalogu (panele: ${panelsFromDb.length}, falowniki: ${invertersFromDb.length}, magazyny: ${storagesFromDb.length}).`
    );
  }

  const panels = Object.fromEntries(
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
    );

  const inverters = invertersFromDb.map((inverter: any) => ({
      name: inverter.name,
      displayName: inverter.display_name || inverter.name,
      type: inverter.type,
      batteryVoltageType: inverter.battery_voltage_type || null,
      catalogCardUrl: inverter.catalog_card_url || null,
      maxPvKw: Number(inverter.max_pv_kw),
      priceNet: Number(inverter.price_net),
      isEu: Boolean(inverter.is_eu),
      hasEms: Boolean(inverter.has_ems),
    }));

  const storages = Object.fromEntries(
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
          isEu: Boolean(storage.is_eu),
        },
      ])
    ) as Record<string, StorageItem>;

  if (!storages.none) {
    storages.none = EMPTY_STORAGE_CATALOG.none;
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
        ? supabase
            .from("pricing_settings")
            .select(
              "installation_pv_per_kw, storage_installation_with_pv_net, storage_installation_without_pv_net, transport_electronics_net, transport_panels_net, protections_cost, wiring_cost, documentation_cost, ems_cost, warranty_percent, marketing_cost, owners_count, pv_small_per_kw, pv_small_fixed, pv_large_per_kw, pv_large_fixed, storage_per_owner, manager_fee_percent, pme_qualify_vat"
            )
            .eq("id", 1)
            .single()
        : Promise.resolve({ data: null, error: null }),
      loadCatalogFromSupabase(),
    ]);

    if (settingsError) {
      console.warn("Nie udało się pobrać pricing_settings dla katalogu kalkulatora", settingsError);
    }

    return NextResponse.json(
      {
        catalog,
        settingsRow: settingsRow || null,
        catalogSource: "supabase",
        catalogFetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
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

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

export async function POST(request: Request) {
  const body = await request.json();
  const customModeRequested = body?.customMode === true;
  let authenticatedUserId: string | null = null;

  if (customModeRequested) {
    if (!supabase) {
      return NextResponse.json(
        { error: "Tryb niestandardowy wymaga pełnej konfiguracji lokalnego Supabase." },
        { status: 503 }
      );
    }
    const accessToken = readBearerToken(request);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Tryb niestandardowy wymaga aktywnej sesji użytkownika." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sesja wygasła. Zaloguj się ponownie." },
        { status: 401 }
      );
    }

    const { data: permission, error: permissionError } = await supabase
      .from("user_permissions")
      .select("custom_mode")
      .eq("user_id", user.id)
      .maybeSingle();

    if (permissionError || permission?.custom_mode !== true) {
      return NextResponse.json(
        { error: "Brak uprawnienia Custom Mode." },
        { status: 403 }
      );
    }

    authenticatedUserId = user.id;
  }

  const sellerProfileId =
    authenticatedUserId ||
    body?.advisor?.id ||
    body?.createdBy ||
    null;
  const sellerEmail = body?.advisor?.email || null;
  let currentUser: any = null;
  if (sellerProfileId && supabase) {
    const { data: resolvedProfile } = await supabase
      .from("profiles")
      .select("id, role, manager_id, display_name, email")
      .eq("id", sellerProfileId)
      .maybeSingle();
    if (resolvedProfile) {
      currentUser = resolvedProfile;
    }
  }
  if ((!currentUser || !currentUser.manager_id) && sellerEmail && supabase) {
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
      ? supabase
          .from("pricing_settings")
          .select(
            "installation_pv_per_kw, storage_installation_with_pv_net, storage_installation_without_pv_net, transport_electronics_net, transport_panels_net, protections_cost, wiring_cost, documentation_cost, ems_cost, warranty_percent, marketing_cost, owners_count, pv_small_per_kw, pv_small_fixed, pv_large_per_kw, pv_large_fixed, storage_per_owner, manager_fee_percent, pme_qualify_vat"
          )
          .eq("id", 1)
          .single()
      : Promise.resolve({ data: null, error: null }),
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
