import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const contractPdfPositions = {
  page1: {
    contractNumber: { x: 55, y: 739, size: 9 },
    placeAndDate: { x: 400, y: 650, size: 9 },
    clientName: { x: 40, y: 600, size: 9 },
    pesel: { x: 400, y: 600, size: 9 },
    secondClientName: { x: 40, y: 570, size: 9 },
    secondClientPesel: { x: 400, y: 570, size: 9 },
    contractAddress: { x: 40, y: 540, size: 9 },
    correspondenceAddress: { x: 40, y: 512, size: 9 },
    installationAddress: { x: 40, y: 485, size: 9 },
    email: { x: 40, y: 456, size: 9 },
    phone: { x: 400, y: 456, size: 9 },
    salesRepresentative: { x: 140, y: 295, size: 9 },
  },
  page2: {
    soldItems: { x: 30, y: 600, lineHeight: 14, size: 8 },
    additionalServicesList: { x: 50, y: 290, lineHeight: 12, size: 7 },
    additionalServicesCheck: { x: 45, y: 302 },
    optimizersCheck: { x: 44, y: 440 },
    storageCheck: { x: 44, y: 558 },
    backupCheck: { x: 185, y: 440 },
    emsCheck: { x: 399, y: 440 },

    inverterGridCheck: { x: 245, y: 500 },
    inverterHybridCheck: { x: 290, y: 794 },
    inverterMicroCheck: { x: 348, y: 500 },
    inverterOwnCheck: { x: 416, y: 500 },

    mountingSheetMetalCheck: { x: 43, y: 660 },
    mountingTileCheck: { x: 86, y: 660 },
    mountingGroundCheck: { x: 180, y: 660 },
    mountingCarportCheck: { x: 227, y: 660 },
    mountingFlatRoofCheck: { x: 274, y: 660 },

    pvPower: { x: 40, y: 765, size: 8 },
    panelModel: { x: 40, y: 735, size: 8 },
    panelPower: { x: 40, y: 705, size: 8 },

    inverterType: { x: 245, y: 765, size: 8 },
    inverterModel: { x: 245, y: 735, size: 8 },
    inverterPower: { x: 245, y: 705, size: 8 },

    storageBrand: { x: 207, y: 553, size: 8 },
    storageModel: { x: 207, y: 527, size: 8 },
    storageCapacity: { x: 207, y: 500, size: 8 },
  },
  page3: {
    pvGrossBeforeDiscount: { x: 370, y: 170, size: 9, maxWidth: 72 },
    pvGrossAfterDiscount: { x: 470, y: 170, size: 9, maxWidth: 88 },
    storageGrossBeforeDiscount: { x: 370, y: 140, size: 9, maxWidth: 72 },
    storageGrossAfterDiscount: { x: 470, y: 140, size: 9, maxWidth: 88 },
    emsGrossBeforeDiscount: { x: 370, y: 110, size: 9, maxWidth: 72 },
    emsGrossAfterDiscount: { x: 470, y: 110, size: 9, maxWidth: 88 },
  },
  page4: {
    backupGrossBeforeDiscount: { x: 370, y: 784, size: 9, maxWidth: 72 },
    backupGrossAfterDiscount: { x: 470, y: 784, size: 9, maxWidth: 88 },
    additionalServicesLabel: { x: 40, y: 758, size: 7 },
    additionalServicesGrossBeforeDiscount: { x: 370, y: 758, size: 9, maxWidth: 72 },
    additionalServicesGrossAfterDiscount: { x: 470, y: 758, size: 9, maxWidth: 88 },
    cashPaymentCheck: { x: 39, y: 559 },
    creditPaymentCheck: { x: 39, y: 426 },
    creditOwnContribution: { x: 160, y: 400, size: 9 },
    creditDeposit: { x: 355, y: 400, size: 9 },
    creditDepositDueDate: { x: 160, y: 375, size: 9 },
    deposit: { x: 155, y: 532, size: 9 },
    depositDueDate: { x: 308, y: 532, size: 9 },
    finalPayment: { x: 185, y: 510, size: 9 },
    totalGross: { x: 325, y: 705, size: 9, maxWidth: 95 },
    totalGrossWords: { x: 40, y: 684, size: 8 },
  },
  page7: {
    contractNumber: { x: 165, y: 755, size: 13 },
    visitWasScheduledStrike: { x1: 443, y1: 602, x2: 459, y2: 602 },
    visitWasNotScheduledStrike: { x1: 461, y1: 602, x2: 490, y2: 602 },
    variant1ACheck: { x: 42, y: 495 },
    variant1BCheck: { x: 42, y: 428 },
  },
  page9: {
    contractNumber: { x: 180, y: 744, size: 13 },
  },
  // --- Inserted new positions for page11 and page12 ---
  page11: {
    contractNumber: { x: 155, y: 757, size: 13 },
  },
  page12: {
    client1MarketingEmailYes: { x: 37, y: 735 },
    client1MarketingEmailNo: { x: 75, y: 735 },
    client1MarketingPhoneYes: { x: 37, y: 689 },
    client1MarketingPhoneNo: { x: 75, y: 689 },
    client1PhotoConsentYes: { x: 37, y: 642 },
    client1PhotoConsentNo: { x: 75, y: 642 },

    client2MarketingEmailYes: { x: 37, y: 579 },
    client2MarketingEmailNo: { x: 75, y: 579 },
    client2MarketingPhoneYes: { x: 37, y: 533 },
    client2MarketingPhoneNo: { x: 75, y: 533 },
    client2PhotoConsentYes: { x: 37, y: 486 },
    client2PhotoConsentNo: { x: 75, y: 486 },
  },
} as const;

const SHOW_CALIBRATION_MARKERS = false;

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function money(value: unknown) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue)) {
    return "0,00 zł";
  }

  return `${numberValue.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} zł`;
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

const ones = [
  "",
  "jeden",
  "dwa",
  "trzy",
  "cztery",
  "pięć",
  "sześć",
  "siedem",
  "osiem",
  "dziewięć",
];

const teens = [
  "dziesięć",
  "jedenaście",
  "dwanaście",
  "trzynaście",
  "czternaście",
  "piętnaście",
  "szesnaście",
  "siedemnaście",
  "osiemnaście",
  "dziewiętnaście",
];

const tens = ["", "", "dwadzieścia", "trzydzieści", "czterdzieści", "pięćdziesiąt", "sześćdziesiąt", "siedemdziesiąt", "osiemdziesiąt", "dziewięćdziesiąt"];

const hundreds = ["", "sto", "dwieście", "trzysta", "czterysta", "pięćset", "sześćset", "siedemset", "osiemset", "dziewięćset"];

