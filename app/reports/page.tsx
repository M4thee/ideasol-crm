
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  ActivityRow,
  AdvisorDetailRow,
  AdvisorDetailType,
  AdvisorReportSummary,
  AdvisorUserOption,
  CalendarEventRow,
  CcUserSummary,
  CcReportSummary,
  ClientRow,
  FinancialDetailRow,
  FinancialDetailType,
  FinancialSaleRow,
  FinancialSummary,
  ManagerTeamOption,
  MetricCard,
  MetricDetailType,
  OfferRow,
  PeriodPreset,
  ProfileRow,
} from "./types";
import {
  formatCurrency,
  getDateRangeBoundaries,
  getPresetRange,
  getPreviousDateRange,
  grossFromNet,
  netFromGross,
  normalizeText,
} from "./utils";
import { MetricGrid } from "./components/MetricGrid";
import { ReportSection } from "./components/ReportSection";
import {
  getSaleEquipmentCostDetailed,
  getSaleInstallationCostDetailed,
  getSaleMarketingValue,
  getSaleOperatorFeeNet,
  getSaleSellerMarkupNet,
  readSaleDeepSum,
  readSaleNumber,
} from "./financial-utils";


const emptyAdvisorSummary: AdvisorReportSummary = {
  remoteContacts: 0,
  phoneCalls: 0,
  emails: 0,
  sms: 0,
  savedOffers: 0,
  sentOffers: 0,
  meetingsScheduled: 0,
  meetingsCompleted: 0,
  salesCount: 0,
  documentationCompleteness: 0,
};

const emptyCcSummary: CcReportSummary = {
  phoneCalls: 0,
  uniqueClientConversations: 0,
  emails: 0,
  sms: 0,
  meetingsScheduled: 0,
  noAnswer: 0,
  callBackRequests: 0,
  notInterested: 0,
  conversionRate: 0,
  users: [],
};

const emptyFinancialSummary: FinancialSummary = {
  totalRevenueGross: 0,
  revenueGross: 0,
  lostRevenueGross: 0,
  guaranteeFund: 0,
  marketingFund: 0,
  equipmentCost: 0,
  equipmentCostGross: 0,
  installationCost: 0,
  installationCostGross: 0,
  sellerCommissions: 0,
  managerCommissions: 0,
  companyProfit: 0,
  ownerProfit: 0,
  advisorCommissionForecast: 0,
  advisorCommissionPayable: 0,
  managerFeeForecast: 0,
  managerFeePayable: 0,
  managerOwnSalesCommissionForecast: 0,
  managerOwnSalesCommissionPayable: 0,
  salesCount: 0,
};

const forecastCommissionStatuses = new Set([
  "umowione do montazu",
  "zamontowany",
  "oczekiwanie na pelna wplate",
]);

const payableCommissionStatuses = new Set([
  "zakonczony",
  "zakonczona",
  "zakończony",
  "zakończona",
]);


function getActivityType(row: ActivityRow) {
  return normalizeText(row.activity_type);
}

function getContactStatus(row: ActivityRow) {
  return normalizeText(row.status || row.phone_status || row.contact_status || row.outcome || row.result);
}

function isPhoneActivity(row: ActivityRow) {
  return getActivityType(row) === "phone";
}

function isEmailActivity(row: ActivityRow) {
  return getActivityType(row) === "email";
}

function isSmsActivity(row: ActivityRow) {
  return getActivityType(row) === "sms";
}

function isMeetingScheduled(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "umowione spotkanie" || status === "meeting_scheduled";
}

function isNoAnswer(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "nie odbiera" || status === "no_answer";
}

function isAnsweredPhoneActivity(row: ActivityRow) {
  return isPhoneActivity(row) && !isNoAnswer(row);
}

function getConversationClientKey(row: ActivityRow) {
  return row.client_id || row.id || `${row.created_by || row.assigned_user_id || "unknown"}-${row.created_at || "unknown"}`;
}

function isCallBackRequest(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "prosba o ponowny kontakt" || status === "call_back_request";
}

function isNotInterested(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "niezainteresowany" || status === "not_interested";
}


function getActivityOwnerId(row: ActivityRow) {
  return row.created_by || row.user_id || row.owner_id || row.assigned_user_id || "unknown";
}

function getCalendarEventOwnerId(row: CalendarEventRow) {
  return row.created_by || row.user_id || row.owner_id || row.assigned_user_id || "unknown";
}


function isMeetingCalendarEvent(row: CalendarEventRow) {
  const eventType = normalizeText(row.event_type);
  const title = normalizeText(row.title);

  return eventType === "meeting" || eventType === "spotkanie" || title.includes("spotkanie");
}

// --- Advisor reporting helpers ---

function getAdvisorActivityOwnerId(row: ActivityRow) {
  return row.assigned_user_id || row.created_by || row.user_id || row.owner_id || "unknown";
}

function getAdvisorEventOwnerId(row: CalendarEventRow) {
  return row.assigned_user_id || row.created_by || row.user_id || row.owner_id || "unknown";
}

function getOfferOwnerId(row: OfferRow) {
  return row.seller_id || row.created_by || row.user_id || row.assigned_user_id || row.owner_id || "unknown";
}

function isOfferSent(row: OfferRow) {
  const status = normalizeText(row.status);
  return Boolean(
    row.sent_at ||
    row.email_sent_at ||
    row.mail_sent_at ||
    status.includes("sent") ||
    status.includes("wyslana") ||
    status.includes("wyslane")
  );
}

function isCompletedMeetingEvent(row: CalendarEventRow) {
  const status = normalizeText(row.status);
  const title = normalizeText(row.title);
  return (
    status.includes("odbyte") ||
    status.includes("completed") ||
    status.includes("zakoncz") ||
    title.includes("odbyte")
  );
}


