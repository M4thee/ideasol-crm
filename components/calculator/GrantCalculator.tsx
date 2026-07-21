"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type Scope = "pv" | "heat_pump" | "pv_heat_pump";
type RoofType = "sheet" | "tile" | "felt" | "ground";
type PvOrientation = "south" | "south_west" | "west" | "south_east" | "east";

type Settings = {
  program_name: string;
  fixed_margin_gross: number;
  min_pv_kw: number;
  max_pv_kw: number;
  annual_yield_kwh_per_kwp: number;
  heat_pump_extra_pv_kw: number;
  pv_eligible_limit_gross: number;
  extra_pv_eligible_limit_gross: number;
  pv_limit_gross_per_kwp: number;
  heat_pump_eligible_limit_gross: number;
  combined_grant_limit_gross: number;
  pv_installation_net_per_kwp: number;
  roof_sheet_net: number;
  roof_tile_net: number;
  roof_felt_net: number;
  roof_ground_net: number;
  protections_net: number;
  wiring_net: number;
  transport_net: number;
  documentation_net: number;
  monitoring_net: number;
  heat_pump_installation_net: number;
  marketing_net: number;
  owners_count: number;
  pv_small_per_kw_net: number;
  pv_small_fixed_net: number;
  pv_large_per_kw_net: number;
  pv_large_fixed_net: number;
  heat_pump_per_owner_net: number;
  operator_percent: number;
  enable_pv: boolean;
  enable_heat_pump: boolean;
  enable_combined: boolean;
  vat_rate: number;
  active: boolean;
};

type Panel = { id: number; manufacturer: string; model: string; power_wp: number; price_net: number; installation_scope: "roof" | "ground" | "both" };
type Inverter = { id: number; manufacturer: string; model: string; power_kw: number; phase_count: number; price_net: number };
type HeatPump = { id: number; manufacturer: string; model: string; power_kw: number; pump_type: "monoblock" | "split"; price_net: number; cop: number | null };
type GrantClient = {
  id: string;
  public_id?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
};

type GrantCalculatorProps = {
  canSeeInternalCosts?: boolean;
  currentUserId?: string | null;
  advisorName?: string;
  advisorPhone?: string;
  advisorEmail?: string;
  advisorRole?: string;
  crmClients?: GrantClient[];
  selectedClientId?: string;
  onSelectedClientIdChange?: (clientId: string) => void;
  onClientEmailSaved?: (clientId: string, email: string) => void;
};

const FALLBACK_SETTINGS: Settings = {
  program_name: "Grant OZE — Radzionków", fixed_margin_gross: 3000,
  min_pv_kw: 2, max_pv_kw: 10, annual_yield_kwh_per_kwp: 1000,
  heat_pump_extra_pv_kw: 4, pv_eligible_limit_gross: 20000,
  extra_pv_eligible_limit_gross: 20000, pv_limit_gross_per_kwp: 5000,
  heat_pump_eligible_limit_gross: 35000, combined_grant_limit_gross: 55000,
  pv_installation_net_per_kwp: 500, roof_sheet_net: 1500, roof_tile_net: 2000,
  roof_felt_net: 2200, roof_ground_net: 4500, protections_net: 1500,
  wiring_net: 800, transport_net: 500, documentation_net: 700,
  monitoring_net: 1200, heat_pump_installation_net: 0, marketing_net: 500,
  owners_count: 3, pv_small_per_kw_net: 250, pv_small_fixed_net: 500,
  pv_large_per_kw_net: 150, pv_large_fixed_net: 700,
  heat_pump_per_owner_net: 500, operator_percent: 15,
  enable_pv: true, enable_heat_pump: true, enable_combined: true,
  vat_rate: 8, active: true,
};

const fieldClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#5300EB] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

const PV_ORIENTATIONS: Record<PvOrientation, { label: string; annualYieldKwhPerKwp: number }> = {
  south: { label: "Południe", annualYieldKwhPerKwp: 1073.85 },
  south_west: { label: "Południowy zachód", annualYieldKwhPerKwp: 1001.74 },
  west: { label: "Zachód", annualYieldKwhPerKwp: 836.31 },
  south_east: { label: "Południowy wschód", annualYieldKwhPerKwp: 1015.05 },
  east: { label: "Wschód", annualYieldKwhPerKwp: 854.65 },
};

function numeric(value: string | number) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getGrantClientName(client: GrantClient | undefined) {
  if (!client) return "";
  return client.full_name || client.company_name || client.contact_person || client.public_id || client.id;
}

function getGrantClientSearchText(client: GrantClient) {
  return [
    client.public_id || "",
    client.public_id ? `lead${client.public_id}` : "",
    client.public_id ? `leadid${client.public_id}` : "",
    client.full_name || "",
    client.company_name || "",
    client.contact_person || "",
    client.email || "",
    client.phone || "",
    client.city || "",
  ].join(" ").toLowerCase();
}