function declension(value: number, forms: [string, string, string]) {
  const lastTwo = value % 100;
  const last = value % 10;

  if (value === 1) return forms[0];
  if (lastTwo >= 12 && lastTwo <= 14) return forms[2];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function threeDigitNumberToWords(value: number) {
  const h = Math.floor(value / 100);
  const t = Math.floor((value % 100) / 10);
  const o = value % 10;
  const parts: string[] = [];

  if (h) parts.push(hundreds[h]);

  if (t === 1) {
    parts.push(teens[o]);
  } else {
    if (t) parts.push(tens[t]);
    if (o) parts.push(ones[o]);
  }

  return parts.join(" ");
}

function integerToWords(value: number) {
  if (value === 0) return "zero";

  const groups: Array<{ value: number; forms: [string, string, string] }> = [
    { value: 1_000_000, forms: ["milion", "miliony", "milionów"] },
    { value: 1_000, forms: ["tysiąc", "tysiące", "tysięcy"] },
    { value: 1, forms: ["", "", ""] },
  ];

  const parts: string[] = [];
  let remaining = value;

  for (const group of groups) {
    const groupValue = Math.floor(remaining / group.value);
    remaining %= group.value;

    if (!groupValue) continue;

    const groupWords = threeDigitNumberToWords(groupValue);
    const groupName = group.value === 1 ? "" : declension(groupValue, group.forms);

    if (group.value !== 1 && groupValue === 1) {
      parts.push(groupName);
    } else {
      parts.push([groupWords, groupName].filter(Boolean).join(" "));
    }
  }

  return parts.join(" ");
}

function amountToWords(value: unknown) {
  const numericValue = Math.max(0, Math.round(toNumber(value) * 100) / 100);
  const zloty = Math.floor(numericValue);
  const grosze = Math.round((numericValue - zloty) * 100);
  const zlotyWord = declension(zloty, ["złoty", "złote", "złotych"]);

  return `${integerToWords(zloty)} ${zlotyWord} ${String(grosze).padStart(2, "0")}/100`;
}

function getCustomerData(sale: Record<string, any>, client: Record<string, any> | null) {
  const customerData = (sale.customer_data || {}) as Record<string, any>;

  const contractAddress =
    customerData.contract_address ||
    [
      customerData.contract_street,
      customerData.contract_building,
      customerData.contract_postal,
      customerData.contract_city,
    ]
      .filter(Boolean)
      .join(" ") ||
    client?.address ||
    [client?.street, client?.building_number, client?.postal_code, client?.city]
      .filter(Boolean)
      .join(" ") ||
    "";

  const installationAddress =
    customerData.installation_address ||
    [
      customerData.installation_street,
      customerData.installation_building,
      customerData.installation_postal,
      customerData.installation_city,
    ]
      .filter(Boolean)
      .join(" ") ||
    contractAddress;

  return {
    name:
      customerData.full_name ||
      customerData.name ||
      sale.customer_name ||
      sale.client_name ||
      client?.full_name ||
      client?.company_name ||
      "",
    pesel: customerData.pesel || sale.customer_pesel || client?.pesel || "",
    phone: customerData.phone || sale.customer_phone || client?.phone || "",
    email: customerData.email || sale.customer_email || client?.email || "",
    contractAddress,
    correspondenceAddress: customerData.correspondence_address || contractAddress,
    installationAddress,
    secondClientName: customerData.second_client_name || "",
    secondClientPesel: customerData.second_client_pesel || "",
    contractNumber: sale.contract_number || customerData.contract_number || "",
    contractPlace: customerData.contract_place || "",
    contractDate: customerData.contract_date || "",
    depositDueDate: customerData.deposit_due_date || "",
    paymentMethod: customerData.payment_method || sale.payment_method || "gotówka",
    ownContributionAmount: customerData.own_contribution_amount || sale.own_contribution_amount || 0,
    visitPreviouslyScheduled: customerData.visit_previously_scheduled,
    realizationVariant: customerData.realization_variant || "",
  };
}

function getSoldItems(sale: Record<string, any>) {
  const directSoldItems = sale.sold_items;

  if (Array.isArray(directSoldItems)) {
    return directSoldItems.map((item) => String(item)).filter(Boolean);
  }

  const offerData = sale.offer_data || sale.offer_snapshot || {};
  const offerSoldItems = offerData.soldItems || offerData.sold_items;

  if (Array.isArray(offerSoldItems)) {
    return offerSoldItems.map((item) => String(item)).filter(Boolean);
  }

  return ["Instalacja fotowoltaiczna i/lub magazyn energii zgodnie z oferta"].filter(Boolean);
}

function getNestedValue(source: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = key.split(".").reduce<any>((current, part) => current?.[part], source);

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function getFirstNumber(source: Record<string, any>, keys: string[]) {
  const value = getNestedValue(source, keys);
  return toNumber(value);
}

function getFinancialData(
  sale: Record<string, any>,
  totalGrossFallback: unknown,
  depositGrossFallback: unknown,
  breakdownFallback?: {
    pvGross?: unknown;
    storageGross?: unknown;
    emsGross?: unknown;
    backupGross?: unknown;
    additionalServicesGross?: unknown;
    pvGrossBeforeDiscount?: unknown;
    pvGrossAfterDiscount?: unknown;
    storageGrossBeforeDiscount?: unknown;
    storageGrossAfterDiscount?: unknown;
    emsGrossBeforeDiscount?: unknown;
    emsGrossAfterDiscount?: unknown;
    backupGrossBeforeDiscount?: unknown;
    backupGrossAfterDiscount?: unknown;
    additionalServicesGrossBeforeDiscount?: unknown;
    additionalServicesGrossAfterDiscount?: unknown;
  }
) {
  const offerSnapshot = (sale.offer_snapshot || {}) as Record<string, any>;
  const offerData = (sale.offer_data || offerSnapshot.offer_data || {}) as Record<string, any>;
  const formData = (offerData.form || offerSnapshot.form || {}) as Record<string, any>;
  const resultData = (offerData.result || offerSnapshot.result || {}) as Record<string, any>;
  const customerData = (sale.customer_data || {}) as Record<string, any>;

  const source = {
    ...offerSnapshot,
    ...offerData,
    ...formData,
    ...resultData,
    ...customerData,
    offerSnapshot,
    offerData,
    formData,
    resultData,
    customerData,
  };

  const totalGross =
    getFirstNumber(source, [
      "totalGross",
      "finalGross",
      "contractValueGross",
      "contract_value_gross",
      "resultData.totalGross",
      "resultData.finalGross",
      "customerData.totalGross",
    ]) || toNumber(totalGrossFallback);

  const depositGross =
    getFirstNumber(source, [
      "depositAmount",
      "depositGross",
      "deposit_gross",
      "deposit_amount",
      "customerData.deposit_amount",
      "customerData.depositAmount",
    ]) || toNumber(depositGrossFallback);

  const pvGross =
    toNumber(breakdownFallback?.pvGross) ||
    getFirstNumber(source, [
      "contractPvGross",
      "contract_pv_gross",
      "pvGross",
      "pv_gross",
      "pvPriceGross",
      "resultData.pvGross",
      "resultData.pvPriceGross",
      "customerData.contract_pv_gross",
    ]);

  const storageGross =
    toNumber(breakdownFallback?.storageGross) ||
    getFirstNumber(source, [
      "contractStorageGross",
      "contract_storage_gross",
      "storageGross",
      "storage_gross",
      "energyStorageGross",
      "storagePriceGross",
      "resultData.storageGross",
      "resultData.storagePriceGross",
      "customerData.contract_storage_gross",
    ]);

  const emsGross =
    toNumber(breakdownFallback?.emsGross) ||
    getFirstNumber(source, [
      "contractEmsGross",
      "contract_ems_gross",
      "emsGross",
      "ems_gross",
      "emsPriceGross",
      "resultData.emsGross",
      "resultData.emsPriceGross",
      "customerData.contract_ems_gross",
    ]);

  const backupGross =
    toNumber(breakdownFallback?.backupGross) ||
    getFirstNumber(source, [
      "contractBackupGross",
      "contract_backup_gross",
      "backupGross",
      "backup_gross",
      "backupPriceGross",
      "resultData.backupGross",
      "resultData.backupPriceGross",
      "customerData.contract_backup_gross",
    ]);

  const additionalServicesGross =
    toNumber(breakdownFallback?.additionalServicesGross) ||
    getFirstNumber(source, [
      "contractAdditionalServicesGross",
      "contract_additional_services_gross",
      "additionalServicesGross",
      "additional_services_gross",
      "servicesGross",
      "resultData.additionalServicesGross",
      "customerData.contract_additional_services_gross",
    ]);

  const pvGrossBeforeDiscount =
    toNumber(breakdownFallback?.pvGrossBeforeDiscount) ||
    getFirstNumber(source, ["contract_pv_gross_before_discount", "customerData.contract_pv_gross_before_discount"]);
  const pvGrossAfterDiscount =
    toNumber(breakdownFallback?.pvGrossAfterDiscount) ||
    getFirstNumber(source, ["contract_pv_gross_after_discount", "customerData.contract_pv_gross_after_discount"]);

  const storageGrossBeforeDiscount =
    toNumber(breakdownFallback?.storageGrossBeforeDiscount) ||
    getFirstNumber(source, ["contract_storage_gross_before_discount", "customerData.contract_storage_gross_before_discount"]);
  const storageGrossAfterDiscount =
    toNumber(breakdownFallback?.storageGrossAfterDiscount) ||
    getFirstNumber(source, ["contract_storage_gross_after_discount", "customerData.contract_storage_gross_after_discount"]);

  const emsGrossBeforeDiscount =
    toNumber(breakdownFallback?.emsGrossBeforeDiscount) ||
    getFirstNumber(source, ["contract_ems_gross_before_discount", "customerData.contract_ems_gross_before_discount"]);
  const emsGrossAfterDiscount =
    toNumber(breakdownFallback?.emsGrossAfterDiscount) ||
    getFirstNumber(source, ["contract_ems_gross_after_discount", "customerData.contract_ems_gross_after_discount"]);

  const backupGrossBeforeDiscount =
    toNumber(breakdownFallback?.backupGrossBeforeDiscount) ||
    getFirstNumber(source, ["contract_backup_gross_before_discount", "customerData.contract_backup_gross_before_discount"]);
  const backupGrossAfterDiscount =
    toNumber(breakdownFallback?.backupGrossAfterDiscount) ||
    getFirstNumber(source, ["contract_backup_gross_after_discount", "customerData.contract_backup_gross_after_discount"]);

  const additionalServicesGrossBeforeDiscount =
    toNumber(breakdownFallback?.additionalServicesGrossBeforeDiscount) ||
    getFirstNumber(source, [
      "contract_additional_services_gross_before_discount",
      "customerData.contract_additional_services_gross_before_discount",
    ]);
  const additionalServicesGrossAfterDiscount =
    toNumber(breakdownFallback?.additionalServicesGrossAfterDiscount) ||
    getFirstNumber(source, [
      "contract_additional_services_gross_after_discount",
      "customerData.contract_additional_services_gross_after_discount",
    ]);

  const knownBreakdownGross = pvGross + storageGross + emsGross + backupGross + additionalServicesGross;
  const shouldFallbackToSingleLine = knownBreakdownGross <= 0 && totalGross > 0;

  return {
    pvGross: shouldFallbackToSingleLine ? totalGross : pvGross,
    storageGross,
    emsGross,
    backupGross,
    additionalServicesGross,
    pvGrossBeforeDiscount,
    pvGrossAfterDiscount: pvGrossAfterDiscount || (shouldFallbackToSingleLine ? totalGross : pvGross),
    storageGrossBeforeDiscount,
    storageGrossAfterDiscount: storageGrossAfterDiscount || storageGross,
    emsGrossBeforeDiscount,
    emsGrossAfterDiscount: emsGrossAfterDiscount || emsGross,
    backupGrossBeforeDiscount,
    backupGrossAfterDiscount: backupGrossAfterDiscount || backupGross,
    additionalServicesGrossBeforeDiscount,
    additionalServicesGrossAfterDiscount: additionalServicesGrossAfterDiscount || additionalServicesGross,
    totalGross,
    depositGross,
    finalPaymentGross: Math.max(totalGross - depositGross, 0),
    totalGrossWords: amountToWords(totalGross),
  };
}

function getAdditionalProductsData(sale: Record<string, any>) {
  const offerSnapshot = (sale.offer_snapshot || {}) as Record<string, any>;
  const offerData = (sale.offer_data || offerSnapshot.offer_data || {}) as Record<string, any>;
  const formData = (offerData.form || offerSnapshot.form || {}) as Record<string, any>;
  const resultData = (offerData.result || offerSnapshot.result || {}) as Record<string, any>;
  const customerData = (sale.customer_data || {}) as Record<string, any>;
  const vatRate = toNumber(resultData.vatRate || offerData.vatRate || customerData.vatRate || 8) || 8;

  const possibleArrays = [
    customerData.additional_products,
    customerData.additionalProducts,
    customerData.additional_services,
    customerData.additionalServices,
    offerData.additional_products,
    offerData.additionalProducts,
    offerData.additional_services,
    offerData.additionalServices,
    formData.additional_products,
    formData.additionalProducts,
    formData.additional_services,
    formData.additionalServices,
    resultData.additional_products,
    resultData.additionalProducts,
    resultData.additional_services,
    resultData.additionalServices,
  ];

  const productsSource = possibleArrays.find((value) => Array.isArray(value)) as unknown[] | undefined;

  if (!productsSource) {
    return {
      label: "",
      grossTotal: 0,
    };
  }

  const products = productsSource
    .map((item) => {
      if (typeof item === "string") {
        return {
          name: cleanText(item),
          quantity: 1,
          unitLabel: "",
          net: 0,
          gross: 0,
        };
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const product = item as Record<string, any>;

      const quantity = Math.max(1, Number(product.quantity || 1));
      const unitLabel = cleanText(product.unit_label || product.unitLabel || "");

      return {
        name: cleanText(
          product.name ||
            product.label ||
            product.title ||
            product.productName ||
            product.product_name ||
            product.description ||
            product.serviceName ||
            product.service_name ||
            ""
        ),
        quantity,
        unitLabel,
        net: toNumber(
          product.totalNet ||
            product.total_net ||
            product.net ||
            product.netPrice ||
            product.net_price ||
            product.priceNet ||
            product.price_net ||
            product.valueNet ||
            product.value_net ||
            product.amountNet ||
            product.amount_net
        ),
        gross: toNumber(
          product.gross ||
            product.grossPrice ||
            product.gross_price ||
            product.priceGross ||
            product.price_gross ||
            product.valueGross ||
            product.value_gross ||
            product.amountGross ||
            product.amount_gross ||
            product.price ||
            product.value ||
            product.amount
        ),
      };
    })
    .filter((item): item is { name: string; quantity: number; unitLabel: string; net: number; gross: number } => Boolean(item?.name));

  return {
    items: products.map((item) => {
      const net = item.net || (item.gross ? item.gross / (1 + vatRate / 100) : 0);
      const gross = item.gross || net * (1 + vatRate / 100);

      return {
        ...item,
        net,
        gross,
      };
    }),
    label: products
      .map((item) => {
        const quantityPart = item.quantity > 1
          ? ` x ${item.quantity}${item.unitLabel ? ` ${item.unitLabel}` : ""}`
          : "";

        return `${item.name}${quantityPart}`;
      })
      .join(", "),
    grossTotal: products.reduce((sum, item) => {
      const net = item.net || (item.gross ? item.gross / (1 + vatRate / 100) : 0);
      const gross = item.gross || net * (1 + vatRate / 100);
      return sum + gross;
    }, 0),
  };
}

function getTechnicalData(sale: Record<string, any>) {
  const offerSnapshot = (sale.offer_snapshot || {}) as Record<string, any>;
  const offerData = (sale.offer_data || offerSnapshot.offer_data || {}) as Record<string, any>;
  const formData = (offerData.form || offerSnapshot.form || {}) as Record<string, any>;
  const resultData = (offerData.result || offerSnapshot.result || {}) as Record<string, any>;

  const source = {
    ...offerSnapshot,
    ...offerData,
    ...formData,
    ...resultData,
    offerData,
    formData,
    resultData,
  };

  return {
    hasPv: Boolean(
      getNestedValue(source, ["withPv", "hasPv", "pv", "formData.withPv", "formData.hasPv", "offer_type"])
    ),
    hasStorage: Boolean(
      getNestedValue(source, ["withStorage", "hasStorage", "energyStorage", "storage", "formData.withStorage", "formData.energyStorage"])
    ),
    hasEms: Boolean(
      getNestedValue(source, ["withEms", "ems", "formData.withEms", "formData.ems"])
    ),
    hasBackup: Boolean(
      getNestedValue(source, ["withBackup", "backup", "formData.withBackup", "formData.backup"])
    ),
    pvPowerKw: getNestedValue(source, ["pvPowerKw", "pv_power_kw", "powerKw", "formData.pvPowerKw", "resultData.pvPowerKw"]),
    panelModel: getNestedValue(source, [
      "panelDisplayName",
      "panel_display_name",
      "displayPanelName",
      "display_panel_name",
      "panelName",
      "panelModelDisplayName",
      "panel_model_display_name",
      "resultData.panelDisplayName",
      "resultData.panel_display_name",
      "resultData.panelName",
      "offerData.panelDisplayName",
      "offerData.panel_display_name",
      "formData.panelDisplayName",
      "formData.panel_display_name",
      "panelModel",
      "panel",
      "moduleName",
      "formData.panelName",
      "formData.panelModel",
    ]),
    panelPowerWp: getNestedValue(source, ["panelPowerWp", "panel_power_wp", "modulePowerWp", "formData.panelPowerWp", "resultData.panelPowerWp"]),
    panelCount: getNestedValue(source, ["panelCount", "panel_count", "modulesCount", "formData.panelCount", "resultData.panelCount"]),
    inverterType: getNestedValue(source, [
      "inverterType",
      "inverter_type",
      "selectedInverterType",
      "selected_inverter_type",
      "formData.inverterType",
      "formData.selectedInverterType",
      "resultData.inverterType",
      "offerData.inverterType",
    ]),
    inverterModel: getNestedValue(source, [
      "inverterDisplayName",
      "inverter_display_name",
      "displayInverterName",
      "display_inverter_name",
      "resultData.inverterDisplayName",
      "resultData.inverter_display_name",
      "resultData.inverter",
      "offerData.inverterDisplayName",
      "offerData.inverter_display_name",
      "formData.inverterDisplayName",
      "formData.inverter_display_name",
      "inverter",
      "inverterModel",
      "inverterName",
      "formData.inverter",
    ]),
    inverterPowerKw: getNestedValue(source, [
      "inverterPowerKw",
      "inverter_power_kw",
      "inverterPower",
      "inverter_power",
      "inverterKw",
      "inverter_kw",
      "powerKw",
      "power_kw",
      "selectedInverterPowerKw",
      "selected_inverter_power_kw",
      "formData.inverterPowerKw",
      "formData.inverter_power_kw",
      "formData.inverterPower",
      "formData.inverter_power",
      "formData.inverterKw",
      "formData.inverter_kw",
      "formData.selectedInverterPowerKw",
      "resultData.inverterPowerKw",
      "resultData.inverter_power_kw",
      "resultData.inverterPower",
      "offerData.inverterPowerKw",
      "offerData.inverter_power_kw",
    ]),
    mountingType: getNestedValue(source, ["mountingType", "mount_type", "roofType", "formData.mountingType", "formData.roofType"]),
    storageBrand: getNestedValue(source, ["storageBrand", "batteryBrand", "formData.storageBrand"]),
    storageModel: getNestedValue(source, [
      "storageDisplayName",
      "storage_display_name",
      "energyStorageDisplayName",
      "energy_storage_display_name",
      "batteryDisplayName",
      "battery_display_name",
      "resultData.storageDisplayName",
      "resultData.storage_display_name",
      "resultData.energyStorageDisplayName",
      "resultData.energy_storage_display_name",
      "resultData.energyStorage",
      "offerData.storageDisplayName",
      "offerData.storage_display_name",
      "formData.storageDisplayName",
      "formData.storage_display_name",
      "storageModel",
      "energyStorage",
      "batteryModel",
      "formData.storageModel",
      "formData.energyStorage",
    ]),
    storageCapacityKwh: getNestedValue(source, ["storageCapacityKwh", "storage_capacity_kwh", "batteryCapacityKwh", "formData.storageCapacityKwh", "resultData.storageCapacityKwh"]),
  };
}

function inferInverterPowerKwFromModel(value: unknown) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return "";

  const match = rawValue.match(/(?:SUN[-_\s]*)?(\d+(?:[.,]\d+)?)\s*K(?:W)?/i);

  if (!match?.[1]) return "";

  return match[1].replace(",", ".");
}

function asPrintable(value: unknown, suffix = "") {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  return `${text}${suffix}`.toUpperCase();
}

function preserveTechnicalAbbreviations(text: string) {
  return text
    .replace(/KWH/g, "kWh")
    .replace(/KWP/g, "kWp")
    .replace(/WP/g, "Wp")
    .replace(/KW/g, "kW");
}

// Equipment display name helpers
const equipmentDisplayNames: Record<string, string> = {
  LONGI_SOLAR_470_FB: "Longi Solar 470 Full Black",
};

function humanizeEquipmentName(value: unknown) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return "";
  }

  if (equipmentDisplayNames[rawValue]) {
    return equipmentDisplayNames[rawValue].toUpperCase();
  }

  return rawValue
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeEquipmentKey(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseStorageDetails(technicalData: ReturnType<typeof getTechnicalData>) {
  const explicitBrand = humanizeEquipmentName(technicalData.storageBrand).trim();
  const explicitCapacity = asPrintable(technicalData.storageCapacityKwh, " kWh").trim();
  const rawModelWithQuantity = humanizeEquipmentName(technicalData.storageModel).trim();
  const rawModel = rawModelWithQuantity.replace(/^\s*\d+\s*[xX×]\s+/, "").trim();

  if (!rawModel) {
    return {
      brand: explicitBrand,
      model: "",
      capacity: explicitCapacity,
    };
  }

  const capacityMatch = rawModel.match(/(\d+(?:[.,]\d+)?)\s*kWh/i);
  const inferredCapacity = capacityMatch?.[0]?.replace(",", ".") || "";
  const withoutCapacity = rawModel.replace(/\s*\d+(?:[.,]\d+)?\s*kWh\s*/i, " ").trim();

  const knownTwoWordStorageBrands = ["LITHIUM VALLEY"];
  const matchingTwoWordBrand = knownTwoWordStorageBrands.find((brand) =>
    withoutCapacity.toUpperCase().startsWith(brand)
  );

  const parts = withoutCapacity.split(/\s+/).filter(Boolean);
  const inferredBrand = explicitBrand || matchingTwoWordBrand || parts[0] || "";
  const inferredModel = explicitBrand
    ? withoutCapacity
    : matchingTwoWordBrand
      ? withoutCapacity.slice(matchingTwoWordBrand.length).trim()
      : parts.slice(1).join(" ");

  return {
    brand: explicitBrand || inferredBrand,
    model: inferredModel,
    capacity: explicitCapacity || inferredCapacity,
  };
}

function formatDate(value: Date) {
  return value.toLocaleDateString("pl-PL");
}

function getQueryValue(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key);
  return value && value.trim() ? value.trim() : null;
}

function formatDateFromInput(value: string | null) {
  if (!value) {
    return formatDate(new Date());
  }

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return formatDate(new Date());
  }

  return parsedDate.toLocaleDateString("pl-PL");
}

