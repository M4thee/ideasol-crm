import type {
  ActivityRow,
  AdvisorDetailRow,
  AdvisorDetailType,
  AdvisorReportSummary,
  AdvisorUserOption,
  CalendarEventRow,
  ClientRow,
  FinancialSaleRow,
  OfferRow,
} from "./types";
import {
  formatAdvisorDetailDate,
  getAdvisorActivityOwnerId,
  getAdvisorDetailClient,
  getAdvisorEventOwnerId,
  getAdvisorName,
  getContactStatus,
  getOfferOwnerId,
  isCompletedMeetingEvent,
  isEmailActivity,
  isMeetingCalendarEvent,
  isOfferSent,
  isPhoneActivity,
  isSelectedAdvisor,
  isSmsActivity,
} from "./utils";
import {
  getSaleDisplayId,
  getSaleSellerId,
  isSaleDocumentationComplete,
} from "./financial-utils";

export function summarizeAdvisorReport(
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

export function buildAdvisorDetailRows(
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
        description: String(row.description || row.note || "—"),
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
        description: String(row.title || "Spotkanie"),
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