function getAllowedAdvisorUsers(profiles: ProfileRow[], currentUserId: string, currentRole: string) {
  const advisorRoles = new Set(["seller", "manager", "owner", "admin"]);

  return profiles
    .filter((profile) => advisorRoles.has(normalizeText(profile.role)))
    .filter((profile) => {
      const profileRole = normalizeText(profile.role);

      if (currentRole === "admin" || currentRole === "owner") return true;
      if (currentRole === "manager")
        return (
          profile.id === currentUserId ||
          profile.manager_id === currentUserId ||
          (profileRole === "seller" && profile.manager_id === currentUserId)
        );
      if (currentRole === "seller") return profile.id === currentUserId;
      return false;
    })
    .map((profile) => ({
      id: profile.id,
      name: profile.display_name || profile.email || "Nieznany użytkownik",
      role: normalizeText(profile.role),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

function getManagerTeamOptions(profiles: ProfileRow[], currentUserId: string, currentRole: string) {
  const advisorRoles = new Set(["seller", "manager", "owner", "admin"]);
  const visibleAdvisorIds = profiles
    .filter((profile) => advisorRoles.has(normalizeText(profile.role)))
    .map((profile) => profile.id);

  const managerIds = new Set<string>();

  profiles.forEach((profile) => {
    if (normalizeText(profile.role) === "manager") {
      managerIds.add(profile.id);
    }

    if (profile.manager_id) {
      managerIds.add(profile.manager_id);
    }
  });

  if (currentRole === "manager") {
    managerIds.add(currentUserId);
  }

  const teams = Array.from(managerIds)
    .map((managerId) => {
      const manager = profiles.find((profile) => profile.id === managerId);
      const teamMembers = profiles.filter((profile) => profile.manager_id === managerId);
      const memberIds = Array.from(new Set([managerId, ...teamMembers.map((member) => member.id)]));

      return {
        id: managerId,
        name: manager?.display_name || manager?.email || `Zespół ${managerId.slice(0, 8)}`,
        managerId,
        memberIds,
      };
    })
    .filter((team) => {
      if (currentRole === "admin" || currentRole === "owner") return true;
      if (currentRole === "manager") return team.managerId === currentUserId;
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));

  if (teams.length > 0) return teams;

  if (currentRole === "admin" || currentRole === "owner") {
    return [
      {
        id: "all-teams",
        name: "Wszyscy doradcy / wszystkie zespoły",
        managerId: "all-teams",
        memberIds: visibleAdvisorIds,
      },
    ];
  }

  if (currentRole === "manager") {
    const currentManager = profiles.find((profile) => profile.id === currentUserId);
    const teamMembers = profiles.filter((profile) => profile.manager_id === currentUserId);

    return [
      {
        id: currentUserId,
        name: currentManager?.display_name || currentManager?.email || "Mój zespół",
        managerId: currentUserId,
        memberIds: Array.from(new Set([currentUserId, ...teamMembers.map((member) => member.id)])),
      },
    ];
  }

  return [];
}

function isSelectedAdvisor(userId: string, selectedAdvisorId: string, allowedAdvisorIds: Set<string>) {
  if (!allowedAdvisorIds.has(userId)) return false;
  if (selectedAdvisorId === "all") return true;
  return userId === selectedAdvisorId;
}

function isSaleDocumentationComplete(sale: FinancialSaleRow) {
  const source = sale as Record<string, unknown>;
  const booleanKeys = [
    "documents_complete",
    "documentation_complete",
    "docs_complete",
    "documentsApproved",
    "documents_approved",
  ];

  if (booleanKeys.some((key) => source[key] === true)) return true;

  const status = normalizeText(
    readStringFromObject(source, [
      "documents_status",
      "documentation_status",
      "docs_status",
      "document_status",
    ])
  );

  return status.includes("komplet") || status.includes("zatwierdz") || status.includes("approved");
}

function summarizeAdvisorReport(
  activities: ActivityRow[],
  calendarEvents: CalendarEventRow[],
  offers: OfferRow[],
  sales: FinancialSaleRow[],
  selectedAdvisorId: string,
  allowedAdvisorIds: Set<string>
): AdvisorReportSummary {
  const advisorActivities = activities.filter((row) =>
    isSelectedAdvisor(getAdvisorActivityOwnerId(row), selectedAdvisorId, allowedAdvisorIds)
  );
  const advisorEvents = calendarEvents.filter((row) =>
    isSelectedAdvisor(getAdvisorEventOwnerId(row), selectedAdvisorId, allowedAdvisorIds)
  );
  const advisorOffers = offers.filter((row) =>
    isSelectedAdvisor(getOfferOwnerId(row), selectedAdvisorId, allowedAdvisorIds)
  );
  const advisorSales = sales.filter((sale) =>
    isSelectedAdvisor(getSaleSellerId(sale), selectedAdvisorId, allowedAdvisorIds)
  );

  const phoneCalls = advisorActivities.filter(isPhoneActivity).length;
  const emails = advisorActivities.filter(isEmailActivity).length;
  const sms = advisorActivities.filter(isSmsActivity).length;
  const meetingsScheduled = advisorEvents.filter(isMeetingCalendarEvent).length;
  const meetingsCompleted = advisorEvents.filter(
    (event) => isMeetingCalendarEvent(event) && isCompletedMeetingEvent(event)
  ).length;
  const savedOffers = advisorOffers.length;
  const sentOffers = advisorOffers.filter(isOfferSent).length;
  const completedDocumentationSales = advisorSales.filter(isSaleDocumentationComplete).length;

  return {
    remoteContacts: phoneCalls + emails + sms,
    phoneCalls,
    emails,
    sms,
    savedOffers,
    sentOffers,
    meetingsScheduled,
    meetingsCompleted,
    salesCount: advisorSales.length,
    documentationCompleteness:
      advisorSales.length > 0
        ? Math.round((completedDocumentationSales / advisorSales.length) * 100)
        : 0,
  };
}

function getAdvisorDetailTitle(type: AdvisorDetailType) {
  const titles: Record<AdvisorDetailType, string> = {
    remoteContacts: "Wykonane kontakty zdalne",
    phoneCalls: "Telefony",
    emails: "Maile",
    savedOffers: "Zapisane oferty z kalkulatora",
    sentOffers: "Wysłane oferty z kalkulatora",
    meetingsScheduled: "Umówione spotkania",
    meetingsCompleted: "Odbyte spotkania",
    sales: "Sprzedaże",
    documentation: "Kompletność dokumentacji",
  };

  return titles[type];
}

function formatAdvisorDetailDate(value?: string | null) {
  if (!value) return "Brak daty";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Brak daty";

  return date.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAdvisorName(userId: string, advisorMap: Map<string, AdvisorUserOption>) {
  return advisorMap.get(userId)?.name || "Nieznany doradca";
}

function getAdvisorDetailClient(clientId: string | null | undefined, clientMap: Map<string, ClientRow>) {
  if (!clientId) {
    return { clientId: null, clientName: "—", leadId: "—" };
  }

  const client = clientMap.get(clientId);
  if (!client) {
    return { clientId, clientName: "Brak klienta", leadId: clientId };
  }

  return {
    clientId,
    clientName: client.full_name || client.company_name || client.contact_person || client.email || client.phone || "Brak nazwy klienta",
    leadId: client.lead_id || client.lead_public_id || client.public_id || client.client_public_id || client.id,
  };
}

function buildAdvisorDetailRows(
  detailType: AdvisorDetailType | null,
  selectedAdvisorId: string,
  allowedAdvisorIds: Set<string>,
  advisorMap: Map<string, AdvisorUserOption>,
  clientMap: Map<string, ClientRow>,
  activities: ActivityRow[],
  calendarEvents: CalendarEventRow[],
  offers: OfferRow[],
  sales: FinancialSaleRow[]
): AdvisorDetailRow[] {
  if (!detailType) return [];

  const activityRows = activities
    .filter((row) => isSelectedAdvisor(getAdvisorActivityOwnerId(row), selectedAdvisorId, allowedAdvisorIds))
    .filter((row) => {
      if (detailType === "remoteContacts") return isPhoneActivity(row) || isEmailActivity(row) || isSmsActivity(row);
      if (detailType === "phoneCalls") return isPhoneActivity(row);
      if (detailType === "emails") return isEmailActivity(row);
      return false;
    })
    .map((row) => {
      const advisorId = getAdvisorActivityOwnerId(row);
      const client = getAdvisorDetailClient(row.client_id, clientMap);
      return {
        id: row.id || `${advisorId}-${row.created_at || "activity"}`,
        date: formatAdvisorDetailDate(row.created_at),
        advisorName: getAdvisorName(advisorId, advisorMap),
        clientId: client.clientId,
        clientName: client.clientName,
        leadId: client.leadId,
        type: row.activity_type || row.type || "Aktywność",
        status: getContactStatus(row) || row.status || "—",
        description: row.description || row.note || "—",
      };
    });

  const offerRows = offers
    .filter((row) => isSelectedAdvisor(getOfferOwnerId(row), selectedAdvisorId, allowedAdvisorIds))
    .filter((row) => {
      if (detailType === "savedOffers") return true;
      if (detailType === "sentOffers") return isOfferSent(row);
      return false;
    })
    .map((row) => {
      const advisorId = getOfferOwnerId(row);
      const client = getAdvisorDetailClient(row.client_id, clientMap);
      return {
        id: row.id || `${advisorId}-${row.created_at || "offer"}`,
        date: formatAdvisorDetailDate(row.created_at),
        advisorName: getAdvisorName(advisorId, advisorMap),
        clientId: client.clientId,
        clientName: client.clientName,
        leadId: client.leadId,
        type: detailType === "sentOffers" ? "Oferta wysłana" : "Oferta zapisana",
        status: row.status || "—",
        description: row.id ? `OfferID: ${row.id}` : "Oferta z kalkulatora",
      };
    });

  const meetingRows = calendarEvents
    .filter((row) => isSelectedAdvisor(getAdvisorEventOwnerId(row), selectedAdvisorId, allowedAdvisorIds))
    .filter((row) => {
      if (detailType === "meetingsScheduled") return isMeetingCalendarEvent(row);
      if (detailType === "meetingsCompleted") return isMeetingCalendarEvent(row) && isCompletedMeetingEvent(row);
      return false;
    })
    .map((row) => {
      const advisorId = getAdvisorEventOwnerId(row);
      const client = getAdvisorDetailClient(row.client_id, clientMap);
      return {
        id: row.id || `${advisorId}-${row.event_at || row.created_at || "meeting"}`,
        date: formatAdvisorDetailDate(row.event_at || row.created_at),
        advisorName: getAdvisorName(advisorId, advisorMap),
        clientId: client.clientId,
        clientName: client.clientName,
        leadId: client.leadId,
        type: isCompletedMeetingEvent(row) ? "Odbyte spotkanie" : "Umówione spotkanie",
        status: row.status || "—",
        description: row.title || "Spotkanie",
      };
    });

  const saleRows = sales
    .filter((sale) => isSelectedAdvisor(getSaleSellerId(sale), selectedAdvisorId, allowedAdvisorIds))
    .filter(() => detailType === "sales" || detailType === "documentation")
    .map((sale) => {
      const advisorId = getSaleSellerId(sale);
      const docsComplete = isSaleDocumentationComplete(sale);
      const client = getAdvisorDetailClient(sale.client_id, clientMap);
      return {
        id: String(getSaleDisplayId(sale)),
        date: formatAdvisorDetailDate(sale.created_at || sale.sale_date || sale.date),
        advisorName: getAdvisorName(advisorId, advisorMap),
        clientId: client.clientId,
        clientName: client.clientName,
        leadId: client.leadId,
        type: detailType === "documentation" ? "Dokumentacja sprzedaży" : "Sprzedaż",
        status: detailType === "documentation" ? (docsComplete ? "Kompletna" : "Niekompletna") : sale.status || "—",
        description: detailType === "documentation"
          ? `SaleID: ${getSaleDisplayId(sale)}`
          : `${getSaleDisplayId(sale)} · ${sale.status || "Brak statusu"}`,
      };
    });

  return [...activityRows, ...offerRows, ...meetingRows, ...saleRows].sort((a, b) => b.date.localeCompare(a.date));
}

function summarizeCcRows(
  rows: ActivityRow[],
  profileMap: Map<string, ProfileRow>,
  calendarEvents: CalendarEventRow[] = []
): CcReportSummary {
  const phoneRows = rows.filter(isPhoneActivity);
  const emailRows = rows.filter(isEmailActivity);
  const smsRows = rows.filter(isSmsActivity);
  const interactionRows = rows.filter((row) => isPhoneActivity(row) || isEmailActivity(row) || isSmsActivity(row));

  const scheduledPhoneRows = phoneRows.filter(isMeetingScheduled);
  const scheduledPhoneActivityIds = new Set(
    scheduledPhoneRows.map((row) => row.id).filter(Boolean) as string[]
  );
  const meetingEventRows = calendarEvents
    .filter(isMeetingCalendarEvent)
    .filter((event) => !event.source_activity_id || !scheduledPhoneActivityIds.has(event.source_activity_id));

  // --- BEGIN PATCH: uniqueClientConversations logic ---
  const answeredPhoneRows = phoneRows.filter(isAnsweredPhoneActivity);
  const uniqueClientConversations = new Set(
    answeredPhoneRows.map(getConversationClientKey)
  ).size;
  const userConversationClientKeys = new Map<string, Set<string>>();
  // --- END PATCH ---

  const phoneCalls = phoneRows.length;
  const emails = emailRows.length;
  const sms = smsRows.length;
  const meetingsScheduled = scheduledPhoneRows.length + meetingEventRows.length;
  const noAnswer = phoneRows.filter(isNoAnswer).length;
  const callBackRequests = phoneRows.filter(isCallBackRequest).length;
  const notInterested = phoneRows.filter(isNotInterested).length;
  const userMap = new Map<string, CcUserSummary>();

  interactionRows.forEach((row) => {
    const userId = getActivityOwnerId(row);
    const profile = profileMap.get(userId);
    const current = userMap.get(userId) || {
      userId,
      name: profile?.display_name || profile?.email || "Nieznany użytkownik",
      phoneCalls: 0,
      uniqueClientConversations: 0,
      emails: 0,
      sms: 0,
      meetingsScheduled: 0,
      conversionRate: 0,
    };

    if (isPhoneActivity(row)) {
      current.phoneCalls += 1;

      // --- BEGIN PATCH: uniqueClientConversations per user ---
      if (isAnsweredPhoneActivity(row)) {
        const clientKey = getConversationClientKey(row);
        const userClientKeys = userConversationClientKeys.get(userId) || new Set<string>();
        userClientKeys.add(clientKey);
        userConversationClientKeys.set(userId, userClientKeys);
        current.uniqueClientConversations = userClientKeys.size;
      }
      // --- END PATCH ---

      if (isMeetingScheduled(row)) {
        current.meetingsScheduled += 1;
      }
    }

    if (isEmailActivity(row)) {
      current.emails += 1;
    }

    if (isSmsActivity(row)) {
      current.sms += 1;
    }

    current.conversionRate = current.phoneCalls > 0
      ? Math.round((current.meetingsScheduled / current.phoneCalls) * 100)
      : 0;

    userMap.set(userId, current);
  });

  meetingEventRows.forEach((event) => {
    const userId = getCalendarEventOwnerId(event);
    const profile = profileMap.get(userId);
    const current = userMap.get(userId) || {
      userId,
      name: profile?.display_name || profile?.email || "Nieznany użytkownik",
      phoneCalls: 0,
      uniqueClientConversations: 0,
      emails: 0,
      sms: 0,
      meetingsScheduled: 0,
      conversionRate: 0,
    };

    current.meetingsScheduled += 1;
    current.conversionRate = current.phoneCalls > 0
      ? Math.round((current.meetingsScheduled / current.phoneCalls) * 100)
      : 0;

    userMap.set(userId, current);
  });

  return {
    phoneCalls,
    uniqueClientConversations,
    emails,
    sms,
    meetingsScheduled,
    noAnswer,
    callBackRequests,
    notInterested,
    conversionRate: phoneCalls > 0 ? Math.round((meetingsScheduled / phoneCalls) * 100) : 0,
    users: Array.from(userMap.values()).sort((a, b) => b.phoneCalls - a.phoneCalls),
  };
}

function formatPercentChange(current: number, previous: number) {
  if (previous === 0 && current === 0) return "—";
  if (previous === 0) return "+100%";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}%`;
}

function formatNumberChange(current: number, previous: number) {
  if (previous === current) return "—";
  const change = current - previous;
  return `${change > 0 ? "+" : ""}${change}`;
}

function formatCurrencyChange(current: number, previous: number, inverse = false) {
  const diff = Number(current || 0) - Number(previous || 0);

  if (Math.abs(diff) < 0.01) {
    return { change: "—", changeTone: "neutral" as const };
  }

  const isPositiveBusinessChange = inverse ? diff < 0 : diff > 0;

  return {
    change: `${diff > 0 ? "+" : ""}${formatCurrency(diff)}`,
    changeTone: isPositiveBusinessChange ? ("positive" as const) : ("negative" as const),
  };
}



function formatGrossLine(value: number) {
  return `Brutto: ${formatCurrency(value)}`;
}



function summarizeFinancialSales(
  sales: FinancialSaleRow[],
  currentUserId: string,
  currentUserRole: string,
  ownerIds: Set<string>,
  managerUserIds: Set<string>
) {
  const summary = { ...emptyFinancialSummary };

  sales.forEach((sale) => {
    const sellerId = getSaleSellerId(sale);
    const status = getSaleStatus(sale);
    const revenueGross = getSaleRevenueGross(sale);
    const isOwnerSeller = ownerIds.has(sellerId);
    const isManagerSeller = managerUserIds.has(sellerId);
    const isLost = isLostContractStatus(status);
    const isCompleted = isCompletedSaleStatus(status);
    const isCostEligible = !isCostExcludedStatus(status);
    const forecast = isForecastCommissionSale(sale);
    const payable = isPayableCommissionSale(sale) || isCompleted;

    const sellerCommission = getSaleSellerCommission(sale);
    const sellerMarkupNet = getSaleSellerMarkupNet(sale) || sellerCommission;
    const managerFee = getSaleManagerFee(sale);
    const ownerMargin = getSaleOwnerMargin(sale);

    summary.salesCount += 1;
    summary.totalRevenueGross += revenueGross;

    if (isLost) {
      summary.lostRevenueGross += revenueGross;
    } else {
      summary.revenueGross += revenueGross;
    }

    if (isCompleted) {
      summary.guaranteeFund += getSaleOperatorFeeNet(sale);
      summary.marketingFund += getSaleMarketingValue(sale);

      if (!isOwnerSeller) {
        summary.sellerCommissions += sellerMarkupNet;
      }
    }

    if (isCostEligible) {
      const equipmentCost = getSaleEquipmentCostDetailed(sale) || getSaleEquipmentCost(sale);
      const installationCost = getSaleInstallationCostDetailed(sale) || getSaleInstallationCost(sale);

      summary.equipmentCost += equipmentCost;
      summary.equipmentCostGross += equipmentCost * 1.23;
      summary.installationCost += installationCost;
      summary.installationCostGross += installationCost * 1.08;
    }

    summary.managerCommissions += isCompleted ? managerFee : 0;

    if ((currentUserRole === "owner" || currentUserRole === "admin") && !isLost) {
      summary.ownerProfit += ownerMargin + (isOwnerSeller ? sellerMarkupNet / 3 : 0);
    }

    if (sellerId === currentUserId && !isOwnerSeller) {
      if (forecast) summary.advisorCommissionForecast += sellerCommission;
      if (payable) summary.advisorCommissionPayable += sellerCommission;
    }

    if (currentUserRole === "manager") {
      if (forecast) summary.managerFeeForecast += managerFee;
      if (payable) summary.managerFeePayable += managerFee;

      if (sellerId === currentUserId && isManagerSeller) {
        if (forecast) summary.managerOwnSalesCommissionForecast += sellerCommission;
        if (payable) summary.managerOwnSalesCommissionPayable += sellerCommission;
      }
    }
  });

  summary.companyProfit =
    netFromGross(summary.revenueGross, 0.08) -
    summary.equipmentCost -
    summary.installationCost -
    summary.sellerCommissions -
    summary.managerCommissions -
    summary.ownerProfit * 3;

  return summary;
}

function getSaleSellerId(sale: FinancialSaleRow) {
  return sale.seller_id || sale.created_by || sale.assigned_user_id || sale.user_id || "";
}

function getSaleStatus(sale: FinancialSaleRow) {
  return normalizeText(sale.status || "");
}

function isLostContractStatus(status: string) {
  return (
    status === "anulowana" ||
    status === "odstapienie - utrzymanie" ||
    status === "odstapienie - nieuratowana" ||
    status === "utrzymanie - nieuratowana" ||
    status === "utrzmanie - nieuratowana" ||
    status === "utrzmanie - nieuratowana" ||
    status === "utzymanie - nieuratowana"
  );
}

function isCompletedSaleStatus(status: string) {
  return status.startsWith("zakonczon");
}

function isCostExcludedStatus(status: string) {
  return (
    isLostContractStatus(status) ||
    status === "oczekuje na sprawdzenie dokumentow" ||
    status === "oczekiwanie na sprawdzenie dokumentow" ||
    status === "oczekuje na umowienie montazu" ||
    status === "oczekiwanie na umowienie montazu" ||
    status === "oczekuje na zaliczke" ||
    status === "oczekiwanie na zaliczke" ||
    status === "oczekiwanie na zaksiegowanie zaliczki"
  );
}
function isForecastCommissionSale(sale: FinancialSaleRow) {
  return forecastCommissionStatuses.has(getSaleStatus(sale));
}

function isPayableCommissionSale(sale: FinancialSaleRow) {
  return payableCommissionStatuses.has(getSaleStatus(sale));
}

function getSaleRevenueGross(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "sale_price_gross",
    "salePriceGross",
    "grossPrice",
    "finalGross",
    "totalGross",
    "contract_value_gross",
    "contract_value",
    "total_gross",
    "final_gross",
    "gross_value",
  ]);
}

function getSaleEquipmentCost(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "equipment_cost_net",
    "equipment_cost",
    "equipmentCostNet",
    "equipmentCost",
    "totalEquipmentCostNet",
  ]);
}

function getSaleInstallationCost(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "installation_cost_net",
    "installation_cost",
    "installationCostNet",
    "installationCost",
    "mountingCostNet",
  ]);
}

function getSaleSellerCommission(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "seller_commission_net",
    "seller_commission",
    "seller_margin",
    "seller_markup_net",
    "sellerCommissionNet",
    "sellerMarkupNet",
    "sellerMargin",
  ]);
}

function getSaleManagerFee(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "manager_fee_net",
    "manager_fee",
    "managerFeeNet",
    "managerFee",
  ]);
}

function getSaleGuaranteeFund(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "guarantee_fund_net",
    "guarantee_fund",
    "warranty_fund_net",
    "warranty_fund",
    "guaranteeFundNet",
    "guaranteeFund",
    "warrantyFundNet",
    "warrantyFund",
  ]);
}

function getSaleMarketingFund(sale: FinancialSaleRow) {
  return readSaleNumber(sale, [
    "marketing_fund",
    "marketing_cost_net",
    "marketing_cost",
    "marketingFund",
    "marketingCostNet",
    "marketingCost",
  ]);
}

function getSaleOwnerMargin(sale: FinancialSaleRow) {
  const managerOverridePerOwnerNet = readSaleDeepSum(sale, [
    "managerOverridePerOwnerNet",
    "manager_override_per_owner_net",
  ]);

  if (managerOverridePerOwnerNet !== 0) return managerOverridePerOwnerNet;

  return readSaleNumber(sale, [
    "owner_margin_net",
    "owner_margin",
    "company_margin_net",
    "company_margin",
    "ownerMarginNet",
    "ownerMargin",
    "companyMarginNet",
    "companyMargin",
  ]);
}


function getSaleDisplayId(sale: FinancialSaleRow) {
  return sale.sale_public_id || sale.public_id || sale.id;
}

function readStringFromObject(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return "";
  const objectSource = source as Record<string, unknown>;

  for (const key of keys) {
    const value = objectSource[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function getSaleClientName(sale: FinancialSaleRow, clientMap: Map<string, ClientRow>) {
  const client = sale.client_id ? clientMap.get(sale.client_id) : undefined;
  const fromClient = client?.full_name || client?.company_name || client?.contact_person || client?.email || client?.phone;
  if (fromClient) return fromClient;

  return (
    readStringFromObject(sale.customer_data, ["full_name", "fullName", "name", "company_name", "companyName", "contact_person", "contactPerson", "email", "phone"]) ||
    readStringFromObject(sale.offer_snapshot, ["client_name", "clientName", "full_name", "fullName", "company_name", "companyName"]) ||
    "Brak klienta"
  );
}

function createFinancialDetailRow(
  sale: FinancialSaleRow,
  clientMap: Map<string, ClientRow>,
  net: number,
  gross: number,
  description: string
): FinancialDetailRow | null {
  if (!Number.isFinite(net) || net === 0) return null;

  return {
    saleId: String(getSaleDisplayId(sale)),
    clientName: getSaleClientName(sale, clientMap),
    status: sale.status || "Brak statusu",
    net,
    gross,
    description,
  };
}

function getFinancialDetailTitle(type: FinancialDetailType) {
  const titles: Record<FinancialDetailType, string> = {
    allContracts: "Wartość wszystkich umów",
    activeContracts: "Wartość umów aktywnych",
    lostContracts: "Wartość umów straconych",
    equipment: "Wydatki na sprzęt",
    installation: "Wydatki na montaże",
    commissions: "Prowizje handlowców/managerów",
    guarantee: "Wpływy na fundusz gwarancyjny",
    marketing: "Wpływy na marketing",
    companyProfit: "Dochód firmy",
    ownerProfit: "Zysk per wspólnik",
  };

  return titles[type];
}

function buildFinancialDetailRows(
  sales: FinancialSaleRow[],
  type: FinancialDetailType | null,
  ownerIds: Set<string>,
  clientMap: Map<string, ClientRow>
) {
  if (!type) return [];

  return sales
    .map((sale) => {
      const status = getSaleStatus(sale);
      const revenueGross = getSaleRevenueGross(sale);
      const revenueNet = netFromGross(revenueGross, 0.08);
      const isLost = isLostContractStatus(status);
      const isCompleted = isCompletedSaleStatus(status);
      const isCostEligible = !isCostExcludedStatus(status);
      const sellerId = getSaleSellerId(sale);
      const isOwnerSeller = ownerIds.has(sellerId);
      const sellerCommission = getSaleSellerCommission(sale);
      const sellerMarkupNet = getSaleSellerMarkupNet(sale) || sellerCommission;
      const managerFee = getSaleManagerFee(sale);
      const ownerProfitNet = getSaleOwnerMargin(sale) + (isOwnerSeller ? sellerMarkupNet / 3 : 0);
      const equipmentNet = isCostEligible ? getSaleEquipmentCostDetailed(sale) || getSaleEquipmentCost(sale) : 0;
      const installationNet = isCostEligible ? getSaleInstallationCostDetailed(sale) || getSaleInstallationCost(sale) : 0;
      const sellerCommissionNet = isCompleted && !isOwnerSeller ? sellerMarkupNet : 0;
      const managerFeeNet = isCompleted ? managerFee : 0;

      if (type === "allContracts") {
        return createFinancialDetailRow(sale, clientMap, revenueNet, revenueGross, "Wartość umowy");
      }

      if (type === "activeContracts" && !isLost) {
        return createFinancialDetailRow(sale, clientMap, revenueNet, revenueGross, "Wartość umowy aktywnej");
      }

      if (type === "lostContracts" && isLost) {
        return createFinancialDetailRow(sale, clientMap, revenueNet, revenueGross, "Wartość umowy straconej");
      }

      if (type === "equipment") {
        return createFinancialDetailRow(sale, clientMap, equipmentNet, grossFromNet(equipmentNet, 0.23), "Panele + falownik + magazyn energii + EMS");
      }

      if (type === "installation") {
        return createFinancialDetailRow(sale, clientMap, installationNet, grossFromNet(installationNet, 0.08), "Montaże + konstrukcja + zabezpieczenia + okablowanie + transport");
      }

      if (type === "commissions") {
        const commissionsNet = sellerCommissionNet + managerFeeNet;
        return createFinancialDetailRow(sale, clientMap, commissionsNet, grossFromNet(commissionsNet, 0.23), "Prowizja handlowca + manager fee");
      }

      if (type === "guarantee" && isCompleted) {
        const guaranteeNet = getSaleOperatorFeeNet(sale);
        return createFinancialDetailRow(sale, clientMap, guaranteeNet, grossFromNet(guaranteeNet, 0.08), "operatorFeeNet");
      }

      if (type === "marketing" && isCompleted) {
        const marketingNet = getSaleMarketingValue(sale);
        return createFinancialDetailRow(sale, clientMap, marketingNet, grossFromNet(marketingNet, 0.08), "marketing");
      }

      if (type === "ownerProfit" && !isLost) {
        return createFinancialDetailRow(sale, clientMap, ownerProfitNet, grossFromNet(ownerProfitNet, 0.08), "Zysk na jednego wspólnika");
      }

      if (type === "companyProfit" && !isLost) {
        const companyProfitNet = revenueNet - equipmentNet - installationNet - sellerCommissionNet - managerFeeNet - ownerProfitNet * 3;
        return createFinancialDetailRow(sale, clientMap, companyProfitNet, grossFromNet(companyProfitNet, 0.08), "Dochód firmy z umowy");
      }

      return null;
    })
    .filter((row): row is FinancialDetailRow => Boolean(row));
}

const periodButtons: Array<{ key: PeriodPreset; label: string }> = [
  { key: "day", label: "Dzień" },
  { key: "week", label: "Tydzień" },
  { key: "month", label: "Miesiąc" },
  { key: "quarter", label: "Kwartał" },
  { key: "year", label: "Rok" },
  { key: "custom", label: "Od daty do daty" },
];

const advisorMetrics: MetricCard[] = [
  { label: "Odbyte spotkania", value: "0", change: "—", hint: "Spotkania zakończone w okresie" },
  { label: "Taski", value: "0", change: "—", hint: "Zamknięte i zaległe zadania" },
  { label: "Pozyskani klienci", value: "0", change: "—", hint: "Nowi klienci przypisani do doradcy" },
  { label: "Sprzedaże szt.", value: "0", change: "—", hint: "Liczba sprzedaży" },
  { label: "Sprzedaże obrót", value: "0 zł", change: "—", hint: "Wartość podpisanych umów" },
  { label: "Kompletność dokumentacji", value: "0%", change: "—", hint: "Sprzedaże z kompletem wymaganych plików" },
];

const boardMetrics: MetricCard[] = [
  { label: "Nowe leady", value: "0", hint: "Wszystkie nowe kontakty w okresie" },
  { label: "Spotkania", value: "0", hint: "Utworzone i odbyte spotkania" },
  { label: "Oferty", value: "0", hint: "Oferty zapisane / wysłane" },
  { label: "Sprzedaże", value: "0", hint: "Liczba sprzedaży" },
  { label: "Obrót", value: "0 zł", hint: "Suma wartości umów" },
  { label: "Konwersja lead → sprzedaż", value: "0%", hint: "Sprzedaże / nowe leady" },
];


export default function ReportsPage() {
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const initialRange = useMemo(() => getPresetRange("month"), []);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [ccSummary, setCcSummary] = useState<CcReportSummary>(emptyCcSummary);
  const [previousCcSummary, setPreviousCcSummary] = useState<CcReportSummary>(emptyCcSummary);
  const [loadingCcReport, setLoadingCcReport] = useState(false);
  const [ccReportError, setCcReportError] = useState("");
  const [advisorSummary, setAdvisorSummary] = useState<AdvisorReportSummary>(emptyAdvisorSummary);
  const [advisorUsers, setAdvisorUsers] = useState<AdvisorUserOption[]>([]);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState("all");
  const [managerTeamOptions, setManagerTeamOptions] = useState<ManagerTeamOption[]>([]);
  const [selectedManagerTeamId, setSelectedManagerTeamId] = useState("");
  const [activeManagerTeamDetail, setActiveManagerTeamDetail] = useState<AdvisorDetailType | null>(null);
  const [activeAdvisorDetail, setActiveAdvisorDetail] = useState<AdvisorDetailType | null>(null);
  const [advisorAllowedIds, setAdvisorAllowedIds] = useState<Set<string>>(new Set());
  const [advisorActivities, setAdvisorActivities] = useState<ActivityRow[]>([]);
  const [advisorCalendarEvents, setAdvisorCalendarEvents] = useState<CalendarEventRow[]>([]);
  const [advisorOffers, setAdvisorOffers] = useState<OfferRow[]>([]);
  const [advisorSales, setAdvisorSales] = useState<FinancialSaleRow[]>([]);
  const [advisorClientMap, setAdvisorClientMap] = useState<Map<string, ClientRow>>(new Map());
  const [loadingAdvisorReport, setLoadingAdvisorReport] = useState(false);
  const [advisorReportError, setAdvisorReportError] = useState("");
  const [currentProfile, setCurrentProfile] = useState<ProfileRow | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>(emptyFinancialSummary);
  const [previousFinancialSummary, setPreviousFinancialSummary] = useState<FinancialSummary>(emptyFinancialSummary);
  const [financialSales, setFinancialSales] = useState<FinancialSaleRow[]>([]);
  const [financialClientMap, setFinancialClientMap] = useState<Map<string, ClientRow>>(new Map());
  const [financialOwnerIds, setFinancialOwnerIds] = useState<Set<string>>(new Set());
  const [activeFinancialDetail, setActiveFinancialDetail] = useState<FinancialDetailType | null>(null);
  const [loadingFinancialReport, setLoadingFinancialReport] = useState(false);
  const [financialReportError, setFinancialReportError] = useState("");
  const [boardNewLeads, setBoardNewLeads] = useState(0);
  const [loadingBoardReport, setLoadingBoardReport] = useState(false);
  const [boardReportError, setBoardReportError] = useState("");

  const financialReportTopRef = useRef<HTMLDivElement | null>(null);
  const financialDetailRef = useRef<HTMLDivElement | null>(null);
  const advisorReportTopRef = useRef<HTMLDivElement | null>(null);
  const advisorDetailRef = useRef<HTMLDivElement | null>(null);
  const managerTeamReportTopRef = useRef<HTMLDivElement | null>(null);
  const managerTeamDetailRef = useRef<HTMLDivElement | null>(null);

  function handlePresetChange(nextPreset: PeriodPreset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const range = getPresetRange(nextPreset);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  }

  async function loadCcReport() {
    setLoadingCcReport(true);
    setCcReportError("");

    try {
      const currentRange = getDateRangeBoundaries(dateFrom, dateTo);
      const previousRange = getPreviousDateRange(dateFrom, dateTo);

      const { data: activityRows, error: activitiesError } = await supabase
        .from("client_activities")
        .select("*")
        .gte("created_at", previousRange.fromIso)
        .lte("created_at", currentRange.endIso);

      if (activitiesError) throw activitiesError;

      const { data: calendarEventRows, error: calendarEventsError } = await supabase
        .from("calendar_events")
        .select("id, created_at, created_by, assigned_user_id, source_activity_id, event_type, status, title, event_at")
        .gte("created_at", previousRange.fromIso)
        .lte("created_at", currentRange.endIso);

      if (calendarEventsError) throw calendarEventsError;

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, email, role, manager_id");
      if (profilesError) throw profilesError;

      const profiles = (profileRows || []) as ProfileRow[];
      const profileMap = new Map<string, ProfileRow>(
        profiles.map((profile) => [profile.id, profile])
      );
      const ccUserIds = new Set(
        profiles
          .filter((profile) => normalizeText(profile.role) === "cc")
          .map((profile) => profile.id)
      );

      const allRows = ((activityRows || []) as ActivityRow[]).filter((row) => ccUserIds.has(getActivityOwnerId(row)));
      const allCalendarEvents = ((calendarEventRows || []) as CalendarEventRow[]).filter((event) => ccUserIds.has(getCalendarEventOwnerId(event)));

      const currentRows = allRows.filter((row) => {
        const createdAt = new Date(row.created_at || "").getTime();
        return createdAt >= currentRange.start.getTime() && createdAt <= currentRange.end.getTime();
      });

      const previousRows = allRows.filter((row) => {
        const createdAt = new Date(row.created_at || "").getTime();
        return createdAt >= new Date(previousRange.fromIso).getTime() && createdAt <= new Date(previousRange.toIso).getTime();
      });

      const currentCalendarEvents = allCalendarEvents.filter((event) => {
        const createdAt = new Date(event.created_at || "").getTime();
        return createdAt >= currentRange.start.getTime() && createdAt <= currentRange.end.getTime();
      });

      const previousCalendarEvents = allCalendarEvents.filter((event) => {
        const createdAt = new Date(event.created_at || "").getTime();
        return createdAt >= new Date(previousRange.fromIso).getTime() && createdAt <= new Date(previousRange.toIso).getTime();
      });

      setCcSummary(summarizeCcRows(currentRows, profileMap, currentCalendarEvents));
      setPreviousCcSummary(summarizeCcRows(previousRows, profileMap, previousCalendarEvents));
    } catch (error) {
      console.error("Błąd ładowania raportu CC", error);
      setCcReportError(error instanceof Error ? error.message : "Nie udało się załadować raportu CC.");
    } finally {
      setLoadingCcReport(false);
    }
  }

  // --- ADVISOR REPORT LOADER ---

  async function loadAdvisorReport() {
    setLoadingAdvisorReport(true);
    setAdvisorReportError("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userData.user?.id || "";
      if (!userId) throw new Error("Brak zalogowanego użytkownika.");

      const currentRange = getDateRangeBoundaries(dateFrom, dateTo);

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, email, role, manager_id");

      if (profilesError) throw profilesError;

      const profiles = (profileRows || []) as ProfileRow[];
      const current = profiles.find((profile) => profile.id === userId) || null;
      const currentRole = normalizeText(current?.role || "seller");
      setCurrentProfile(current);

      const allowedUsers = getAllowedAdvisorUsers(profiles, userId, currentRole);
      setAdvisorUsers(allowedUsers);
      const availableTeams = getManagerTeamOptions(profiles, userId, currentRole);
      setManagerTeamOptions(availableTeams);

      if (availableTeams.length > 0 && !availableTeams.some((team) => team.id === selectedManagerTeamId)) {
        setSelectedManagerTeamId(availableTeams[0].id);
      }

      const allowedAdvisorIds = new Set(allowedUsers.map((user) => user.id));
      setAdvisorAllowedIds(allowedAdvisorIds);
      let effectiveSelectedAdvisorId = selectedAdvisorId;

      if (allowedUsers.length === 1) {
        effectiveSelectedAdvisorId = allowedUsers[0].id;
      } else if (selectedAdvisorId !== "all" && !allowedAdvisorIds.has(selectedAdvisorId)) {
        effectiveSelectedAdvisorId = "all";
      }

      if (effectiveSelectedAdvisorId !== selectedAdvisorId) {
        setSelectedAdvisorId(effectiveSelectedAdvisorId);
      }

      if (allowedUsers.length === 0) {
        setAdvisorSummary(emptyAdvisorSummary);
        return;
      }

      const { data: activityRows, error: activitiesError } = await supabase
        .from("client_activities")
        .select("*")
        .gte("created_at", currentRange.startIso)
        .lte("created_at", currentRange.endIso);

      if (activitiesError) throw activitiesError;

      const { data: calendarEventRows, error: calendarEventsError } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("created_at", currentRange.startIso)
        .lte("created_at", currentRange.endIso);

      if (calendarEventsError) throw calendarEventsError;

      const { data: offerRows, error: offersError } = await supabase
        .from("client_offers")
        .select("*")
        .gte("created_at", currentRange.startIso)
        .lte("created_at", currentRange.endIso);

      if (offersError) throw offersError;

      const { data: saleRows, error: salesError } = await supabase
        .from("sales")
        .select("*")
        .gte("created_at", currentRange.startIso)
        .lte("created_at", currentRange.endIso);

      if (salesError) throw salesError;

      const advisorClientIds = Array.from(
        new Set(
          [
            ...((activityRows || []) as ActivityRow[]).map((row) => row.client_id),
            ...((calendarEventRows || []) as CalendarEventRow[]).map((row) => row.client_id),
            ...((offerRows || []) as OfferRow[]).map((row) => row.client_id),
            ...((saleRows || []) as FinancialSaleRow[]).map((row) => row.client_id),
          ].filter(Boolean)
        )
      ) as string[];

      if (advisorClientIds.length > 0) {
        const { data: advisorClientRows, error: advisorClientsError } = await supabase
          .from("clients")
          .select("*")
          .in("id", advisorClientIds);

        if (advisorClientsError) throw advisorClientsError;

        setAdvisorClientMap(
          new Map(((advisorClientRows || []) as ClientRow[]).map((client) => [client.id, client]))
        );
      } else {
        setAdvisorClientMap(new Map());
      }

      setAdvisorActivities((activityRows || []) as ActivityRow[]);
      setAdvisorCalendarEvents((calendarEventRows || []) as CalendarEventRow[]);
      setAdvisorOffers((offerRows || []) as OfferRow[]);
      setAdvisorSales((saleRows || []) as FinancialSaleRow[]);

      setAdvisorSummary(
        summarizeAdvisorReport(
          (activityRows || []) as ActivityRow[],
          (calendarEventRows || []) as CalendarEventRow[],
          (offerRows || []) as OfferRow[],
          (saleRows || []) as FinancialSaleRow[],
          effectiveSelectedAdvisorId,
          allowedAdvisorIds
        )
      );
    } catch (error) {
      console.error("Błąd ładowania raportu doradcy", error);
      setAdvisorReportError(error instanceof Error ? error.message : "Nie udało się załadować raportu doradcy.");
    } finally {
      setLoadingAdvisorReport(false);
    }
  }

  async function loadFinancialReport() {
    setLoadingFinancialReport(true);
    setFinancialReportError("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userData.user?.id || "";
      if (!userId) throw new Error("Brak zalogowanego użytkownika.");

      const currentRange = getDateRangeBoundaries(dateFrom, dateTo);
      const previousRange = getPreviousDateRange(dateFrom, dateTo);

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, email, role");

      if (profilesError) throw profilesError;

      const profiles = (profileRows || []) as ProfileRow[];
      const current = profiles.find((profile) => profile.id === userId) || null;
      setCurrentProfile(current);

      const currentRole = normalizeText(current?.role || "seller");
      const ownerIds = new Set(
        profiles
          .filter((profile) => normalizeText(profile.role) === "owner" || normalizeText(profile.role) === "admin")
          .map((profile) => profile.id)
      );
      const managerUserIds = new Set(
        profiles
          .filter((profile) => normalizeText(profile.role) === "manager")
          .map((profile) => profile.id)
      );

      setFinancialOwnerIds(ownerIds);

      const { data: saleRows, error: salesError } = await supabase
        .from("sales")
        .select("*")
        .gte("created_at", currentRange.startIso)
        .lte("created_at", currentRange.endIso);

      if (salesError) throw salesError;

      let previousSaleRows: FinancialSaleRow[] = [];

      if (preset !== "custom") {
        const { data: previousRows, error: previousSalesError } = await supabase
          .from("sales")
          .select("*")
          .gte("created_at", previousRange.fromIso)
          .lte("created_at", previousRange.toIso);

        if (previousSalesError) throw previousSalesError;
        previousSaleRows = (previousRows || []) as FinancialSaleRow[];
      }

      const allSales = (saleRows || []) as FinancialSaleRow[];
      const visibleSales = allSales.filter((sale) => {
        const sellerId = getSaleSellerId(sale);

        if (currentRole === "admin" || currentRole === "owner") return true;
        if (currentRole === "manager") return sellerId === userId || sale.manager_id === userId;
        return sellerId === userId;
      });

      const previousVisibleSales = previousSaleRows.filter((sale) => {
        const sellerId = getSaleSellerId(sale);

        if (currentRole === "admin" || currentRole === "owner") return true;
        if (currentRole === "manager") return sellerId === userId || sale.manager_id === userId;
        return sellerId === userId;
      });

      setFinancialSales(visibleSales);

      const clientIds = Array.from(new Set(visibleSales.map((sale) => sale.client_id).filter(Boolean))) as string[];

      if (clientIds.length > 0) {
        const { data: clientRows, error: clientsError } = await supabase
          .from("clients")
          .select("id, full_name, company_name, contact_person, email, phone")
          .in("id", clientIds);

        if (clientsError) throw clientsError;

        setFinancialClientMap(
          new Map(((clientRows || []) as ClientRow[]).map((client) => [client.id, client]))
        );
      } else {
        setFinancialClientMap(new Map());
      }

      setFinancialSummary(
        summarizeFinancialSales(visibleSales, userId, currentRole, ownerIds, managerUserIds)
      );
      setPreviousFinancialSummary(
        preset === "custom"
          ? emptyFinancialSummary
          : summarizeFinancialSales(previousVisibleSales, userId, currentRole, ownerIds, managerUserIds)
      );
    } catch (error) {
      console.error("Błąd ładowania raportu finansowego", error);
      setFinancialReportError(error instanceof Error ? error.message : "Nie udało się załadować raportu finansowego.");
    } finally {
      setLoadingFinancialReport(false);
    }
  }

  // --- BOARD REPORT LOADER ---

  async function loadBoardReport() {
    setLoadingBoardReport(true);
    setBoardReportError("");

    try {
      const currentRange = getDateRangeBoundaries(dateFrom, dateTo);

      const { count, error } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .gte("created_at", currentRange.startIso)
        .lte("created_at", currentRange.endIso);

      if (error) throw error;

      setBoardNewLeads(count || 0);
    } catch (error) {
      console.error("Błąd ładowania raportu zarządu", error);
      setBoardReportError(error instanceof Error ? error.message : "Nie udało się załadować raportu zarządu.");
    } finally {
      setLoadingBoardReport(false);
    }
  }

  useEffect(() => {
    loadCcReport();
    loadFinancialReport();
    loadAdvisorReport();
    loadBoardReport();
  }, [dateFrom, dateTo, selectedAdvisorId]);

  const currentRole = normalizeText(currentProfile?.role || "seller");
  const canSeeOwnerFinance = currentRole === "admin" || currentRole === "owner";
  const canSeeManagerFinance = currentRole === "manager";
  const canSeeAdvisorFinance = currentRole === "seller" || currentRole === "manager" || currentRole === "owner" || currentRole === "admin";
  const canSeeRemoteActivityReport = currentRole === "admin" || currentRole === "owner" || currentRole === "manager" || currentRole === "cc";
  const canSeeManagerTeamReport = currentRole === "admin" || currentRole === "owner" || currentRole === "manager";

  const financialDetailRows = useMemo(
    () => buildFinancialDetailRows(financialSales, activeFinancialDetail, financialOwnerIds, financialClientMap),
    [activeFinancialDetail, financialClientMap, financialOwnerIds, financialSales]
  );

  const advisorMap = useMemo(
    () => new Map(advisorUsers.map((advisor) => [advisor.id, advisor])),
    [advisorUsers]
  );

  const advisorDetailRows = useMemo(
    () =>
      buildAdvisorDetailRows(
        activeAdvisorDetail,
        selectedAdvisorId,
        advisorAllowedIds,
        advisorMap,
        advisorClientMap,
        advisorActivities,
        advisorCalendarEvents,
        advisorOffers,
        advisorSales
      ),
    [
      activeAdvisorDetail,
      advisorActivities,
      advisorAllowedIds,
      advisorCalendarEvents,
      advisorClientMap,
      advisorMap,
      advisorOffers,
      advisorSales,
      selectedAdvisorId,
    ]
  );

  const selectedManagerTeam = useMemo(
    () => managerTeamOptions.find((team) => team.id === selectedManagerTeamId) || null,
    [managerTeamOptions, selectedManagerTeamId]
  );

  const managerTeamAllowedIds = useMemo(
    () => new Set(selectedManagerTeam?.memberIds || []),
    [selectedManagerTeam]
  );

  const managerTeamSummary = useMemo(
    () =>
      selectedManagerTeam
        ? summarizeAdvisorReport(
            advisorActivities,
            advisorCalendarEvents,
            advisorOffers,
            advisorSales,
            "all",
            managerTeamAllowedIds
          )
        : emptyAdvisorSummary,
    [
      advisorActivities,
      advisorCalendarEvents,
      advisorOffers,
      advisorSales,
      managerTeamAllowedIds,
      selectedManagerTeam,
    ]
  );

  const managerTeamDetailRows = useMemo(
    () =>
      buildAdvisorDetailRows(
        activeManagerTeamDetail,
        "all",
        managerTeamAllowedIds,
        advisorMap,
        advisorClientMap,
        advisorActivities,
        advisorCalendarEvents,
        advisorOffers,
        advisorSales
      ),
    [
      activeManagerTeamDetail,
      advisorActivities,
      advisorCalendarEvents,
      advisorClientMap,
      advisorMap,
      advisorOffers,
      advisorSales,
      managerTeamAllowedIds,
    ]
  );

  function handleFinancialMetricClick(detailType: MetricDetailType) {
    setActiveFinancialDetail(detailType as FinancialDetailType);

    window.setTimeout(() => {
      financialDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function handleCloseFinancialDetail() {
    setActiveFinancialDetail(null);

    window.setTimeout(() => {
      financialReportTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function handleAdvisorMetricClick(detailType: MetricDetailType) {
    setActiveAdvisorDetail(detailType as AdvisorDetailType);

    window.setTimeout(() => {
      advisorDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function handleCloseAdvisorDetail() {
    setActiveAdvisorDetail(null);

    window.setTimeout(() => {
      advisorReportTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function handleManagerTeamMetricClick(detailType: MetricDetailType) {
    setActiveManagerTeamDetail(detailType as AdvisorDetailType);

    window.setTimeout(() => {
      managerTeamDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function handleCloseManagerTeamDetail() {
    setActiveManagerTeamDetail(null);

    window.setTimeout(() => {
      managerTeamReportTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  const showFinancialComparison = preset !== "custom";
  const ownerFinancialMetrics: MetricCard[] = [
    {
      label: "Wartość wszystkich umów",
      value: formatCurrency(netFromGross(financialSummary.totalRevenueGross, 0.08)),
      ...(showFinancialComparison
        ? formatCurrencyChange(
            netFromGross(financialSummary.totalRevenueGross, 0.08),
            netFromGross(previousFinancialSummary.totalRevenueGross, 0.08)
          )
        : {}),
      hint: formatGrossLine(financialSummary.totalRevenueGross),
      detailType: "allContracts",
    },
    {
      label: "Wartość umów aktywnych",
      value: formatCurrency(netFromGross(financialSummary.revenueGross, 0.08)),
      ...(showFinancialComparison
        ? formatCurrencyChange(
            netFromGross(financialSummary.revenueGross, 0.08),
            netFromGross(previousFinancialSummary.revenueGross, 0.08)
          )
        : {}),
      hint: formatGrossLine(financialSummary.revenueGross),
      detailType: "activeContracts",
    },
    {
      label: "Wartość umów straconych",
      value: formatCurrency(netFromGross(financialSummary.lostRevenueGross, 0.08)),
      ...(showFinancialComparison
        ? formatCurrencyChange(
            netFromGross(financialSummary.lostRevenueGross, 0.08),
            netFromGross(previousFinancialSummary.lostRevenueGross, 0.08),
            true
          )
        : {}),
      hint: formatGrossLine(financialSummary.lostRevenueGross),
      detailType: "lostContracts",
    },
    {
      label: "Wydatki na sprzęt",
      value: formatCurrency(financialSummary.equipmentCost),
      ...(showFinancialComparison
        ? formatCurrencyChange(financialSummary.equipmentCost, previousFinancialSummary.equipmentCost, true)
        : {}),
      hint: formatGrossLine(grossFromNet(financialSummary.equipmentCost, 0.23)),
      detailType: "equipment",
    },
    {
      label: "Wydatki na montaże",
      value: formatCurrency(financialSummary.installationCost),
      ...(showFinancialComparison
        ? formatCurrencyChange(financialSummary.installationCost, previousFinancialSummary.installationCost, true)
        : {}),
      hint: formatGrossLine(grossFromNet(financialSummary.installationCost, 0.08)),
      detailType: "installation",
    },
    {
      label: "Prowizje handlowców/managerów",
      value: formatCurrency(financialSummary.sellerCommissions + financialSummary.managerCommissions),
      ...(showFinancialComparison
        ? formatCurrencyChange(
            financialSummary.sellerCommissions + financialSummary.managerCommissions,
            previousFinancialSummary.sellerCommissions + previousFinancialSummary.managerCommissions,
            true
          )
        : {}),
      hint: formatGrossLine(grossFromNet(financialSummary.sellerCommissions + financialSummary.managerCommissions, 0.23)),
      detailType: "commissions",
    },
    {
      label: "Wpływy na fundusz gwarancyjny",
      value: formatCurrency(financialSummary.guaranteeFund),
      ...(showFinancialComparison
        ? formatCurrencyChange(financialSummary.guaranteeFund, previousFinancialSummary.guaranteeFund)
        : {}),
      hint: formatGrossLine(grossFromNet(financialSummary.guaranteeFund, 0.08)),
      detailType: "guarantee",
    },
    {
      label: "Wpływy na marketing",
      value: formatCurrency(financialSummary.marketingFund),
      ...(showFinancialComparison
        ? formatCurrencyChange(financialSummary.marketingFund, previousFinancialSummary.marketingFund)
        : {}),
      hint: formatGrossLine(grossFromNet(financialSummary.marketingFund, 0.08)),
      detailType: "marketing",
    },
    {
      label: "Dochód firmy",
      value: formatCurrency(financialSummary.companyProfit),
      ...(showFinancialComparison
        ? formatCurrencyChange(financialSummary.companyProfit, previousFinancialSummary.companyProfit)
        : {}),
      hint: formatGrossLine(grossFromNet(financialSummary.companyProfit, 0.08)),
      detailType: "companyProfit",
    },
    {
      label: "Zysk per wspólnik",
      value: formatCurrency(financialSummary.ownerProfit),
      ...(showFinancialComparison
        ? formatCurrencyChange(financialSummary.ownerProfit, previousFinancialSummary.ownerProfit)
        : {}),
      hint: formatGrossLine(grossFromNet(financialSummary.ownerProfit, 0.08)),
      detailType: "ownerProfit",
    },
  ];

  const advisorFinancialMetrics: MetricCard[] = [
    { label: "Prowizja prognozowana", value: formatCurrency(financialSummary.advisorCommissionForecast), hint: "Umówione do montażu, Zamontowany, Oczekiwanie na pełną wpłatę" },
    { label: "Prowizja do wypłaty", value: formatCurrency(financialSummary.advisorCommissionPayable), hint: "Umowy zakończone" },
  ];

  const managerFinancialMetrics: MetricCard[] = [
    { label: "Manager fee prognozowany", value: formatCurrency(financialSummary.managerFeeForecast), hint: "Manager fee z umów w statusach prognozowanych" },
    { label: "Manager fee do wypłaty", value: formatCurrency(financialSummary.managerFeePayable), hint: "Manager fee z umów zakończonych" },
    { label: "Prowizja z własnej sprzedaży prognozowana", value: formatCurrency(financialSummary.managerOwnSalesCommissionForecast), hint: "Marża handlowca z własnej sprzedaży managera" },
    { label: "Prowizja z własnej sprzedaży do wypłaty", value: formatCurrency(financialSummary.managerOwnSalesCommissionPayable), hint: "Zakończona własna sprzedaż managera" },
  ];

  const advisorReportMetrics: MetricCard[] = [
    {
      label: "Wykonane kontakty zdalne",
      value: String(advisorSummary.remoteContacts),
      hint: "Telefon + mail + SMS",
      detailType: "remoteContacts",
    },
    {
      label: "Telefony",
      value: String(advisorSummary.phoneCalls),
      hint: "Kontakty telefoniczne przypisane do doradcy",
      detailType: "phoneCalls",
    },
    {
      label: "Maile",
      value: String(advisorSummary.emails),
      hint: "Zapisane aktywności mailowe",
      detailType: "emails",
    },
    {
      label: "Zapisane oferty z kalkulatora",
      value: String(advisorSummary.savedOffers),
      hint: "Oferty zapisane w CRM w wybranym okresie",
      detailType: "savedOffers",
    },
    {
      label: "Wysłane oferty z kalkulatora",
      value: String(advisorSummary.sentOffers),
      hint: "Oferty oznaczone jako wysłane mailem",
      detailType: "sentOffers",
    },
    {
      label: "Umówione spotkania",
      value: String(advisorSummary.meetingsScheduled),
      hint: "Spotkania przypisane do doradcy w kalendarzu",
      detailType: "meetingsScheduled",
    },
    {
      label: "Odbyte spotkania",
      value: String(advisorSummary.meetingsCompleted),
      hint: "Spotkania ze statusem odbyte/zakończone",
      detailType: "meetingsCompleted",
    },
    {
      label: "Sprzedaże",
      value: String(advisorSummary.salesCount),
      hint: "Sprzedaże przypisane do doradcy",
      detailType: "sales",
    },
    {
      label: "Kompletność dokumentacji",
      value: `${advisorSummary.documentationCompleteness}%`,
      hint: "Sprzedaże z kompletem/zatwierdzeniem dokumentacji",
      detailType: "documentation",
    },
  ];

  const managerTeamReportMetrics: MetricCard[] = [
    {
      label: "Wykonane kontakty zdalne",
      value: String(managerTeamSummary.remoteContacts),
      hint: "Telefon + mail + SMS w ramach zespołu",
      detailType: "remoteContacts",
    },
    {
      label: "Telefony",
      value: String(managerTeamSummary.phoneCalls),
      hint: "Kontakty telefoniczne zespołu",
      detailType: "phoneCalls",
    },
    {
      label: "Maile",
      value: String(managerTeamSummary.emails),
      hint: "Zapisane aktywności mailowe zespołu",
      detailType: "emails",
    },
    {
      label: "Zapisane oferty z kalkulatora",
      value: String(managerTeamSummary.savedOffers),
      hint: "Oferty zapisane przez zespół w CRM",
      detailType: "savedOffers",
    },
    {
      label: "Wysłane oferty z kalkulatora",
      value: String(managerTeamSummary.sentOffers),
      hint: "Oferty zespołu oznaczone jako wysłane mailem",
      detailType: "sentOffers",
    },
    {
      label: "Umówione spotkania",
      value: String(managerTeamSummary.meetingsScheduled),
      hint: "Spotkania przypisane do członków zespołu",
      detailType: "meetingsScheduled",
    },
    {
      label: "Odbyte spotkania",
      value: String(managerTeamSummary.meetingsCompleted),
      hint: "Spotkania zespołu ze statusem odbyte/zakończone",
      detailType: "meetingsCompleted",
    },
    {
      label: "Sprzedaże",
      value: String(managerTeamSummary.salesCount),
      hint: "Sprzedaże przypisane do zespołu",
      detailType: "sales",
    },
    {
      label: "Kompletność dokumentacji",
      value: `${managerTeamSummary.documentationCompleteness}%`,
      hint: "Sprzedaże zespołu z kompletem/zatwierdzeniem dokumentacji",
      detailType: "documentation",
    },
  ];
const boardMeetingsCount = advisorCalendarEvents.filter(isMeetingCalendarEvent).length;
const boardOffersCount = advisorOffers.length;
const boardSalesCount = advisorSales.length;
const boardRevenueGross = advisorSales.reduce((sum, sale) => sum + getSaleRevenueGross(sale), 0);
const boardConversionRate = boardNewLeads > 0 ? Math.round((boardSalesCount / boardNewLeads) * 100) : 0;

const dynamicBoardMetrics: MetricCard[] = [
  {
    label: "Nowe leady",
    value: String(boardNewLeads),
    hint: "Wszystkie nowe kontakty w okresie",
  },
  {
    label: "Spotkania",
    value: String(boardMeetingsCount),
    hint: "Utworzone i odbyte spotkania",
  },
  {
    label: "Oferty",
    value: String(boardOffersCount),
    hint: "Oferty zapisane / wysłane",
  },
  {
    label: "Sprzedaże",
    value: String(boardSalesCount),
    hint: "Liczba sprzedaży",
  },
  {
    label: "Obrót",
    value: formatCurrency(boardRevenueGross),
    hint: "Suma wartości umów brutto",
  },
  {
    label: "Konwersja lead → sprzedaż",
    value: `${boardConversionRate}%`,
    hint: "Sprzedaże / nowe leady",
  },
];
  const ccMetrics: MetricCard[] = [
    {
      label: "Telefony",
      value: String(ccSummary.phoneCalls),
      change: formatNumberChange(ccSummary.phoneCalls, previousCcSummary.phoneCalls),
      hint: "Liczba wykonanych kontaktów CC w wybranym okresie",
    },
    {
      label: "Odbyte rozmowy",
      value: String(ccSummary.uniqueClientConversations),
      change: formatNumberChange(ccSummary.uniqueClientConversations, previousCcSummary.uniqueClientConversations),
      hint: "Unikalni klienci, z którymi odbyła się rozmowa w wybranym okresie",
    },
    {
      label: "Maile",
      value: String(ccSummary.emails),
      change: formatNumberChange(ccSummary.emails, previousCcSummary.emails),
      hint: "Liczba zapisanych aktywności mailowych w wybranym okresie",
    },
    {
      label: "SMS",
      value: String(ccSummary.sms),
      change: formatNumberChange(ccSummary.sms, previousCcSummary.sms),
      hint: "Liczba zapisanych aktywności SMS w wybranym okresie",
    },
    {
      label: "Umówione spotkania",
      value: String(ccSummary.meetingsScheduled),
      change: formatNumberChange(ccSummary.meetingsScheduled, previousCcSummary.meetingsScheduled),
      hint: "Spotkania umówione przez CC w wybranym okresie",
    },
    {
      label: "Konwersja",
      value: `${ccSummary.conversionRate}%`,
      change: formatPercentChange(ccSummary.conversionRate, previousCcSummary.conversionRate),
      hint: "Umówione spotkania / telefony",
    },
    {
      label: "Nie odbiera",
      value: String(ccSummary.noAnswer),
      change: formatNumberChange(ccSummary.noAnswer, previousCcSummary.noAnswer),
      hint: "Kontakty zakończone statusem: nie odbiera",
    },
    {
      label: "Prośba o ponowny kontakt",
      value: String(ccSummary.callBackRequests),
      change: formatNumberChange(ccSummary.callBackRequests, previousCcSummary.callBackRequests),
      hint: "Kontakty wymagające kolejnego follow-upu",
    },
    {
      label: "Niezainteresowany",
      value: String(ccSummary.notInterested),
      change: formatNumberChange(ccSummary.notInterested, previousCcSummary.notInterested),
      hint: "Kontakty zakończone odmową",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">IdeaSol CRM</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Raporty i zestawienia</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Panel raportowy dla CC, doradców, managerów i zarządu. Pierwsza wersja buduje
                strukturę widoku, zakresy dat i KPI, które następnie podepniemy pod dane CRM.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200">
              Zakres: <span className="font-semibold text-white">{dateFrom}</span> —{" "}
              <span className="font-semibold text-white">{dateTo}</span>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Zakres raportu</h2>
              <p className="mt-1 text-sm text-slate-500">Wybierz gotowy okres albo ustaw własny zakres od daty do daty.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {periodButtons.map((button) => (
                <button
                  key={button.key}
                  type="button"
                  onClick={() => handlePresetChange(button.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    preset === button.key
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:max-w-2xl">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Data od
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setPreset("custom");
                  setDateFrom(event.target.value);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none ring-0 transition focus:border-slate-400"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Data do
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setPreset("custom");
                  setDateTo(event.target.value);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none ring-0 transition focus:border-slate-400"
              />
            </label>
          </div>
        </section>

        <ReportSection
          title="Raport finansowy"
          description=""
        >
          {loadingFinancialReport ? (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
              Ładowanie raportu finansowego...
            </div>
          ) : null}
          {financialReportError ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {financialReportError}
            </div>
          ) : null}

          <div ref={financialReportTopRef} className="mb-4 scroll-mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            Liczba umów w raporcie: <span className="font-semibold text-slate-950">{financialSummary.salesCount}</span>
          </div>
          {canSeeOwnerFinance ? (
            <div className="mb-6">
              <h3 className="mb-3 text-base font-semibold text-slate-950">Widok właściciela</h3>
              <MetricGrid metrics={ownerFinancialMetrics} onMetricClick={handleFinancialMetricClick} />

              {activeFinancialDetail ? (
                <div ref={financialDetailRef} className="mt-5 scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        Szczegóły: {getFinancialDetailTitle(activeFinancialDetail)}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Umowy ujęte w wybranym okresie raportowym. Kwoty netto i brutto dotyczą wpływu albo kosztu danego kafelka.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseFinancialDetail}
                      className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      Zamknij szczegóły
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3">SaleID</th>
                          <th className="px-5 py-3">Klient</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Opis</th>
                          <th className="px-5 py-3 text-right">Netto</th>
                          <th className="px-5 py-3 text-right">Brutto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {financialDetailRows.length > 0 ? (
                          financialDetailRows.map((row) => (
                            <tr key={`${row.saleId}-${row.description}`} className="transition hover:bg-slate-50">
                              <td className="px-5 py-4 font-semibold text-blue-700">{row.saleId}</td>
                              <td className="px-5 py-4 text-slate-800">{row.clientName}</td>
                              <td className="px-5 py-4 text-slate-600">{row.status}</td>
                              <td className="px-5 py-4 text-slate-600">{row.description}</td>
                              <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatCurrency(row.net)}</td>
                              <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatCurrency(row.gross)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-5 py-5 text-slate-500" colSpan={6}>
                              Brak pozycji dla tego modułu w wybranym okresie.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {financialDetailRows.length > 0 ? (
                        <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-950">
                          <tr>
                            <td className="px-5 py-4" colSpan={4}>Suma</td>
                            <td className="px-5 py-4 text-right">
                              {formatCurrency(financialDetailRows.reduce((sum, row) => sum + row.net, 0))}
                            </td>
                            <td className="px-5 py-4 text-right">
                              {formatCurrency(financialDetailRows.reduce((sum, row) => sum + row.gross, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      ) : null}
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {canSeeAdvisorFinance ? (
            <div className="mb-6">
              <h3 className="mb-3 text-base font-semibold text-slate-950">Widok doradcy</h3>
              <MetricGrid metrics={advisorFinancialMetrics} />
            </div>
          ) : null}

          {canSeeManagerFinance ? (
            <div>
              <h3 className="mb-3 text-base font-semibold text-slate-950">Widok managera</h3>
              <MetricGrid metrics={managerFinancialMetrics} />
            </div>
          ) : null}
        </ReportSection>

        {canSeeRemoteActivityReport ? (
        <ReportSection
          title="Raport aktywności - kontakty zdalne"
          description="Telefony, maile, SMS, umówione spotkania i konwersja liczone wyłącznie dla użytkowników z rolą CC."
        >
          {loadingCcReport ? (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
              Ładowanie raportu CC...
            </div>
          ) : null}
          {ccReportError ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {ccReportError}
            </div>
          ) : null}
          <MetricGrid metrics={ccMetrics} />
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold text-slate-950">Kontakty zdalne per CC</h3>
              <p className="mt-1 text-sm text-slate-500">Ranking użytkowników CC według liczby kontaktów zdalnych w wybranym okresie.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Użytkownik</th>
                    <th className="px-5 py-3">Telefony</th>
                    <th className="px-5 py-3">Rozmowy</th>
                    <th className="px-5 py-3">Maile</th>
                    <th className="px-5 py-3">SMS</th>
                    <th className="px-5 py-3">Umówione spotkania</th>
                    <th className="px-5 py-3">Konwersja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {ccSummary.users.length > 0 ? (
                    ccSummary.users.map((user) => (
                      <tr key={user.userId} className="transition hover:bg-slate-50">
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          <a
                            href={`/reports/users/${user.userId}?from=${dateFrom}&to=${dateTo}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-700 underline-offset-2 hover:underline"
                          >
                            {user.name}
                          </a>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          <a
                            href={`/reports/users/${user.userId}?from=${dateFrom}&to=${dateTo}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-blue-700 underline-offset-2 hover:underline"
                          >
                            {user.phoneCalls}
                          </a>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{user.uniqueClientConversations}</td>
                        <td className="px-5 py-4 text-slate-700">{user.emails}</td>
                        <td className="px-5 py-4 text-slate-700">{user.sms}</td>
                        <td className="px-5 py-4 text-slate-700">{user.meetingsScheduled}</td>
                        <td className="px-5 py-4 text-slate-700">{user.conversionRate}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-5 py-5 text-slate-500" colSpan={7}>Brak kontaktów telefonicznych w wybranym zakresie.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ReportSection>
        ) : null}

        {canSeeAdvisorFinance ? (
          <ReportSection
            title="Raport doradcy"
            description="Kontakty zdalne, oferty z kalkulatora, spotkania, sprzedaże i kompletność dokumentacji."
          >
            {loadingAdvisorReport ? (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
                Ładowanie raportu doradcy...
              </div>
            ) : null}
            {advisorReportError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {advisorReportError}
              </div>
            ) : null}

            <div ref={advisorReportTopRef} className="scroll-mt-6" />

{advisorUsers.length > 1 ? (
              <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="flex max-w-md flex-col gap-2 text-sm font-semibold text-slate-700">
                  Doradca / zakres
                  <select
                    value={selectedAdvisorId}
                    onChange={(event) => setSelectedAdvisorId(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-400"
                  >
                    <option value="all">Wszyscy dostępni doradcy</option>
                    {advisorUsers.map((advisor) => (
                      <option key={advisor.id} value={advisor.id}>
                        {advisor.name} ({advisor.role})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <MetricGrid metrics={advisorReportMetrics} onMetricClick={handleAdvisorMetricClick} />

{activeAdvisorDetail ? (
  <div ref={advisorDetailRef} className="mt-5 scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="font-semibold text-slate-950">
          Szczegóły: {getAdvisorDetailTitle(activeAdvisorDetail)}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Pozycje zgodne z aktualnym zakresem dat oraz wybranym doradcą w dropdownie.
        </p>
      </div>
      <button
        type="button"
        onClick={handleCloseAdvisorDetail}
        className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
      >
        Zamknij szczegóły
      </button>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Data</th>
<th className="px-5 py-3">Doradca</th>
<th className="px-5 py-3">LeadID</th>
<th className="px-5 py-3">Klient</th>
<th className="px-5 py-3">Typ</th>
<th className="px-5 py-3">Status</th>
<th className="px-5 py-3">Opis / powiązanie</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {advisorDetailRows.length > 0 ? (
            advisorDetailRows.map((row) => (
              <tr key={`${row.id}-${row.type}-${row.date}`} className="transition hover:bg-slate-50">
                <td className="px-5 py-4 font-semibold text-slate-900">{row.date}</td>
<td className="px-5 py-4 text-slate-800">{row.advisorName}</td>
<td className="px-5 py-4 font-semibold text-slate-900">
  {row.clientId ? (
    <a className="text-blue-700 underline-offset-2 hover:underline" href={`/clients/${row.clientId}`}>
      {row.leadId}
    </a>
  ) : (
    "—"
  )}
</td>
<td className="px-5 py-4 text-slate-800">{row.clientName}</td>
<td className="px-5 py-4 text-slate-600">{row.type}</td>
<td className="px-5 py-4 text-slate-600">{row.status}</td>
<td className="px-5 py-4 text-slate-600">{row.description}</td>
              </tr>
            ))
          ) : (
            <tr><td className="px-5 py-5 text-slate-500" colSpan={7}>
              
                Brak pozycji dla tego typu aktywności w wybranym okresie.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
) : null}
          </ReportSection>
        ) : null}

        <ReportSection title="Raport managera" description="Te same KPI co u doradcy, ale liczone zespołowo po przypisaniu doradców do managera.">
          <div ref={managerTeamReportTopRef} className="scroll-mt-6" />

{managerTeamOptions.length > 0 ? (
  <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <label className="flex max-w-md flex-col gap-2 text-sm font-semibold text-slate-700">
      Zespół managera
      <select
        value={selectedManagerTeamId}
        onChange={(event) => setSelectedManagerTeamId(event.target.value)}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-400"
      >
        {managerTeamOptions.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  </div>
) : (
  <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
    Brak dostępnych zespołów managerów w tym widoku.
  </div>
)}

<MetricGrid metrics={managerTeamReportMetrics} onMetricClick={handleManagerTeamMetricClick} />
        </ReportSection>

        <ReportSection title="Raport zarządu" description="Widok ogólny: leady, spotkania, oferty, sprzedaże, obrót i konwersja lejka.">
         {boardReportError ? (
  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
    {boardReportError}
  </div>
) : (
  <MetricGrid metrics={dynamicBoardMetrics} />
)}
        </ReportSection>
      </div>
    </main>
  );
}