function readBooleanLike(value: unknown) {
  if (value === true) return true;
  if (value === false) return false;

  const normalized = String(value ?? "").trim().toLowerCase();

  if (["true", "tak", "yes", "1", "on"].includes(normalized)) return true;
  if (["false", "nie", "no", "0", "off"].includes(normalized)) return false;

  return null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Brak konfiguracji Supabase dla generatora umow." },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (saleError || !sale) {
    return NextResponse.json(
      { error: "Nie znaleziono sprzedazy." },
      { status: 404 }
    );
  }

  let client: Record<string, any> | null = null;

  if (sale.client_id) {
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", sale.client_id)
      .maybeSingle();

    client = clientData;
  }

  let sellerProfile: Record<string, any> | null = null;

  if (sale.created_by || sale.seller_id || sale.assigned_user_id) {
    const sellerId = sale.created_by || sale.seller_id || sale.assigned_user_id;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", sellerId)
      .maybeSingle();

    sellerProfile = profileData;
  }

  const templatePath = path.join(process.cwd(), "public", "templates", "Umowa.pdf");
  const templateBytes = await readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  const regularFontBytes = await readFile(path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf"));
  let boldFontBytes = regularFontBytes;

  try {
    boldFontBytes = await readFile(path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf"));
  } catch {
    boldFontBytes = regularFontBytes;
  }

  const regularFont = await pdfDoc.embedFont(regularFontBytes, { subset: false });
  const boldFont = await pdfDoc.embedFont(boldFontBytes, { subset: false });

  const customerFromDb = getCustomerData(sale, client);
  const customer = {
    name: getQueryValue(request, "clientName") || customerFromDb.name,
    pesel: getQueryValue(request, "pesel") || customerFromDb.pesel,
    phone: getQueryValue(request, "phone") || customerFromDb.phone,
    email: getQueryValue(request, "email") || customerFromDb.email,
    contractAddress: getQueryValue(request, "contractAddress") || customerFromDb.contractAddress,
    correspondenceAddress:
      getQueryValue(request, "correspondenceAddress") || customerFromDb.correspondenceAddress,
    installationAddress:
      getQueryValue(request, "installationAddress") || customerFromDb.installationAddress,
    secondClientName: getQueryValue(request, "secondClientName") || customerFromDb.secondClientName,
    secondClientPesel: getQueryValue(request, "secondClientPesel") || customerFromDb.secondClientPesel,
    contractNumber: getQueryValue(request, "contractNumber") || customerFromDb.contractNumber,
    contractPlace: getQueryValue(request, "contractPlace") || customerFromDb.contractPlace,
    contractDate: getQueryValue(request, "contractDate") || customerFromDb.contractDate,
    depositDueDate: getQueryValue(request, "depositDueDate") || customerFromDb.depositDueDate,
    visitPreviouslyScheduled:
      getQueryValue(request, "visitPreviouslyScheduled") ||
      (customerFromDb.visitPreviouslyScheduled === true
        ? "true"
        : customerFromDb.visitPreviouslyScheduled === false
          ? "false"
          : ""),
    realizationVariant: getQueryValue(request, "realizationVariant") || customerFromDb.realizationVariant,
  };

  const soldItems = getSoldItems(sale);
  const additionalProductsData = getAdditionalProductsData(sale);
  const technicalData = getTechnicalData(sale);
  const saleNumber = customer.contractNumber || sale.contract_number || sale.public_id || sale.sale_id || sale.id;
  const totalGross = getQueryValue(request, "totalGross") || sale.contract_value || sale.total_gross || sale.final_gross || 0;
  const depositGross = getQueryValue(request, "depositAmount") || sale.deposit_amount || sale.deposit_gross || 0;
  const financialData = getFinancialData(sale, totalGross, depositGross, {
    pvGross: getQueryValue(request, "pvGross"),
    storageGross: getQueryValue(request, "storageGross"),
    emsGross: getQueryValue(request, "emsGross"),
    backupGross: getQueryValue(request, "backupGross"),
    additionalServicesGross: getQueryValue(request, "additionalServicesGross") || additionalProductsData.grossTotal,
    pvGrossBeforeDiscount: getQueryValue(request, "pvGrossBeforeDiscount"),
    pvGrossAfterDiscount: getQueryValue(request, "pvGrossAfterDiscount"),
    storageGrossBeforeDiscount: getQueryValue(request, "storageGrossBeforeDiscount"),
    storageGrossAfterDiscount: getQueryValue(request, "storageGrossAfterDiscount"),
    emsGrossBeforeDiscount: getQueryValue(request, "emsGrossBeforeDiscount"),
    emsGrossAfterDiscount: getQueryValue(request, "emsGrossAfterDiscount"),
    backupGrossBeforeDiscount: getQueryValue(request, "backupGrossBeforeDiscount"),
    backupGrossAfterDiscount: getQueryValue(request, "backupGrossAfterDiscount"),
    additionalServicesGrossBeforeDiscount: getQueryValue(request, "additionalServicesGrossBeforeDiscount"),
    additionalServicesGrossAfterDiscount: getQueryValue(request, "additionalServicesGrossAfterDiscount"),
  });
  const contractPlace = customer.contractPlace || "";
  const today = formatDateFromInput(customer.contractDate || null);
  const salesRepresentativeName =
    (sale.customer_data as Record<string, any> | null)?.sales_representative_name ||
    sellerProfile?.display_name ||
    "";

  const pages = pdfDoc.getPages();

  function drawOnPage(
    pageIndex: number,
    text: string,
    x: number,
    y: number,
    options?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> }
  ) {
    const page = pages[pageIndex];

    if (!page) return;

    const normalizedText = preserveTechnicalAbbreviations(
      cleanText(text).toUpperCase()
    );

    page.drawText(normalizedText, {
      x,
      y,
      size: options?.size ?? 9,
      font: options?.bold ? boldFont : regularFont,
      color: options?.color ?? rgb(0.08, 0.1, 0.14),
    });
  }

  function drawCheck(pageIndex: number, x: number, y: number) {
    drawOnPage(pageIndex, "X", x, y, { size: 10, bold: true, color: rgb(0.04, 0.45, 0.42) });
  }

  function drawStrikeLine(pageIndex: number, x1: number, y1: number, x2: number, y2: number) {
    const page = pages[pageIndex];

    if (!page) return;

    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 2.5,
      color: rgb(0.08, 0.1, 0.14),
    });
  }

  function drawRightAlignedOnPage(
    pageIndex: number,
    text: string,
    rightX: number,
    y: number,
    options?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> }
  ) {
    const page = pages[pageIndex];

    if (!page) return;

    const font = options?.bold ? boldFont : regularFont;
    const size = options?.size ?? 9;
    const cleanedText = cleanText(text);
    const textWidth = font.widthOfTextAtSize(cleanedText, size);

    page.drawText(cleanedText, {
      x: rightX - textWidth,
      y,
      size,
      font,
      color: options?.color ?? rgb(0.08, 0.1, 0.14),
    });
  }

  function drawMoneyOnPage(
    pageIndex: number,
    value: unknown,
    x: number,
    y: number,
    options?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> }
  ) {
    const page = pages[pageIndex];

    if (!page) return;

    page.drawText(cleanText(money(value)), {
      x,
      y,
      size: options?.size ?? 9,
      font: options?.bold ? boldFont : regularFont,
      color: options?.color ?? rgb(0.08, 0.1, 0.14),
    });
  }

  function drawCalibrationMarker(pageIndex: number, x: number, y: number, label: string) {
    if (!SHOW_CALIBRATION_MARKERS) return;

    const page = pages[pageIndex];

    if (!page) return;

    const color = rgb(0.95, 0.05, 0.05);

    page.drawLine({
      start: { x: x - 5, y },
      end: { x: x + 5, y },
      thickness: 0.8,
      color,
    });
    page.drawLine({
      start: { x, y: y - 5 },
      end: { x, y: y + 5 },
      thickness: 0.8,
      color,
    });
    page.drawText(cleanText(label), {
      x: x + 6,
      y: y + 4,
      size: 5,
      font: boldFont,
      color,
    });
  }

  function drawCalibrationMarkers() {
    if (!SHOW_CALIBRATION_MARKERS) return;

    drawCalibrationMarker(0, contractPdfPositions.page1.contractNumber.x, contractPdfPositions.page1.contractNumber.y, "p1 nr");
    drawCalibrationMarker(0, contractPdfPositions.page1.placeAndDate.x, contractPdfPositions.page1.placeAndDate.y, "p1 data");
    drawCalibrationMarker(0, contractPdfPositions.page1.clientName.x, contractPdfPositions.page1.clientName.y, "p1 klient");
    drawCalibrationMarker(0, contractPdfPositions.page1.pesel.x, contractPdfPositions.page1.pesel.y, "p1 pesel");
    drawCalibrationMarker(0, contractPdfPositions.page1.contractAddress.x, contractPdfPositions.page1.contractAddress.y, "p1 adres zam");
    drawCalibrationMarker(0, contractPdfPositions.page1.correspondenceAddress.x, contractPdfPositions.page1.correspondenceAddress.y, "p1 adres kor");
    drawCalibrationMarker(0, contractPdfPositions.page1.installationAddress.x, contractPdfPositions.page1.installationAddress.y, "p1 adres mont");
    drawCalibrationMarker(0, contractPdfPositions.page1.email.x, contractPdfPositions.page1.email.y, "p1 email");
    drawCalibrationMarker(0, contractPdfPositions.page1.phone.x, contractPdfPositions.page1.phone.y, "p1 tel");

    drawCalibrationMarker(1, 170, 648, "p2 moc PV");
    drawCalibrationMarker(1, 405, 648, "p2 typ inv");
    drawCalibrationMarker(1, 170, 624, "p2 panel");
    drawCalibrationMarker(1, 405, 624, "p2 inv");
    drawCalibrationMarker(1, 170, 600, "p2 moc panel");
    drawCalibrationMarker(1, 405, 600, "p2 moc inv");
    drawCalibrationMarker(1, 126, 389, "p2 ME marka");
    drawCalibrationMarker(1, 126, 366, "p2 ME model");
    drawCalibrationMarker(1, 126, 344, "p2 ME kWh");
    drawCalibrationMarker(1, contractPdfPositions.page2.storageCheck.x, contractPdfPositions.page2.storageCheck.y, "p2 X ME");
    drawCalibrationMarker(1, contractPdfPositions.page2.backupCheck.x, contractPdfPositions.page2.backupCheck.y, "p2 X Backup");
    drawCalibrationMarker(1, contractPdfPositions.page2.emsCheck.x, contractPdfPositions.page2.emsCheck.y, "p2 X EMS");
    drawCalibrationMarker(1, contractPdfPositions.page2.inverterGridCheck.x, contractPdfPositions.page2.inverterGridCheck.y, "p2 X inv siec");
    drawCalibrationMarker(1, contractPdfPositions.page2.inverterHybridCheck.x, contractPdfPositions.page2.inverterHybridCheck.y, "p2 X inv hyb");
    drawCalibrationMarker(1, contractPdfPositions.page2.inverterMicroCheck.x, contractPdfPositions.page2.inverterMicroCheck.y, "p2 X inv micro");
    drawCalibrationMarker(1, contractPdfPositions.page2.inverterOwnCheck.x, contractPdfPositions.page2.inverterOwnCheck.y, "p2 X inv own");
    drawCalibrationMarker(1, contractPdfPositions.page2.mountingSheetMetalCheck.x, contractPdfPositions.page2.mountingSheetMetalCheck.y, "p2 X blacha");
    drawCalibrationMarker(1, contractPdfPositions.page2.mountingTileCheck.x, contractPdfPositions.page2.mountingTileCheck.y, "p2 X dachowka");
    drawCalibrationMarker(1, contractPdfPositions.page2.mountingGroundCheck.x, contractPdfPositions.page2.mountingGroundCheck.y, "p2 X grunt");
    drawCalibrationMarker(1, contractPdfPositions.page2.mountingCarportCheck.x, contractPdfPositions.page2.mountingCarportCheck.y, "p2 X wiata");
    drawCalibrationMarker(1, contractPdfPositions.page2.mountingFlatRoofCheck.x, contractPdfPositions.page2.mountingFlatRoofCheck.y, "p2 X plaski");

    drawCalibrationMarker(2, contractPdfPositions.page3.pvGrossBeforeDiscount.x + contractPdfPositions.page3.pvGrossBeforeDiscount.maxWidth, contractPdfPositions.page3.pvGrossBeforeDiscount.y, "p3 PV brutto");
    drawCalibrationMarker(2, contractPdfPositions.page3.pvGrossAfterDiscount.x + contractPdfPositions.page3.pvGrossAfterDiscount.maxWidth, contractPdfPositions.page3.pvGrossAfterDiscount.y, "p3 PV po");
    drawCalibrationMarker(2, contractPdfPositions.page3.storageGrossBeforeDiscount.x + contractPdfPositions.page3.storageGrossBeforeDiscount.maxWidth, contractPdfPositions.page3.storageGrossBeforeDiscount.y, "p3 ME brutto");
    drawCalibrationMarker(2, contractPdfPositions.page3.storageGrossAfterDiscount.x + contractPdfPositions.page3.storageGrossAfterDiscount.maxWidth, contractPdfPositions.page3.storageGrossAfterDiscount.y, "p3 ME po");
    drawCalibrationMarker(2, contractPdfPositions.page3.emsGrossBeforeDiscount.x + contractPdfPositions.page3.emsGrossBeforeDiscount.maxWidth, contractPdfPositions.page3.emsGrossBeforeDiscount.y, "p3 EMS brutto");
    drawCalibrationMarker(2, contractPdfPositions.page3.emsGrossAfterDiscount.x + contractPdfPositions.page3.emsGrossAfterDiscount.maxWidth, contractPdfPositions.page3.emsGrossAfterDiscount.y, "p3 EMS po");

    drawCalibrationMarker(3, contractPdfPositions.page4.backupGrossBeforeDiscount.x + contractPdfPositions.page4.backupGrossBeforeDiscount.maxWidth, contractPdfPositions.page4.backupGrossBeforeDiscount.y, "p4 Backup brutto");
    drawCalibrationMarker(3, contractPdfPositions.page4.backupGrossAfterDiscount.x + contractPdfPositions.page4.backupGrossAfterDiscount.maxWidth, contractPdfPositions.page4.backupGrossAfterDiscount.y, "p4 Backup po");
    drawCalibrationMarker(3, contractPdfPositions.page4.additionalServicesGrossBeforeDiscount.x + contractPdfPositions.page4.additionalServicesGrossBeforeDiscount.maxWidth, contractPdfPositions.page4.additionalServicesGrossBeforeDiscount.y, "p4 Usl brutto");
    drawCalibrationMarker(3, contractPdfPositions.page4.additionalServicesGrossAfterDiscount.x + contractPdfPositions.page4.additionalServicesGrossAfterDiscount.maxWidth, contractPdfPositions.page4.additionalServicesGrossAfterDiscount.y, "p4 Usl po");
    drawCalibrationMarker(3, contractPdfPositions.page4.cashPaymentCheck.x, contractPdfPositions.page4.cashPaymentCheck.y, "p4 X cash");
    drawCalibrationMarker(3, contractPdfPositions.page4.creditPaymentCheck.x, contractPdfPositions.page4.creditPaymentCheck.y, "p4 X credit");
    drawCalibrationMarker(3, contractPdfPositions.page4.creditOwnContribution.x, contractPdfPositions.page4.creditOwnContribution.y, "p4 wklad");
    drawCalibrationMarker(3, contractPdfPositions.page4.creditDeposit.x, contractPdfPositions.page4.creditDeposit.y, "p4 kred zal");
    drawCalibrationMarker(3, contractPdfPositions.page4.creditDepositDueDate.x, contractPdfPositions.page4.creditDepositDueDate.y, "p4 kred termin");
    drawCalibrationMarker(3, contractPdfPositions.page4.totalGross.x + contractPdfPositions.page4.totalGross.maxWidth, contractPdfPositions.page4.totalGross.y, "p4 suma");
    drawCalibrationMarker(3, contractPdfPositions.page4.totalGrossWords.x, contractPdfPositions.page4.totalGrossWords.y, "p4 slownie");
    drawCalibrationMarker(3, contractPdfPositions.page4.deposit.x, contractPdfPositions.page4.deposit.y, "p4 zaliczka");
    drawCalibrationMarker(3, contractPdfPositions.page4.depositDueDate.x, contractPdfPositions.page4.depositDueDate.y, "p4 termin");
    drawCalibrationMarker(3, contractPdfPositions.page4.finalPayment.x, contractPdfPositions.page4.finalPayment.y, "p4 koncowa");
    drawCalibrationMarker(6, contractPdfPositions.page7.contractNumber.x, contractPdfPositions.page7.contractNumber.y, "p7 nr");
    drawCalibrationMarker(6, contractPdfPositions.page7.variant1ACheck.x, contractPdfPositions.page7.variant1ACheck.y, "p7 X 1A");
    drawCalibrationMarker(6, contractPdfPositions.page7.variant1BCheck.x, contractPdfPositions.page7.variant1BCheck.y, "p7 X 1B");
    drawCalibrationMarker(8, contractPdfPositions.page9.contractNumber.x, contractPdfPositions.page9.contractNumber.y, "p9 nr");
    drawCalibrationMarker(10, contractPdfPositions.page11.contractNumber.x, contractPdfPositions.page11.contractNumber.y, "p11 nr");
    drawCalibrationMarker(11, contractPdfPositions.page12.client1MarketingEmailYes.x, contractPdfPositions.page12.client1MarketingEmailYes.y, "p12 K1 email TAK");
    drawCalibrationMarker(11, contractPdfPositions.page12.client1MarketingEmailNo.x, contractPdfPositions.page12.client1MarketingEmailNo.y, "p12 K1 email NIE");
    drawCalibrationMarker(11, contractPdfPositions.page12.client1MarketingPhoneYes.x, contractPdfPositions.page12.client1MarketingPhoneYes.y, "p12 K1 tel TAK");
    drawCalibrationMarker(11, contractPdfPositions.page12.client1MarketingPhoneNo.x, contractPdfPositions.page12.client1MarketingPhoneNo.y, "p12 K1 tel NIE");
    drawCalibrationMarker(11, contractPdfPositions.page12.client1PhotoConsentYes.x, contractPdfPositions.page12.client1PhotoConsentYes.y, "p12 K1 foto TAK");
    drawCalibrationMarker(11, contractPdfPositions.page12.client1PhotoConsentNo.x, contractPdfPositions.page12.client1PhotoConsentNo.y, "p12 K1 foto NIE");
    drawCalibrationMarker(11, contractPdfPositions.page12.client2MarketingEmailYes.x, contractPdfPositions.page12.client2MarketingEmailYes.y, "p12 K2 email TAK");
    drawCalibrationMarker(11, contractPdfPositions.page12.client2MarketingEmailNo.x, contractPdfPositions.page12.client2MarketingEmailNo.y, "p12 K2 email NIE");
    drawCalibrationMarker(11, contractPdfPositions.page12.client2MarketingPhoneYes.x, contractPdfPositions.page12.client2MarketingPhoneYes.y, "p12 K2 tel TAK");
    drawCalibrationMarker(11, contractPdfPositions.page12.client2MarketingPhoneNo.x, contractPdfPositions.page12.client2MarketingPhoneNo.y, "p12 K2 tel NIE");
    drawCalibrationMarker(11, contractPdfPositions.page12.client2PhotoConsentYes.x, contractPdfPositions.page12.client2PhotoConsentYes.y, "p12 K2 foto TAK");
    drawCalibrationMarker(11, contractPdfPositions.page12.client2PhotoConsentNo.x, contractPdfPositions.page12.client2PhotoConsentNo.y, "p12 K2 foto NIE");
  }

  // Page 1 — basic contract/client data
  drawOnPage(
    0,
    String(saleNumber),
    contractPdfPositions.page1.contractNumber.x,
    contractPdfPositions.page1.contractNumber.y,
    { size: contractPdfPositions.page1.contractNumber.size, bold: true }
  );
  drawOnPage(
    0,
    `${contractPlace}, ${today}`,
    contractPdfPositions.page1.placeAndDate.x,
    contractPdfPositions.page1.placeAndDate.y,
    { size: contractPdfPositions.page1.placeAndDate.size }
  );
  drawOnPage(
    0,
    customer.name,
    contractPdfPositions.page1.clientName.x,
    contractPdfPositions.page1.clientName.y,
    { size: contractPdfPositions.page1.clientName.size,}
  );
  drawOnPage(
    0,
    customer.pesel,
    contractPdfPositions.page1.pesel.x,
    contractPdfPositions.page1.pesel.y,
    { size: contractPdfPositions.page1.pesel.size }
  );
  if (customer.secondClientName || customer.secondClientPesel) {
    drawOnPage(
      0,
      customer.secondClientName,
      contractPdfPositions.page1.secondClientName.x,
      contractPdfPositions.page1.secondClientName.y,
      { size: contractPdfPositions.page1.secondClientName.size, }
    );
    drawOnPage(
      0,
      customer.secondClientPesel,
      contractPdfPositions.page1.secondClientPesel.x,
      contractPdfPositions.page1.secondClientPesel.y,
      { size: contractPdfPositions.page1.secondClientPesel.size }
    );
  }
  drawOnPage(
    0,
    customer.contractAddress,
    contractPdfPositions.page1.contractAddress.x,
    contractPdfPositions.page1.contractAddress.y,
    { size: contractPdfPositions.page1.contractAddress.size }
  );
  drawOnPage(
    0,
    customer.correspondenceAddress,
    contractPdfPositions.page1.correspondenceAddress.x,
    contractPdfPositions.page1.correspondenceAddress.y,
    { size: contractPdfPositions.page1.correspondenceAddress.size }
  );
  drawOnPage(
    0,
    customer.installationAddress,
    contractPdfPositions.page1.installationAddress.x,
    contractPdfPositions.page1.installationAddress.y,
    { size: contractPdfPositions.page1.installationAddress.size }
  );
  drawOnPage(
    0,
    customer.email,
    contractPdfPositions.page1.email.x,
    contractPdfPositions.page1.email.y,
    { size: contractPdfPositions.page1.email.size }
  );
  drawOnPage(
    0,
    customer.phone,
    contractPdfPositions.page1.phone.x,
    contractPdfPositions.page1.phone.y,
    { size: contractPdfPositions.page1.phone.size }
  );
  drawOnPage(
    0,
    salesRepresentativeName,
    contractPdfPositions.page1.salesRepresentative.x,
    contractPdfPositions.page1.salesRepresentative.y,
    { size: contractPdfPositions.page1.salesRepresentative.size, bold: true }
  );

  // Page 2 — technical data from offer snapshot
  drawOnPage(
    1,
    asPrintable(technicalData.pvPowerKw, " kWp"),
    contractPdfPositions.page2.pvPower.x,
    contractPdfPositions.page2.pvPower.y,
    { size: contractPdfPositions.page2.pvPower.size, bold: true }
  );

  const inverterModelKeyForDisplay = normalizeEquipmentKey(technicalData.inverterModel);
  const inferredInverterType =
    technicalData.inverterType ||
    (inverterModelKeyForDisplay.includes("hybryd") ||
    inverterModelKeyForDisplay.includes("hybrid") ||
    inverterModelKeyForDisplay.includes("sg04") ||
    inverterModelKeyForDisplay.includes("sg05") ||
    Boolean(technicalData.hasStorage)
      ? "hybrydowy"
      : inverterModelKeyForDisplay.includes("brak") ||
          inverterModelKeyForDisplay.includes("wlasny") ||
          inverterModelKeyForDisplay.includes("klienta")
        ? "własny klienta"
        : technicalData.inverterModel
          ? "sieciowy"
          : "");

  drawOnPage(
    1,
    String(inferredInverterType || ""),
    contractPdfPositions.page2.inverterType.x,
    contractPdfPositions.page2.inverterType.y,
    { size: contractPdfPositions.page2.inverterType.size, bold: true }
  );

  drawOnPage(
    1,
    humanizeEquipmentName(technicalData.panelModel),
    contractPdfPositions.page2.panelModel.x,
    contractPdfPositions.page2.panelModel.y,
    { size: contractPdfPositions.page2.panelModel.size }
  );

  drawOnPage(
    1,
    humanizeEquipmentName(technicalData.inverterModel),
    contractPdfPositions.page2.inverterModel.x,
    contractPdfPositions.page2.inverterModel.y,
    { size: contractPdfPositions.page2.inverterModel.size }
  );

  drawOnPage(
    1,
    asPrintable(technicalData.panelPowerWp, " Wp"),
    contractPdfPositions.page2.panelPower.x,
    contractPdfPositions.page2.panelPower.y,
    { size: contractPdfPositions.page2.panelPower.size }
  );

  const inverterPowerKw =
    technicalData.inverterPowerKw || inferInverterPowerKwFromModel(technicalData.inverterModel);

  drawOnPage(
    1,
    asPrintable(inverterPowerKw, " kW"),
    contractPdfPositions.page2.inverterPower.x,
    contractPdfPositions.page2.inverterPower.y,
    { size: contractPdfPositions.page2.inverterPower.size }
  );

  const storageDetails = parseStorageDetails(technicalData);
  if (storageDetails.brand) {
    drawOnPage(
      1,
      storageDetails.brand,
      contractPdfPositions.page2.storageBrand.x,
      contractPdfPositions.page2.storageBrand.y,
      { size: contractPdfPositions.page2.storageBrand.size }
    );
  }
  if (storageDetails.model) {
    drawOnPage(
      1,
      storageDetails.model,
      contractPdfPositions.page2.storageModel.x,
      contractPdfPositions.page2.storageModel.y,
      { size: contractPdfPositions.page2.storageModel.size }
    );
  }
  if (storageDetails.capacity) {
    drawOnPage(
      1,
      storageDetails.capacity,
      contractPdfPositions.page2.storageCapacity.x,
      contractPdfPositions.page2.storageCapacity.y,
      { size: contractPdfPositions.page2.storageCapacity.size }
    );
  }
  if (additionalProductsData.items && additionalProductsData.items.length > 0) {
    additionalProductsData.items.slice(0, 8).forEach((item, index) => {
      const quantityPart = item.quantity > 1
        ? ` x ${item.quantity}${item.unitLabel ? ` ${item.unitLabel}` : ""}`
        : "";
      const line = `${index + 1}. ${item.name}${quantityPart} — netto: ${money(item.net)}, brutto: ${money(item.gross)}`;

      drawOnPage(
        1,
        line,
        contractPdfPositions.page2.additionalServicesList.x,
        contractPdfPositions.page2.additionalServicesList.y - index * contractPdfPositions.page2.additionalServicesList.lineHeight,
        { size: contractPdfPositions.page2.additionalServicesList.size }
      );
    });

    drawCheck(
      1,
      contractPdfPositions.page2.additionalServicesCheck.x,
      contractPdfPositions.page2.additionalServicesCheck.y
    );
  }