export default function GrantCalculator({
  canSeeInternalCosts = false,
  currentUserId = null,
  advisorName = "IdeaSol",
  advisorPhone = "",
  advisorEmail = "",
  advisorRole = "seller",
  crmClients = [],
  selectedClientId = "",
  onSelectedClientIdChange,
  onClientEmailSaved,
}: GrantCalculatorProps) {
  const [settings, setSettings] = useState(FALLBACK_SETTINGS);
  const [scope, setScope] = useState<Scope>("pv");
  const [annualConsumption, setAnnualConsumption] = useState("");
  const [connectionPower, setConnectionPower] = useState("");
  const [hasExistingPv, setHasExistingPv] = useState(false);
  const [existingPvKw, setExistingPvKw] = useState("");
  const [existingPvProduction, setExistingPvProduction] = useState("");
  const [canRecoverVat, setCanRecoverVat] = useState(false);
  const [roofType, setRoofType] = useState<RoofType>("sheet");
  const [pvOrientation, setPvOrientation] = useState<PvOrientation>("south");
  const [panels, setPanels] = useState<Panel[]>([]);
  const [inverters, setInverters] = useState<Inverter[]>([]);
  const [heatPumps, setHeatPumps] = useState<HeatPump[]>([]);
  const [panelId, setPanelId] = useState("");
  const [manualPanelCount, setManualPanelCount] = useState("");
  const [inverterId, setInverterId] = useState("");
  const [heatPumpId, setHeatPumpId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [resultVisible, setResultVisible] = useState(false);
  const [internalCostsVisible, setInternalCostsVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [clientEmailTouched, setClientEmailTouched] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [saveOfferStatus, setSaveOfferStatus] = useState("");
  const [savedOfferId, setSavedOfferId] = useState<string | null>(null);
  const [savedOfferFingerprint, setSavedOfferFingerprint] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const resultsRef = useRef<HTMLElement>(null);

  const includesPv = scope !== "heat_pump";
  const includesHeatPump = scope !== "pv";
  const scopeEnabled: Record<Scope, boolean> = {
    pv: settings.enable_pv,
    heat_pump: settings.enable_heat_pump,
    pv_heat_pump: settings.enable_combined,
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      const [settingsResult, panelsResult, invertersResult, pumpsResult] = await Promise.all([
        supabase.from("grant_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("grant_panels").select("id, manufacturer, model, power_wp, price_net, installation_scope").eq("active", true).order("power_wp"),
        supabase.from("grant_inverters").select("id, manufacturer, model, power_kw, phase_count, price_net").eq("active", true).eq("program_compliant", true).order("power_kw"),
        supabase.from("grant_heat_pumps").select("id, manufacturer, model, power_kw, pump_type, price_net, cop").eq("active", true).eq("zum_compliant", true).order("power_kw"),
      ]);

      const error = settingsResult.error || panelsResult.error || invertersResult.error || pumpsResult.error;
      if (error) {
        console.error("Błąd ładowania kalkulatora grantowego", error);
        setLoadError(`Nie udało się załadować danych grantu: ${error.message}`);
      } else {
        if (settingsResult.data) {
          const loadedSettings = { ...FALLBACK_SETTINGS, ...settingsResult.data } as Settings;
          setSettings(loadedSettings);
          setScope((currentScope) => {
            const enabledByScope: Record<Scope, boolean> = {
              pv: loadedSettings.enable_pv,
              heat_pump: loadedSettings.enable_heat_pump,
              pv_heat_pump: loadedSettings.enable_combined,
            };
            if (enabledByScope[currentScope]) return currentScope;
            return (["pv", "heat_pump", "pv_heat_pump"] as Scope[]).find((item) => enabledByScope[item]) || currentScope;
          });
        }
        setPanels((panelsResult.data || []) as Panel[]);
        setInverters((invertersResult.data || []) as Inverter[]);
        setHeatPumps((pumpsResult.data || []) as HeatPump[]);
      }
      setLoading(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const availablePanels = useMemo(() => panels.filter((item) =>
    roofType === "ground"
      ? item.installation_scope === "ground" || item.installation_scope === "both"
      : item.installation_scope === "roof" || item.installation_scope === "both"
  ), [panels, roofType]);

  const pvSizing = useMemo(() => {
    const consumption = numeric(annualConsumption);
    const connectionLimitKw = numeric(connectionPower);
    const existingPowerKw = hasExistingPv ? numeric(existingPvKw) : 0;
    const existingProductionKwh = hasExistingPv ? numeric(existingPvProduction) : 0;
    const remainingAnnualConsumption = Math.max(0, consumption - existingProductionKwh);
    const availableConnectionKw = Math.max(0, connectionLimitKw - existingPowerKw);
    const orientation = PV_ORIENTATIONS[pvOrientation];
    const yieldPerKwp = orientation.annualYieldKwhPerKwp;
    const consumptionAllowedKw = includesPv ? remainingAnnualConsumption / yieldPerKwp : 0;
    const maximumBeforeConnectionKw = includesPv
      ? Math.min(
        settings.max_pv_kw,
        consumptionAllowedKw + (includesHeatPump ? settings.heat_pump_extra_pv_kw : 0),
      )
      : 0;
    const baseAllowedKw = includesPv
      ? Math.min(consumptionAllowedKw, settings.max_pv_kw, availableConnectionKw)
      : 0;
    const extraAllowedKw = includesPv && includesHeatPump
      ? Math.min(
        settings.heat_pump_extra_pv_kw,
        Math.max(0, settings.max_pv_kw - baseAllowedKw),
        Math.max(0, availableConnectionKw - baseAllowedKw),
      )
      : 0;
    const maximumAllowedKw = Math.min(settings.max_pv_kw, availableConnectionKw, baseAllowedKw + extraAllowedKw);
    return {
      orientation,
      yieldPerKwp,
      consumptionAllowedKw,
      remainingAnnualConsumption,
      availableConnectionKw,
      baseAllowedKw,
      extraAllowedKw,
      maximumAllowedKw,
      connectionLimited: availableConnectionKw < maximumBeforeConnectionKw,
    };
  }, [annualConsumption, connectionPower, hasExistingPv, existingPvKw, existingPvProduction, includesPv, includesHeatPump, settings.max_pv_kw, settings.heat_pump_extra_pv_kw, pvOrientation]);

  const selectedPanel = useMemo(() => {
    const manuallySelected = availablePanels.find((item) => String(item.id) === panelId);
    if (manuallySelected) return manuallySelected;
    if (availablePanels.length === 0) return undefined;

    return availablePanels.reduce((best, candidate) => {
      const bestCount = Math.floor((pvSizing.maximumAllowedKw * 1000 + 0.0001) / best.power_wp);
      const candidateCount = Math.floor((pvSizing.maximumAllowedKw * 1000 + 0.0001) / candidate.power_wp);
      const bestPowerWp = bestCount * best.power_wp;
      const candidatePowerWp = candidateCount * candidate.power_wp;

      if (candidatePowerWp !== bestPowerWp) {
        return candidatePowerWp > bestPowerWp ? candidate : best;
      }

      const bestTotalNet = bestCount * best.price_net;
      const candidateTotalNet = candidateCount * candidate.price_net;
      return candidateTotalNet < bestTotalNet ? candidate : best;
    });
  }, [availablePanels, panelId, pvSizing.maximumAllowedKw]);
  const selectedHeatPump = heatPumps.find((item) => String(item.id) === heatPumpId) || heatPumps[0];

  const calculation = useMemo(() => {
    const {
      orientation,
      yieldPerKwp,
      consumptionAllowedKw,
      remainingAnnualConsumption,
      availableConnectionKw,
      baseAllowedKw,
      extraAllowedKw,
      maximumAllowedKw,
      connectionLimited,
    } = pvSizing;
    const automaticPanelCount = selectedPanel ? Math.floor((maximumAllowedKw * 1000 + 0.0001) / selectedPanel.power_wp) : 0;
    const requestedPanelCount = manualPanelCount.trim() === ""
      ? automaticPanelCount
      : Math.floor(numeric(manualPanelCount));
    const panelCount = Math.min(Math.max(0, requestedPanelCount), automaticPanelCount);
    const pvPowerKw = selectedPanel ? (panelCount * selectedPanel.power_wp) / 1000 : 0;
    const forecastAnnualProduction = pvPowerKw * yieldPerKwp;
    const basePvKw = Math.min(pvPowerKw, baseAllowedKw);
    const extraPvKw = Math.max(0, pvPowerKw - basePvKw);
    const compatibleInverters = inverters.filter((item) => item.power_kw >= pvPowerKw);
    const selectedInverter = compatibleInverters.find((item) => String(item.id) === inverterId) || compatibleInverters[0];

    const vatDivider = 1 + settings.vat_rate / 100;
    const roofCosts: Record<RoofType, number> = {
      sheet: settings.roof_sheet_net,
      tile: settings.roof_tile_net,
      felt: settings.roof_felt_net,
      ground: settings.roof_ground_net,
    };
    const panelsNet = includesPv && selectedPanel ? panelCount * selectedPanel.price_net : 0;
    const inverterNet = includesPv ? selectedInverter?.price_net || 0 : 0;
    const pvInstallationNet = includesPv ? pvPowerKw * settings.pv_installation_net_per_kwp : 0;
    const roofNet = includesPv ? roofCosts[roofType] : 0;
    const pvTechnicalNet = includesPv
      ? settings.protections_net + settings.wiring_net + settings.monitoring_net
      : 0;
    const heatPumpEquipmentNet = includesHeatPump ? selectedHeatPump?.price_net || 0 : 0;
    const heatPumpInstallationNet = includesHeatPump ? settings.heat_pump_installation_net : 0;
    const sharedNet = settings.transport_net + settings.documentation_net;
    const directPvNet = panelsNet + inverterNet + pvInstallationNet + roofNet + pvTechnicalNet;
    const directHeatPumpNet = heatPumpEquipmentNet + heatPumpInstallationNet;
    const directTotalNet = directPvNet + directHeatPumpNet;
    const pvShare = includesPv ? (directTotalNet > 0 ? directPvNet / directTotalNet : 1) : 0;
    const heatPumpShare = includesHeatPump ? (directTotalNet > 0 ? directHeatPumpNet / directTotalNet : 1) : 0;
    const purchasePvNet = directPvNet + sharedNet * pvShare;
    const purchaseHeatPumpNet = directHeatPumpNet + sharedNet * heatPumpShare;
    const purchaseCostNet = purchasePvNet + purchaseHeatPumpNet;
    const configurationComplete =
      (!includesPv || Boolean(selectedPanel && selectedInverter && panelCount > 0)) &&
      (!includesHeatPump || Boolean(selectedHeatPump));
    const pvMarginPerOwnerNet = includesPv
      ? pvPowerKw <= 5
        ? pvPowerKw * settings.pv_small_per_kw_net + settings.pv_small_fixed_net
        : pvPowerKw * settings.pv_large_per_kw_net + settings.pv_large_fixed_net
      : 0;
    const companyMarginBeforeOperatorNet = Math.max(0, settings.owners_count) * (
      pvMarginPerOwnerNet + (includesHeatPump ? settings.heat_pump_per_owner_net : 0)
    );
    const operatorMultiplier = 1 - Math.min(Math.max(settings.operator_percent, 0), 99.99) / 100;
    const subtotalBeforeOperatorNet = purchaseCostNet + companyMarginBeforeOperatorNet + settings.fixed_margin_gross + settings.marketing_net;
    const net = configurationComplete
      ? subtotalBeforeOperatorNet / operatorMultiplier
      : 0;
    const operatorFeeNet = net * (settings.operator_percent / 100);
    const companyMarginNet = Math.max(
      0,
      net - purchaseCostNet - settings.fixed_margin_gross - settings.marketing_net - operatorFeeNet,
    );
    const gross = net * vatDivider;
    const pvNet = net * pvShare;
    const heatPumpNet = net * heatPumpShare;
    const pvGross = pvNet * vatDivider;
    const heatPumpGross = heatPumpNet * vatDivider;
    const basePvCap = Math.min(settings.pv_eligible_limit_gross, basePvKw * settings.pv_limit_gross_per_kwp);
    const extraPvCap = Math.min(settings.extra_pv_eligible_limit_gross, extraPvKw * settings.pv_limit_gross_per_kwp);
    const qualifyingPvBasis = canRecoverVat ? pvGross / vatDivider : pvGross;
    const qualifyingHeatPumpBasis = canRecoverVat ? heatPumpGross / vatDivider : heatPumpGross;
    const eligiblePv = Math.min(qualifyingPvBasis, basePvCap + extraPvCap);
    const heatPumpBeforeCombinedCap = Math.min(qualifyingHeatPumpBasis, settings.heat_pump_eligible_limit_gross);
    const combinedLimit = includesPv && includesHeatPump
      ? settings.combined_grant_limit_gross
      : Number.POSITIVE_INFINITY;
    const eligibleHeatPump = Math.min(heatPumpBeforeCombinedCap, Math.max(0, combinedLimit - eligiblePv));
    const eligibleTotal = eligiblePv + eligibleHeatPump;

    return {
      baseAllowedKw, extraAllowedKw, maximumAllowedKw, automaticPanelCount, panelCount, pvPowerKw,
      yieldPerKwp, orientationLabel: orientation.label, forecastAnnualProduction,
      consumptionAllowedKw, remainingAnnualConsumption, availableConnectionKw,
      connectionLimited,
      selectedInverter, compatibleInverters, selectedHeatPump, gross, net,
      vat: gross - net, pvGross, heatPumpGross, eligiblePv, eligibleHeatPump,
      eligibleTotal, ownContribution: Math.max(0, gross - eligibleTotal), configurationComplete,
      panelsNet, inverterNet, pvInstallationNet, roofNet, pvTechnicalNet,
      heatPumpEquipmentNet, heatPumpInstallationNet, sharedNet, purchaseCostNet,
      companyMarginNet, operatorFeeNet,
    };
  }, [pvSizing, includesPv, includesHeatPump, settings, selectedPanel, manualPanelCount, inverters, inverterId, selectedHeatPump, canRecoverVat, roofType]);

  const consumptionMissing = includesPv && numeric(annualConsumption) <= 0;
  const connectionPowerMissing = includesPv && numeric(connectionPower) <= 0;
  const existingPvDataMissing = includesPv && hasExistingPv && (
    numeric(existingPvKw) <= 0 || numeric(existingPvProduction) <= 0
  );
  const pvBelowMinimum = includesPv &&
    !consumptionMissing &&
    !connectionPowerMissing &&
    !existingPvDataMissing &&
    calculation.pvPowerKw < settings.min_pv_kw;
  const manualPanelCountInvalid = includesPv && manualPanelCount.trim() !== "" && (
    !Number.isInteger(numeric(manualPanelCount)) ||
    numeric(manualPanelCount) < 1 ||
    numeric(manualPanelCount) > calculation.automaticPanelCount
  );
  const canCalculate =
    settings.active &&
    scopeEnabled[scope] &&
    !loading &&
    !consumptionMissing &&
    !connectionPowerMissing &&
    !existingPvDataMissing &&
    !manualPanelCountInvalid &&
    !pvBelowMinimum &&
    calculation.configurationComplete;

  const selectedClient = useMemo(
    () => crmClients.find((client) => client.id === selectedClientId),
    [crmClients, selectedClientId],
  );
  const clientSuggestions = useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLowerCase();

    if (!normalizedSearch) return crmClients.slice(0, 8);

    return crmClients
      .filter((client) => getGrantClientSearchText(client).includes(normalizedSearch))
      .slice(0, 12);
  }, [clientSearch, crmClients]);
  const clientName = getGrantClientName(selectedClient);
  const effectiveClientEmail = (
    clientEmailTouched ? clientEmail : String(selectedClient?.email || "")
  ).trim();
  const inverterName = calculation.selectedInverter
    ? `${calculation.selectedInverter.manufacturer} ${calculation.selectedInverter.model}`
    : "";
  const heatPumpName = calculation.selectedHeatPump
    ? `${calculation.selectedHeatPump.manufacturer} ${calculation.selectedHeatPump.model}`
    : "";
  const panelName = selectedPanel
    ? `${selectedPanel.manufacturer} ${selectedPanel.model}`
    : "";
  const offerFingerprint = JSON.stringify({
    selectedClientId,
    scope,
    annualConsumption,
    connectionPower,
    hasExistingPv,
    existingPvKw,
    existingPvProduction,
    canRecoverVat,
    roofType,
    pvOrientation,
    panelId: selectedPanel?.id || null,
    manualPanelCount: manualPanelCount || null,
    inverterId: calculation.selectedInverter?.id || null,
    heatPumpId: calculation.selectedHeatPump?.id || null,
    gross: calculation.gross,
    grant: calculation.eligibleTotal,
  });
  const currentOfferAlreadySaved = Boolean(
    savedOfferId && savedOfferFingerprint === offerFingerprint,
  );

  const resetOfferActions = () => {
    setSavedOfferId(null);
    setSavedOfferFingerprint("");
    setSaveOfferStatus("");
    setEmailStatus("");
  };

  const handleClientChange = (clientId: string) => {
    onSelectedClientIdChange?.(clientId);
    setClientSearch("");
    setIsClientDropdownOpen(false);
    setClientEmail("");
    setClientEmailTouched(false);
    resetOfferActions();
  };

  const buildGrantOfferText = () => {
    const lines = [
      settings.program_name,
      `Zakres: ${scope === "pv" ? "fotowoltaika" : scope === "heat_pump" ? "pompa ciepła" : "fotowoltaika i pompa ciepła"}`,
      includesPv ? `Instalacja PV: ${calculation.pvPowerKw.toFixed(3)} kWp` : null,
      includesPv && selectedPanel ? `Panele: ${calculation.panelCount} × ${panelName} (${selectedPanel.power_wp} Wp)` : null,
      includesPv ? `Falownik: ${inverterName}` : null,
      includesPv ? `Orientacja: ${calculation.orientationLabel}` : null,
      includesPv ? `Prognozowana produkcja: ${Math.round(calculation.forecastAnnualProduction).toLocaleString("pl-PL")} kWh/rok` : null,
      includesHeatPump ? `Pompa ciepła: ${heatPumpName}` : null,
      "",
      `Cena netto: ${money.format(calculation.net)}`,
      `Cena brutto (${settings.vat_rate}% VAT): ${money.format(calculation.gross)}`,
      `Szacowana wartość grantu: ${money.format(calculation.eligibleTotal)}`,
      `Wkład własny grantobiorcy: ${money.format(calculation.ownContribution)}`,
      "",
      "Oferta ma charakter wstępny. Ostateczna moc i kwalifikowalność wymagają potwierdzenia w audycie energetycznym lub OZC.",
    ];

    return lines.filter((line) => line !== null).join("\n");
  };

  const saveGrantOfferToCrm = async () => {
    if (currentOfferAlreadySaved) return savedOfferId;

    if (!resultVisible || !calculation.configurationComplete) {
      setSaveOfferStatus("Najpierw oblicz kompletną ofertę.");
      return null;
    }
    if (!selectedClientId || !selectedClient) {
      setSaveOfferStatus("Wybierz lead lub klienta z CRM przed zapisem oferty.");
      return null;
    }
    if (!currentUserId) {
      setSaveOfferStatus("Brak zalogowanego użytkownika — nie można zapisać oferty.");
      return null;
    }

    setSavingOffer(true);
    setSaveOfferStatus("Zapisywanie oferty na leadzie...");

    const offerPayload = {
      client_id: selectedClientId,
      created_by: currentUserId,
      offer_type: "pv",
      status: "draft",
      client_name: clientName || null,
      client_email: effectiveClientEmail || null,
      sale_price_net: calculation.net,
      sale_price_gross: calculation.gross,
      vat_rate: settings.vat_rate,
      seller_margin: settings.fixed_margin_gross,
      company_margin: calculation.companyMarginNet,
      subsidy_allocation_enabled: true,
      subsidy_billing_system: null,
      subsidy_pv_net: calculation.eligiblePv,
      subsidy_storage_net: null,
      subsidy_ems_net: null,
      subsidy_storage_subsidy: null,
      subsidy_ems_bonus: null,
      subsidy_total: calculation.eligibleTotal,
      pv_power_kw: calculation.pvPowerKw,
      panel_model: selectedPanel?.model || null,
      panel_count: calculation.panelCount,
      panel_power_wp: selectedPanel?.power_wp || null,
      inverter: inverterName || "Brak",
      energy_storage: "Brak",
      roof_type: roofType,
      offer_data: {
        calculator: "grant_oze_radzionkow",
        programName: settings.program_name,
        scope,
        result: {
          pvPowerKw: calculation.pvPowerKw,
          panelCount: calculation.panelCount,
          forecastAnnualProduction: calculation.forecastAnnualProduction,
          finalNet: calculation.net,
          finalGross: calculation.gross,
          vatRate: settings.vat_rate,
          eligiblePv: calculation.eligiblePv,
          eligibleHeatPump: calculation.eligibleHeatPump,
          grantAmount: calculation.eligibleTotal,
          ownContribution: calculation.ownContribution,
        },
        form: {
          annualConsumption,
          connectionPower,
          hasExistingPv,
          existingPvKw,
          existingPvProduction,
          canRecoverVat,
          roofType,
          pvOrientation,
          manualPanelCount: manualPanelCount || null,
        },
        equipment: {
          panel: selectedPanel || null,
          inverter: calculation.selectedInverter || null,
          heatPump: calculation.selectedHeatPump || null,
        },
        advisor: {
          id: currentUserId,
          name: advisorName,
          phone: advisorPhone,
          email: advisorEmail,
          role: advisorRole,
        },
      },
    };

    const { data, error } = await supabase
      .from("client_offers")
      .insert(offerPayload)
      .select("id, offer_public_id")
      .single();

    setSavingOffer(false);

    if (error) {
      console.error("Błąd zapisu oferty grantowej", error);
      setSaveOfferStatus(`Nie udało się zapisać oferty: ${error.message}`);
      return null;
    }

    setSavedOfferId(data.id);
    setSavedOfferFingerprint(offerFingerprint);
    setSaveOfferStatus(
      data.offer_public_id
        ? `Oferta ${data.offer_public_id} została zapisana na leadzie.`
        : "Oferta została zapisana na leadzie.",
    );
    return data.id as string;
  };

  const sendGrantOfferEmail = async () => {
    if (!selectedClientId || !selectedClient) {
      setEmailStatus("Wybierz lead lub klienta z CRM przed wysłaniem e-maila.");
      return;
    }
    if (!effectiveClientEmail || !effectiveClientEmail.includes("@")) {
      setEmailStatus("Podaj poprawny adres e-mail klienta.");
      return;
    }

    setSendingEmail(true);
    setEmailStatus("Przygotowywanie i wysyłanie oferty...");

    try {
      if (!String(selectedClient.email || "").trim() && clientEmailTouched) {
        const { error: updateEmailError } = await supabase
          .from("clients")
          .update({ email: effectiveClientEmail })
          .eq("id", selectedClientId);

        if (updateEmailError) throw updateEmailError;
        onClientEmailSaved?.(selectedClientId, effectiveClientEmail);
      }

      const offerId = await saveGrantOfferToCrm();
      if (!offerId) throw new Error("Nie udało się zapisać oferty na leadzie.");

      const response = await fetch("/api/send-grant-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: effectiveClientEmail,
          clientName,
          programName: settings.program_name,
          scope,
          advisor: {
            id: currentUserId,
            name: advisorName,
            phone: advisorPhone,
            email: advisorEmail,
            role: advisorRole,
          },
          pvPowerKw: calculation.pvPowerKw,
          panelName,
          panelCount: calculation.panelCount,
          panelPowerWp: selectedPanel?.power_wp || null,
          inverter: inverterName,
          heatPump: heatPumpName,
          orientation: calculation.orientationLabel,
          forecastAnnualProduction: calculation.forecastAnnualProduction,
          annualConsumption: calculation.remainingAnnualConsumption,
          finalNet: calculation.net,
          finalGross: calculation.gross,
          vatRate: settings.vat_rate,
          grantAmount: calculation.eligibleTotal,
          ownContribution: calculation.ownContribution,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Nie udało się wysłać e-maila.");
      }

      const { error: activityError } = await supabase
        .from("client_activities")
        .insert({
          client_id: selectedClientId,
          created_by: currentUserId,
          activity_type: "email",
          status: "wyslano",
          description: [
            "Wysłano ofertę mailową z kalkulatora grantowego.",
            `OfferID: ${offerId}`,
            `Odbiorca: ${effectiveClientEmail}`,
            "",
            buildGrantOfferText(),
          ].join("\n"),
        });

      setEmailStatus(
        activityError
          ? `E-mail wysłany, ale nie zapisano aktywności CRM: ${activityError.message}`
          : `Oferta została wysłana na ${effectiveClientEmail} i zapisana w historii leada.`,
      );
    } catch (error) {
      console.error("Błąd wysyłki oferty grantowej", error);
      setEmailStatus(error instanceof Error ? error.message : "Nie udało się wysłać oferty.");
    } finally {
      setSendingEmail(false);
    }
  };

  const showResults = () => {
    setResultVisible(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  return (
    <div className="space-y-6">
      <div role="status" className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-900 shadow-sm dark:border-red-700 dark:bg-red-950/50 dark:text-red-100">
        Kalkulator nie jest jeszcze w finalnej wersji — może zawierać błędy.
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5300EB]">CRM</p>
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-100">Lead / klient</h2>
          </div>
          <p className="text-xs text-slate-500">Oferta zostanie zapisana na wybranej karcie klienta.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="relative">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Wyszukaj klienta</span>
              <input
                type="text"
                className={fieldClass}
                placeholder="Nazwa, LeadID, telefon lub e-mail"
                value={isClientDropdownOpen ? clientSearch : selectedClient ? getGrantClientName(selectedClient) : clientSearch}
                onFocus={() => {
                  setClientSearch("");
                  setIsClientDropdownOpen(true);
                }}
                onChange={(event) => {
                  setClientSearch(event.target.value);
                  setIsClientDropdownOpen(true);
                  onSelectedClientIdChange?.("");
                  setClientEmail("");
                  setClientEmailTouched(false);
                  resetOfferActions();
                }}
              />
            </label>
            {isClientDropdownOpen && <div className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
              <div className="mb-2 flex items-center justify-between px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{clientSearch.trim() ? "Wyniki wyszukiwania" : "Ostatnio dodani klienci"}</span>
                <button type="button" onClick={() => setIsClientDropdownOpen(false)} className="font-semibold text-slate-400 transition hover:text-[#5300EB]">Zamknij</button>
              </div>
              {clientSuggestions.length > 0 ? <div className="space-y-2">
                {clientSuggestions.map((client) => <button
                  key={client.id}
                  type="button"
                  onClick={() => handleClientChange(client.id)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-[#5300EB]/30 hover:bg-[#5300EB]/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-[#5300EB]/60 dark:hover:bg-slate-800"
                >
                  <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                    <div className="min-w-0">
                      <div className="break-words font-semibold text-slate-950 dark:text-slate-100">{getGrantClientName(client)}</div>
                      <div className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{[client.phone, client.email, client.city].filter(Boolean).join(" • ") || "Brak danych kontaktowych"}</div>
                      {!client.email && <div className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-300">Brak e-maila — możesz wpisać go obok</div>}
                    </div>
                    {client.public_id && <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#5300EB] ring-1 ring-[#5300EB]/15 dark:bg-slate-950 dark:text-[#BFA8FF]">LeadID {client.public_id}</span>}
                  </div>
                </button>)}
              </div> : <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Brak pasujących klientów.</div>}
            </div>}
            {selectedClient && <div className="mt-2 rounded-xl border border-[#00C0EB]/25 bg-[#00C0EB]/10 px-3 py-2 text-xs font-semibold text-[#00677D] dark:text-[#70E6FF]">Wybrany klient CRM: {getGrantClientName(selectedClient)}{selectedClient.public_id ? ` • LeadID ${selectedClient.public_id}` : ""}</div>}
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">E-mail klienta</span>
            <input
              type="email"
              className={fieldClass}
              value={clientEmailTouched ? clientEmail : String(selectedClient?.email || "")}
              onChange={(event) => {
                setClientEmailTouched(true);
                setClientEmail(event.target.value);
                setEmailStatus("");
              }}
              placeholder="klient@example.com"
            />
          </label>
        </div>
      </section>
      <section className="relative overflow-hidden rounded-3xl border border-[#5300EB]/20 bg-white p-4 shadow-lg shadow-slate-200/70 ring-1 ring-[#5300EB]/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30 dark:ring-slate-800 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#5300EB] to-[#00C0EB]" />
        <div className="mb-6 rounded-2xl border border-[#5300EB]/20 bg-[#5300EB]/5 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5300EB] text-sm font-black text-white shadow-md shadow-[#5300EB]/20 dark:shadow-none">1</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5300EB]">Krok 1</p>
              <h1 className="text-lg font-bold text-slate-950 dark:text-slate-100 sm:text-xl">Konfiguracja — {settings.program_name}</h1>
            </div>
          </div>
        </div>

        {!settings.active && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Program jest obecnie wyłączony przez administratora.</div>}
        {loadError && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>}

        <div className="mb-5 rounded-3xl border-2 border-[#5300EB]/35 bg-gradient-to-br from-[#5300EB]/5 via-white to-[#00C0EB]/10 p-4 shadow-md shadow-[#5300EB]/15 dark:border-[#5300EB]/50 dark:from-slate-900 dark:via-slate-950 dark:to-[#00C0EB]/10 dark:shadow-black/30">
          <StepTitle number="1" color="blue">Wybierz elementy oferty</StepTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {([["pv", "Fotowoltaika"], ["heat_pump", "Pompa ciepła"], ["pv_heat_pump", "PV + pompa ciepła"]] as Array<[Scope, string]>).map(([value, label]) => (
              <button key={value} type="button" disabled={!scopeEnabled[value]} onClick={() => { setScope(value); setResultVisible(false); }} className={!scopeEnabled[value] ? "cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-4 text-sm font-bold text-slate-400 opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500" : scope === value ? "rounded-2xl border border-[#5300EB] bg-[#5300EB] px-4 py-4 text-sm font-bold text-white shadow-md shadow-[#5300EB]/25 ring-2 ring-[#5300EB]/15 dark:bg-[#5300EB] dark:text-white dark:ring-[#5300EB]/30" : "rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-sm font-bold text-slate-700 transition hover:border-[#5300EB]/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"}>{label}{!scopeEnabled[value] && <span className="mt-1 block text-xs font-medium">Dostępne wkrótce</span>}</button>
            ))}
          </div>
        </div>

        {includesPv && <div className="mb-5 rounded-3xl border-2 border-[#00C0EB]/35 bg-[#00C0EB]/10 p-4 shadow-sm shadow-[#00C0EB]/15 dark:border-[#00C0EB]/40 dark:bg-[#00C0EB]/10 dark:shadow-black/20">
          <StepTitle number="2" color="emerald">Dane energetyczne klienta</StepTitle>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Zużycie energii z ostatnich 12 miesięcy</span><input type="number" min="0" value={annualConsumption} onChange={(e) => setAnnualConsumption(e.target.value)} className={fieldClass} placeholder="np. 6200 kWh" /></label>
            <label className="block"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Moc przyłączeniowa</span><input type="number" min="0" step="0.1" value={connectionPower} onChange={(e) => { setConnectionPower(e.target.value); setResultVisible(false); }} className={fieldClass} placeholder="kW" /></label>
            <label className="block"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Miejsce montażu</span><select className={fieldClass} value={roofType} onChange={(e) => { setRoofType(e.target.value as RoofType); setPanelId(""); setResultVisible(false); }}><option value="sheet">Dach — blacha</option><option value="tile">Dach — dachówka</option><option value="felt">Dach — papa</option><option value="ground">Grunt</option></select></label>
            <label className="block"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Orientacja instalacji</span><select className={fieldClass} value={pvOrientation} onChange={(e) => { setPvOrientation(e.target.value as PvOrientation); setResultVisible(false); }}>{(Object.entries(PV_ORIENTATIONS) as Array<[PvOrientation, (typeof PV_ORIENTATIONS)[PvOrientation]]>).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
          </div>
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Czy klient posiada już fotowoltaikę?</p>
            <div className="mt-2 grid max-w-md grid-cols-2 gap-3">
              <button type="button" onClick={() => { setHasExistingPv(true); setResultVisible(false); }} className={hasExistingPv ? "rounded-2xl border border-[#00C0EB] bg-[#00C0EB] px-4 py-3 text-sm font-bold text-[#003D4A] shadow-md shadow-[#00C0EB]/25 ring-2 ring-[#00C0EB]/20" : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"}>TAK</button>
              <button type="button" onClick={() => { setHasExistingPv(false); setResultVisible(false); }} className={!hasExistingPv ? "rounded-2xl border border-[#00C0EB] bg-[#00C0EB] px-4 py-3 text-sm font-bold text-[#003D4A] shadow-md shadow-[#00C0EB]/25 ring-2 ring-[#00C0EB]/20" : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"}>NIE</button>
            </div>
          </div>
          {hasExistingPv && <div className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="text-sm font-semibold">Moc istniejącej PV</span><input type="number" min="0" step="0.001" value={existingPvKw} onChange={(e) => { setExistingPvKw(e.target.value); setResultVisible(false); }} className={fieldClass} placeholder="kWp" /></label><label><span className="text-sm font-semibold">Roczna produkcja istniejącej PV</span><input type="number" min="0" value={existingPvProduction} onChange={(e) => { setExistingPvProduction(e.target.value); setResultVisible(false); }} className={fieldClass} placeholder="kWh" /></label></div>}
        </div>}

        <div className="mb-5 rounded-3xl border-2 border-[#00C0EB]/35 bg-[#00C0EB]/10 p-4 shadow-sm shadow-[#00C0EB]/15 dark:border-[#00C0EB]/40 dark:bg-[#00C0EB]/10 dark:shadow-black/20">
          <StepTitle number={includesPv ? "3" : "2"} color="emerald">Kwalifikowalność VAT</StepTitle>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Czy klient ma prawo odzyskać lub odliczyć VAT związany z inwestycją?</p>
          <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
            <button type="button" onClick={() => { setCanRecoverVat(true); setResultVisible(false); }} className={canRecoverVat ? "rounded-2xl border border-[#00C0EB] bg-[#00C0EB] px-4 py-3 text-sm font-bold text-[#003D4A] shadow-md shadow-[#00C0EB]/25 ring-2 ring-[#00C0EB]/20" : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"}>TAK</button>
            <button type="button" onClick={() => { setCanRecoverVat(false); setResultVisible(false); }} className={!canRecoverVat ? "rounded-2xl border border-[#00C0EB] bg-[#00C0EB] px-4 py-3 text-sm font-bold text-[#003D4A] shadow-md shadow-[#00C0EB]/25 ring-2 ring-[#00C0EB]/20" : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"}>NIE</button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Jeśli klient może odzyskać VAT, podatek nie zostanie zaliczony do kosztów kwalifikowanych.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
          <StepTitle number={includesPv ? "4" : "3"} color="blue">Dobór urządzeń</StepTitle>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {includesPv && <>
              <label className="block"><span className="text-sm font-semibold">Panel</span><select className={fieldClass} value={panelId} onChange={(e) => { setPanelId(e.target.value); setResultVisible(false); }} disabled={availablePanels.length === 0}>{availablePanels.length === 0 ? <option value="">Brak paneli dla tego rodzaju montażu</option> : <><option value="">Automatycznie — najbliższa możliwa moc</option>{availablePanels.map((item) => <option key={item.id} value={item.id}>{item.manufacturer} {item.model} — {item.power_wp} Wp</option>)}</>}</select>{!panelId && selectedPanel && <span className="mt-2 block text-xs font-medium text-[#5300EB]">Dobór automatyczny: {selectedPanel.manufacturer} {selectedPanel.model} — {selectedPanel.power_wp} Wp</span>}</label>
              <label className="block">
                <span className="text-sm font-semibold">Liczba paneli</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  max={calculation.automaticPanelCount || undefined}
                  value={manualPanelCount}
                  onChange={(e) => {
                    setManualPanelCount(e.target.value);
                    setResultVisible(false);
                  }}
                  className={fieldClass}
                  placeholder={calculation.automaticPanelCount > 0 ? `Automatycznie: ${calculation.automaticPanelCount} szt.` : "Najpierw uzupełnij dane"}
                  disabled={!selectedPanel || calculation.automaticPanelCount <= 0}
                />
                {manualPanelCount ? <button type="button" onClick={() => { setManualPanelCount(""); setResultVisible(false); }} className="mt-2 text-xs font-bold text-[#5300EB] underline decoration-[#00C0EB] underline-offset-4">Wróć do liczby automatycznej ({calculation.automaticPanelCount} szt.)</button> : selectedPanel && calculation.automaticPanelCount > 0 ? <span className="mt-2 block text-xs font-medium text-slate-500">Pozostaw puste, aby użyć {calculation.automaticPanelCount} szt. Możesz wpisać mniejszą liczbę, jeśli ogranicza Cię miejsce montażu.</span> : null}
                {manualPanelCountInvalid && <span className="mt-2 block text-xs font-bold text-red-700 dark:text-red-300">Wpisz pełną liczbę od 1 do {calculation.automaticPanelCount}. Nie można przekroczyć limitu wynikającego z obliczeń.</span>}
              </label>
              <label className="block"><span className="text-sm font-semibold">Falownik hybrydowy</span><select className={fieldClass} value={calculation.selectedInverter ? String(calculation.selectedInverter.id) : ""} onChange={(e) => setInverterId(e.target.value)} disabled={calculation.compatibleInverters.length === 0}>{calculation.compatibleInverters.length === 0 ? <option value="">Brak zgodnego falownika</option> : calculation.compatibleInverters.map((item) => <option key={item.id} value={item.id}>{item.manufacturer} {item.model} — {item.power_kw} kW, {item.phase_count}F</option>)}</select></label>
            </>}
            {includesHeatPump && <label className="block"><span className="text-sm font-semibold">Pompa ciepła z listy ZUM</span><select className={fieldClass} value={selectedHeatPump ? String(selectedHeatPump.id) : ""} onChange={(e) => setHeatPumpId(e.target.value)} disabled={heatPumps.length === 0}>{heatPumps.length === 0 ? <option value="">Brak aktywnych pomp zgodnych z ZUM</option> : heatPumps.map((item) => <option key={item.id} value={item.id}>{item.manufacturer} {item.model} — {item.power_kw} kW ({item.pump_type})</option>)}</select></label>}
          </div>
        </div>

        <div className="mt-5">
          {!scopeEnabled[scope] && <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-700">Ten wariant będzie dostępny wkrótce.</div>}
          {consumptionMissing && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Wpisz roczne zużycie energii, aby obliczyć dopuszczalną moc PV.</div>}
          {connectionPowerMissing && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Wpisz moc przyłączeniową. Łączna moc istniejącej i nowej instalacji PV nie może jej przekroczyć.</div>}
          {existingPvDataMissing && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Uzupełnij moc i roczną produkcję istniejącej instalacji PV. Zostaną odjęte odpowiednio od mocy przyłączeniowej i zapotrzebowania klienta.</div>}
          {manualPanelCountInvalid && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Ręczna liczba paneli musi być pełną liczbą od 1 do {calculation.automaticPanelCount}. Mniejsza liczba jest dozwolona, ale nie można przekroczyć maksymalnej mocy wynikającej z obliczeń.</div>}
          {pvBelowMinimum && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Dobrana konfiguracja ma mniej niż wymagane {settings.min_pv_kw} kWp i nie spełnia zakresu programu.</div>}
          {!calculation.configurationComplete && !consumptionMissing && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Nie można jeszcze wyliczyć ceny. W katalogu GRANT brakuje co najmniej jednego urządzenia potrzebnego dla wybranego zakresu.</div>}
          <button type="button" disabled={!canCalculate} onClick={showResults} className="w-full rounded-2xl bg-[#5300EB] px-5 py-4 text-base font-bold text-white shadow-md shadow-[#5300EB]/20 transition hover:bg-[#4300BD] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:shadow-black/30 dark:disabled:bg-slate-700 dark:disabled:text-slate-400">Oblicz ofertę</button>
        </div>
      </section>

      {!loading && resultVisible && <section ref={resultsRef} className="relative scroll-mt-6 overflow-hidden rounded-3xl border border-[#00C0EB]/25 bg-white p-4 shadow-lg shadow-slate-200/70 ring-1 ring-[#00C0EB]/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/30 dark:ring-slate-800 sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#00C0EB] to-[#5300EB]" />
        <div className="mb-6 rounded-2xl border border-[#00C0EB]/25 bg-[#00C0EB]/10 px-4 py-3 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#007B96] dark:text-[#70E6FF]">Krok 2</p><h2 className="text-lg font-bold text-slate-950 dark:text-slate-100 sm:text-xl">Oferta dla klienta</h2></div>
        <p className="mb-5 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">Wynik ma charakter ofertowy. Prognozę wyliczono dla orientacji {calculation.orientationLabel.toLowerCase()}, nachylenia 35° i strat systemowych 14% według danych PVGIS dla Radzionkowa. Przyjęty uzysk to {Math.round(calculation.yieldPerKwp).toLocaleString("pl-PL")} kWh/kWp/rok. Ostateczna moc wymaga potwierdzenia w audycie energetycznym lub OZC.</p>
        {includesPv && <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/70 sm:p-5">
          <h3 className="text-base font-bold text-slate-950 dark:text-slate-100">Podsumowanie instalacji fotowoltaicznej</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">System dobrał moduły tak, aby możliwie dokładnie pokryć zapotrzebowanie bez przekroczenia wyliczonego limitu.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <ResultCard label="Zużycie do pokrycia" value={`${Math.round(calculation.remainingAnnualConsumption).toLocaleString("pl-PL")} kWh/rok`} detail={hasExistingPv ? "Po odjęciu produkcji istniejącej PV" : "Zużycie z ostatnich 12 miesięcy"} />
            <ResultCard label="Proponowana instalacja" value={`${calculation.pvPowerKw.toFixed(3)} kWp`} detail={selectedPanel ? `${calculation.panelCount} paneli × ${selectedPanel.power_wp} Wp` : "Brak panelu"} />
            <ResultCard label="Przewidywana produkcja" value={`${Math.round(calculation.forecastAnnualProduction).toLocaleString("pl-PL")} kWh/rok`} detail={includesHeatPump && calculation.forecastAnnualProduction > calculation.remainingAnnualConsumption ? "Uwzględnia dodatkową moc dla pompy ciepła" : `${Math.max(0, Math.round(calculation.remainingAnnualConsumption - calculation.forecastAnnualProduction)).toLocaleString("pl-PL")} kWh poniżej zużycia`} />
          </div>
          <div className="mt-4 rounded-2xl border border-[#5300EB]/15 bg-white p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <p className="font-bold text-slate-950 dark:text-slate-100">Dlaczego taka moc?</p>
            <ul className="mt-2 space-y-1.5">
              <li>• Orientacja: <strong>{calculation.orientationLabel}</strong> — przewidywany uzysk <strong>{Math.round(calculation.yieldPerKwp).toLocaleString("pl-PL")} kWh z 1 kWp rocznie</strong>.</li>
              <li>• Maksymalna moc przed dopasowaniem liczby paneli: <strong>{calculation.maximumAllowedKw.toFixed(3)} kWp</strong>.</li>
              <li>• Dostępna moc przyłączeniowa dla nowej instalacji: <strong>{calculation.availableConnectionKw.toFixed(3)} kW</strong>{calculation.connectionLimited ? " — to ona ogranicza instalację." : "."}</li>
              {hasExistingPv && <li>• Uwzględniono istniejącą instalację PV oraz jej dotychczasową produkcję.</li>}
              {calculation.extraAllowedKw > 0 && <li>• Dodano <strong>{calculation.extraAllowedKw.toFixed(3)} kWp</strong> dopuszczone przy montażu pompy ciepła.</li>}
            </ul>
          </div>
        </div>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><MoneyCard label="Cena netto" value={calculation.net} /><MoneyCard label="VAT" value={calculation.vat} /></div>
        <div className="mt-4 rounded-3xl bg-gradient-to-br from-[#00C0EB] to-[#5300EB] p-5 text-white shadow-xl shadow-[#00C0EB]/20 dark:shadow-black/30"><p className="text-sm font-semibold">Cena brutto {settings.vat_rate}%</p><p className="mt-1 text-3xl font-black">{money.format(calculation.gross)}</p></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#00C0EB]/25 bg-[#00C0EB]/10 p-4"><p className="text-sm text-[#007B96]">Łączny koszt kwalifikowany / grant</p><p className="mt-1 text-xl font-bold text-[#00677D]">{money.format(calculation.eligibleTotal)}</p>{includesPv && includesHeatPump && <p className="mt-1 text-xs text-[#007B96]">Maksymalnie {money.format(settings.combined_grant_limit_gross)} łącznie dla PV i pompy</p>}</div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-700">Wkład własny grantobiorcy</p><p className="mt-1 text-xl font-bold text-amber-800">{money.format(calculation.ownContribution)}</p></div></div>
        <div className="mt-4 rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-700"><div className="grid gap-2 sm:grid-cols-2"><p>Koszt kwalifikowany PV: <strong>{money.format(calculation.eligiblePv)}</strong></p><p>Koszt kwalifikowany pompy: <strong>{money.format(calculation.eligibleHeatPump)}</strong></p><p>VAT w kosztach kwalifikowanych: <strong>{canRecoverVat ? "NIE" : "TAK"}</strong></p></div></div>
        <div className="mt-5 rounded-3xl border border-[#5300EB]/20 bg-[#5300EB]/5 p-4 dark:border-[#5300EB]/40 dark:bg-[#5300EB]/10 sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5300EB] dark:text-[#BFA8FF]">CRM i e-mail</p>
            <h3 className="mt-1 text-base font-bold text-slate-950 dark:text-slate-100">Zapisz lub wyślij gotową ofertę</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {selectedClient ? `Wybrany klient: ${clientName}` : "Najpierw wybierz klienta w sekcji nad kalkulatorem."}
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void saveGrantOfferToCrm()}
              disabled={!selectedClientId || savingOffer || sendingEmail}
              className="rounded-2xl bg-[#5300EB] px-5 py-3 text-sm font-bold text-white shadow-md shadow-[#5300EB]/20 transition hover:bg-[#4300BD] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-700"
            >
              {savingOffer ? "Zapisywanie..." : currentOfferAlreadySaved ? "Oferta zapisana" : "Zapisz ofertę na leadzie"}
            </button>
            <button
              type="button"
              onClick={() => void sendGrantOfferEmail()}
              disabled={!selectedClientId || !effectiveClientEmail || savingOffer || sendingEmail}
              className="rounded-2xl bg-[#00C0EB] px-5 py-3 text-sm font-bold text-[#003D4A] shadow-md shadow-[#00C0EB]/20 transition hover:bg-[#00A9CF] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-700"
            >
              {sendingEmail ? "Wysyłanie..." : "Wyślij ofertę e-mailem"}
            </button>
          </div>
          {saveOfferStatus && <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">{saveOfferStatus}</p>}
          {emailStatus && <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{emailStatus}</p>}
          {savedOfferId && selectedClientId && <a href={`/clients/${selectedClientId}`} className="mt-3 inline-flex text-sm font-bold text-[#5300EB] underline decoration-[#00C0EB] underline-offset-4">Przejdź do karty leada</a>}
        </div>
        {canSeeInternalCosts && <div className="mt-4">
          <button type="button" onClick={() => setInternalCostsVisible((visible) => !visible)} aria-label={internalCostsVisible ? "Ukryj wewnętrzną kalkulację" : "Pokaż wewnętrzną kalkulację"} title={internalCostsVisible ? "Ukryj wewnętrzną kalkulację" : "Pokaż wewnętrzną kalkulację"} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-black text-slate-600 shadow-sm transition hover:border-[#5300EB] hover:text-[#5300EB] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{internalCostsVisible ? "−" : "+"}</button>
          {internalCostsVisible && <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-950"><p className="mb-3 font-bold text-slate-900 dark:text-slate-100">Wewnętrzna kalkulacja — tylko admin i owner</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{includesPv && <><p>Panele: <strong>{money.format(calculation.panelsNet)}</strong></p><p>Falownik: <strong>{money.format(calculation.inverterNet)}</strong></p><p>Montaż PV: <strong>{money.format(calculation.pvInstallationNet)}</strong></p><p>Konstrukcja: <strong>{money.format(calculation.roofNet)}</strong></p><p>Zabezpieczenia, przewody i monitoring: <strong>{money.format(calculation.pvTechnicalNet)}</strong></p></>}{includesHeatPump && <><p>Pompa ciepła: <strong>{money.format(calculation.heatPumpEquipmentNet)}</strong></p><p>Montaż pompy: <strong>{money.format(calculation.heatPumpInstallationNet)}</strong></p></>}<p>Transport i dokumentacja: <strong>{money.format(calculation.sharedNet)}</strong></p><p>Koszt realizacji: <strong>{money.format(calculation.purchaseCostNet)}</strong></p><p>Marża firmy: <strong>{money.format(calculation.companyMarginNet)}</strong></p><p>Operator / gwarancja: <strong>{money.format(calculation.operatorFeeNet)}</strong></p><p>Narzut handlowca: <strong>{money.format(settings.fixed_margin_gross)}</strong></p><p>Marketing: <strong>{money.format(settings.marketing_net)}</strong></p></div></div>}
        </div>}
      </section>}
      {loading && <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm dark:bg-slate-900">Ładowanie danych grantu...</p>}
    </div>
  );
}

function StepTitle({ number, color, children }: { number: string; color: "blue" | "emerald"; children: ReactNode }) {
  const colors = color === "emerald" ? "bg-[#00C0EB] text-[#007B96]" : "bg-[#5300EB] text-[#5300EB]";
  const [background, text] = colors.split(" ");
  return <div className={`flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] ${text}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs text-white ${background}`}>{number}</span>{children}</div>;
}

function ResultCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p>{detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}</div>;
}

function MoneyCard({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:ring-slate-800"><p className="text-sm text-slate-500">{label}</p><p className={strong ? "mt-1 text-xl font-bold text-[#5300EB] dark:text-[#BFA8FF]" : "mt-1 text-xl font-bold text-slate-950 dark:text-slate-100"}>{money.format(value)}</p></div>;
}