const hasOptimizers = additionalProductsData.items?.some((item) => {
  const itemName = normalizeEquipmentKey(item.name);

  return (
    itemName.includes("optymalizator") ||
    itemName.includes("optimizer") ||
    itemName.includes("tigo")
  );
});

if (hasOptimizers) {
  drawCheck(
    1,
    contractPdfPositions.page2.optimizersCheck.x,
    contractPdfPositions.page2.optimizersCheck.y
  );
}
  // Simple automatic checks based on sold item names
  const soldItemsText = `${soldItems.join(" ")} ${JSON.stringify(technicalData)}`.toLowerCase();
  const inverterTypeKey = normalizeEquipmentKey(inferredInverterType);
  const inverterModelKey = normalizeEquipmentKey(technicalData.inverterModel);
  const mountingTypeKey = normalizeEquipmentKey(technicalData.mountingType);

  if (soldItemsText.includes("magazyn")) {
    drawCheck(1, contractPdfPositions.page2.storageCheck.x, contractPdfPositions.page2.storageCheck.y);
  }
  if (soldItemsText.includes("ems") || soldItemsText.includes("hems")) {
    drawCheck(1, contractPdfPositions.page2.emsCheck.x, contractPdfPositions.page2.emsCheck.y);
  }
  if (soldItemsText.includes("backup")) {
    drawCheck(1, contractPdfPositions.page2.backupCheck.x, contractPdfPositions.page2.backupCheck.y);
  }

  if (inverterTypeKey.includes("sieciowy") || inverterTypeKey.includes("grid")) {
    drawCheck(1, contractPdfPositions.page2.inverterGridCheck.x, contractPdfPositions.page2.inverterGridCheck.y);
  }
  if (inverterTypeKey.includes("hybryd") || inverterTypeKey.includes("hybrid")) {
    drawCheck(1, contractPdfPositions.page2.inverterHybridCheck.x, contractPdfPositions.page2.inverterHybridCheck.y);
  }
  if (inverterTypeKey.includes("mikro") || inverterTypeKey.includes("micro")) {
    drawCheck(1, contractPdfPositions.page2.inverterMicroCheck.x, contractPdfPositions.page2.inverterMicroCheck.y);
  }
  if (inverterTypeKey.includes("wlasny") || inverterTypeKey.includes("klienta") || inverterTypeKey.includes("brak") || inverterModelKey.includes("wlasny")) {
    drawCheck(1, contractPdfPositions.page2.inverterOwnCheck.x, contractPdfPositions.page2.inverterOwnCheck.y);
  }

  if (mountingTypeKey.includes("blacha")) {
    drawCheck(1, contractPdfPositions.page2.mountingSheetMetalCheck.x, contractPdfPositions.page2.mountingSheetMetalCheck.y);
  }
  if (mountingTypeKey.includes("dachowka") || mountingTypeKey.includes("ceramiczna")) {
    drawCheck(1, contractPdfPositions.page2.mountingTileCheck.x, contractPdfPositions.page2.mountingTileCheck.y);
  }
  if (mountingTypeKey.includes("grunt")) {
    drawCheck(1, contractPdfPositions.page2.mountingGroundCheck.x, contractPdfPositions.page2.mountingGroundCheck.y);
  }
  if (mountingTypeKey.includes("wiata") || mountingTypeKey.includes("carport")) {
    drawCheck(1, contractPdfPositions.page2.mountingCarportCheck.x, contractPdfPositions.page2.mountingCarportCheck.y);
  }
  if (mountingTypeKey.includes("plaski") || mountingTypeKey.includes("papa") || mountingTypeKey.includes("membrana")) {
    drawCheck(1, contractPdfPositions.page2.mountingFlatRoofCheck.x, contractPdfPositions.page2.mountingFlatRoofCheck.y);
  }

  // Page 4 — payment section
  const drawPricePair = (
    beforeDiscount: number,
    afterDiscount: number,
    beforePosition: { x: number; y: number; size: number; maxWidth: number },
    afterPosition: { x: number; y: number; size: number; maxWidth: number },
    pageIndex = 3
  ) => {
    if (beforeDiscount > 0) {
      drawRightAlignedOnPage(pageIndex, money(beforeDiscount), beforePosition.x + beforePosition.maxWidth, beforePosition.y, {
        size: beforePosition.size,
        bold: true,
      });
    }

    if (afterDiscount > 0) {
      drawRightAlignedOnPage(pageIndex, money(afterDiscount), afterPosition.x + afterPosition.maxWidth, afterPosition.y, {
        size: afterPosition.size,
        bold: true,
      });
    }
  };

  drawPricePair(
    financialData.pvGrossBeforeDiscount,
    financialData.pvGrossAfterDiscount,
    contractPdfPositions.page3.pvGrossBeforeDiscount,
    contractPdfPositions.page3.pvGrossAfterDiscount,
    2
  );
  drawPricePair(
    financialData.storageGrossBeforeDiscount,
    financialData.storageGrossAfterDiscount,
    contractPdfPositions.page3.storageGrossBeforeDiscount,
    contractPdfPositions.page3.storageGrossAfterDiscount,
    2
  );
  drawPricePair(
    financialData.emsGrossBeforeDiscount,
    financialData.emsGrossAfterDiscount,
    contractPdfPositions.page3.emsGrossBeforeDiscount,
    contractPdfPositions.page3.emsGrossAfterDiscount,
    2
  );
  drawPricePair(
    financialData.backupGrossBeforeDiscount,
    financialData.backupGrossAfterDiscount,
    contractPdfPositions.page4.backupGrossBeforeDiscount,
    contractPdfPositions.page4.backupGrossAfterDiscount
  );
  drawPricePair(
    financialData.additionalServicesGrossBeforeDiscount,
    financialData.additionalServicesGrossAfterDiscount,
    contractPdfPositions.page4.additionalServicesGrossBeforeDiscount,
    contractPdfPositions.page4.additionalServicesGrossAfterDiscount
  );

  const paymentMethod = String(
    getQueryValue(request, "paymentMethod") || customerFromDb.paymentMethod || "gotówka"
  ).toLowerCase();
  const isCreditPayment = paymentMethod.includes("kredyt") || paymentMethod.includes("finans");
  const ownContributionGross = toNumber(
    getQueryValue(request, "ownContributionAmount") || customerFromDb.ownContributionAmount || 0
  );
  const hasCreditDeposit = isCreditPayment && ownContributionGross > 0 && financialData.depositGross > 0;

  if (isCreditPayment) {
    drawCheck(3, contractPdfPositions.page4.creditPaymentCheck.x, contractPdfPositions.page4.creditPaymentCheck.y);
  } else {
    drawCheck(3, contractPdfPositions.page4.cashPaymentCheck.x, contractPdfPositions.page4.cashPaymentCheck.y);
  }

  if (isCreditPayment) {
    drawMoneyOnPage(
      3,
      ownContributionGross,
      contractPdfPositions.page4.creditOwnContribution.x,
      contractPdfPositions.page4.creditOwnContribution.y,
      { size: contractPdfPositions.page4.creditOwnContribution.size, bold: true }
    );

    if (hasCreditDeposit) {
      drawMoneyOnPage(
        3,
        financialData.depositGross,
        contractPdfPositions.page4.creditDeposit.x,
        contractPdfPositions.page4.creditDeposit.y,
        { size: contractPdfPositions.page4.creditDeposit.size, bold: true }
      );

      if (customer.depositDueDate) {
        drawOnPage(
          3,
          formatDateFromInput(customer.depositDueDate),
          contractPdfPositions.page4.creditDepositDueDate.x,
          contractPdfPositions.page4.creditDepositDueDate.y,
          { size: contractPdfPositions.page4.creditDepositDueDate.size, bold: true }
        );
      }
    }
  } else {
    drawMoneyOnPage(
      3,
      financialData.depositGross,
      contractPdfPositions.page4.deposit.x,
      contractPdfPositions.page4.deposit.y,
      { size: contractPdfPositions.page4.deposit.size, bold: true }
    );

    if (customer.depositDueDate) {
      drawOnPage(
        3,
        formatDateFromInput(customer.depositDueDate),
        contractPdfPositions.page4.depositDueDate.x,
        contractPdfPositions.page4.depositDueDate.y,
        { size: contractPdfPositions.page4.depositDueDate.size, bold: true }
      );
    }

    drawMoneyOnPage(
      3,
      financialData.finalPaymentGross,
      contractPdfPositions.page4.finalPayment.x,
      contractPdfPositions.page4.finalPayment.y,
      { size: contractPdfPositions.page4.finalPayment.size, bold: true }
    );
  }
  drawRightAlignedOnPage(
    3,
    money(financialData.totalGross),
    contractPdfPositions.page4.totalGross.x + contractPdfPositions.page4.totalGross.maxWidth,
    contractPdfPositions.page4.totalGross.y,
    { size: contractPdfPositions.page4.totalGross.size, bold: true }
  );
  drawOnPage(
    3,
    financialData.totalGrossWords,
    contractPdfPositions.page4.totalGrossWords.x,
    contractPdfPositions.page4.totalGrossWords.y,
    { size: contractPdfPositions.page4.totalGrossWords.size }
  );

  // Page 7 — attachment 1: withdrawal notice and realization variant
  drawOnPage(
    6,
    String(saleNumber),
    contractPdfPositions.page7.contractNumber.x,
    contractPdfPositions.page7.contractNumber.y,
    { size: contractPdfPositions.page7.contractNumber.size, bold: true }
  );

  const visitPreviouslyScheduled = String(customer.visitPreviouslyScheduled) === "true";

  if (customer.visitPreviouslyScheduled !== "" && customer.visitPreviouslyScheduled !== undefined) {
    if (visitPreviouslyScheduled) {
      drawStrikeLine(
        6,
        contractPdfPositions.page7.visitWasNotScheduledStrike.x1,
        contractPdfPositions.page7.visitWasNotScheduledStrike.y1,
        contractPdfPositions.page7.visitWasNotScheduledStrike.x2,
        contractPdfPositions.page7.visitWasNotScheduledStrike.y2
      );
    } else {
      drawStrikeLine(
        6,
        contractPdfPositions.page7.visitWasScheduledStrike.x1,
        contractPdfPositions.page7.visitWasScheduledStrike.y1,
        contractPdfPositions.page7.visitWasScheduledStrike.x2,
        contractPdfPositions.page7.visitWasScheduledStrike.y2
      );
    }
  }

  if (visitPreviouslyScheduled && customer.realizationVariant === "1A") {
    drawCheck(6, contractPdfPositions.page7.variant1ACheck.x, contractPdfPositions.page7.variant1ACheck.y);
  }

  if (visitPreviouslyScheduled && customer.realizationVariant === "1B") {
    drawCheck(6, contractPdfPositions.page7.variant1BCheck.x, contractPdfPositions.page7.variant1BCheck.y);
  }

  // Page 9 — attachment 2: warranty terms contract number
  drawOnPage(
    8,
    String(saleNumber),
    contractPdfPositions.page9.contractNumber.x,
    contractPdfPositions.page9.contractNumber.y,
    { size: contractPdfPositions.page9.contractNumber.size, bold: true }
  );

  // Page 11 — attachment 3: GDPR and marketing consents contract number
  drawOnPage(
    10,
    String(saleNumber),
    contractPdfPositions.page11.contractNumber.x,
    contractPdfPositions.page11.contractNumber.y,
    { size: contractPdfPositions.page11.contractNumber.size, bold: true }
  );

  // Page 12 — attachment 3: marketing consents
  const consentData = (sale.customer_data || {}) as Record<string, any>;
  const getConsentValue = (queryKey: string, dataKey: string) => {
    const queryValue = getQueryValue(request, queryKey);

    if (queryValue !== null) {
      return queryValue;
    }

    return consentData[dataKey];
  };

  const drawYesNoConsent = (
    value: unknown,
    yesPosition: { x: number; y: number },
    noPosition: { x: number; y: number }
  ) => {
    const parsedValue = readBooleanLike(value);

    if (parsedValue === true) {
      drawCheck(11, yesPosition.x, yesPosition.y);
    }

    if (parsedValue === false) {
      drawCheck(11, noPosition.x, noPosition.y);
    }
  };

  drawYesNoConsent(
    getConsentValue("client1MarketingEmail", "client1_marketing_email"),
    contractPdfPositions.page12.client1MarketingEmailYes,
    contractPdfPositions.page12.client1MarketingEmailNo
  );
  drawYesNoConsent(
    getConsentValue("client1MarketingPhone", "client1_marketing_phone"),
    contractPdfPositions.page12.client1MarketingPhoneYes,
    contractPdfPositions.page12.client1MarketingPhoneNo
  );
  drawYesNoConsent(
    getConsentValue("client1PhotoConsent", "client1_photo_consent"),
    contractPdfPositions.page12.client1PhotoConsentYes,
    contractPdfPositions.page12.client1PhotoConsentNo
  );
  drawYesNoConsent(
    getConsentValue("client2MarketingEmail", "client2_marketing_email"),
    contractPdfPositions.page12.client2MarketingEmailYes,
    contractPdfPositions.page12.client2MarketingEmailNo
  );
  drawYesNoConsent(
    getConsentValue("client2MarketingPhone", "client2_marketing_phone"),
    contractPdfPositions.page12.client2MarketingPhoneYes,
    contractPdfPositions.page12.client2MarketingPhoneNo
  );
  drawYesNoConsent(
    getConsentValue("client2PhotoConsent", "client2_photo_consent"),
    contractPdfPositions.page12.client2PhotoConsentYes,
    contractPdfPositions.page12.client2PhotoConsentNo
  );

  drawCalibrationMarkers();

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="umowa-${saleNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}