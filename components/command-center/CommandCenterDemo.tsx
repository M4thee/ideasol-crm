"use client";

import { useEffect, useState } from "react";

import type { CommandCenterMetrics } from "@/lib/command-center/types";
import { createDefaultCommandCenterSnapshot } from "@/lib/command-center/widget-registry";
import CommandCenterCanvas from "./CommandCenterCanvas";

const demoSources = [
  { label: "Formularz WWW", value: 71 },
  { label: "Polecenie", value: 44 },
  { label: "Kampania", value: 39 },
  { label: "Partner", value: 22 },
  { label: "Inne", value: 11 },
];
const demoStatuses = [
  { label: "Nowy", value: 49 },
  { label: "W kontakcie", value: 46 },
  { label: "Spotkanie", value: 31 },
  { label: "Oferta", value: 27 },
  { label: "Sprzedaż", value: 21 },
];
const demoRanking = [
  { advisorId: "demo-a", advisorName: "Doradca A", leads: 38, contactedLeads: 31, contactRate: 82, sales: 9, salesValue: 194_000, conversion: 24 },
  { advisorId: "demo-b", advisorName: "Doradca B", leads: 41, contactedLeads: 33, contactRate: 80, sales: 8, salesValue: 171_000, conversion: 20 },
  { advisorId: "demo-c", advisorName: "Doradca C", leads: 35, contactedLeads: 25, contactRate: 71, sales: 6, salesValue: 139_000, conversion: 17 },
  { advisorId: "demo-d", advisorName: "Doradca D", leads: 32, contactedLeads: 24, contactRate: 75, sales: 5, salesValue: 102_000, conversion: 16 },
];

const demoMetrics: CommandCenterMetrics = {
  generatedAt: new Date().toISOString(),
  leads: {
    yesterday: 11,
    today: 14,
    week: 63,
    month: 187,
    quarter: 514,
    contactedMonth: 142,
    contactRateMonth: 76,
    averageFirstActivityMinutes: 38,
    sources: demoSources,
    statuses: demoStatuses,
    contactRateByPeriod: { yesterday: 73, today: 79, week: 77, month: 76, quarter: 74 },
    averageFirstActivityMinutesByPeriod: { yesterday: 42, today: 31, week: 35, month: 38, quarter: 41 },
    sourcesByPeriod: { yesterday: demoSources, today: demoSources, week: demoSources, month: demoSources, quarter: demoSources },
    statusesByPeriod: { yesterday: demoStatuses, today: demoStatuses, week: demoStatuses, month: demoStatuses, quarter: demoStatuses },
  },
  sales: {
    yesterday: 2, today: 3, week: 12, month: 32, quarter: 91,
    valueYesterday: 31_000, valueToday: 48_000, valueWeek: 231_000, valueMonth: 684_000, valueQuarter: 1_934_000,
    valueByPeriod: { yesterday: 31_000, today: 48_000, week: 231_000, month: 684_000, quarter: 1_934_000 },
  },
  funnel: {
    leads: 187, contacted: 142, meetings: 79, offers: 48, sales: 32,
    byPeriod: {
      yesterday: { leads: 11, contacted: 8, meetings: 4, offers: 3, sales: 2 },
      today: { leads: 14, contacted: 11, meetings: 4, offers: 3, sales: 3 },
      week: { leads: 63, contacted: 49, meetings: 21, offers: 15, sales: 12 },
      month: { leads: 187, contacted: 142, meetings: 79, offers: 48, sales: 32 },
      quarter: { leads: 514, contacted: 381, meetings: 204, offers: 137, sales: 91 },
    },
  },
  meetings: { yesterday: 3, today: 4, week: 21, month: 79, quarter: 204, scheduledToday: 9, upcomingToday: 5 },
  calls: { yesterday: 39, today: 47, week: 196, month: 731, quarter: 1_982 },
  leadMap: {
    validPostalCodes: 164,
    locatedLeads: 161,
    points: [
      { campaign: "ARiMR", campaignKind: "metaArimr", postalCode: "00-001", latitude: 52.2297, longitude: 21.0122, yesterday: 2, today: 3, week: 12, month: 31, quarter: 84 },
      { campaign: "ME", campaignKind: "meta", postalCode: "30-001", latitude: 50.0647, longitude: 19.945, yesterday: 1, today: 2, week: 8, month: 24, quarter: 61 },
      { campaign: "Kalkulator ME", campaignKind: "calculator", postalCode: "80-001", latitude: 54.352, longitude: 18.6466, yesterday: 1, today: 1, week: 7, month: 19, quarter: 53 },
      { campaign: "Załatwione z roboty", campaignKind: "photo", postalCode: "50-001", latitude: 51.1079, longitude: 17.0385, yesterday: 2, today: 2, week: 6, month: 17, quarter: 45 },
      { campaign: "Lead doradcy", campaignKind: "advisor", postalCode: "20-001", latitude: 51.2465, longitude: 22.5684, yesterday: 0, today: 0, week: 3, month: 9, quarter: 28 },
    ],
  },
  ranking: demoRanking,
  rankingByPeriod: { yesterday: demoRanking, today: demoRanking, week: demoRanking, month: demoRanking, quarter: demoRanking },
  reliability: ["Dane demonstracyjne — wyłącznie do testu układu"],
};

const demoPage = createDefaultCommandCenterSnapshot().pages[0];

export default function CommandCenterDemo() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function resize() {
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-black">
      <div style={{ height: 1080, left: "50%", position: "absolute", top: "50%", transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center", width: 1920 }}>
        <CommandCenterCanvas
          dashboardName="Podgląd deweloperski"
          footer={<div className="flex w-full items-center justify-between text-[17px]"><span className="text-slate-400">Anonimowe dane demonstracyjne · podgląd dostępny tylko lokalnie</span><span className="flex items-center gap-3 text-slate-400">Ekran 1/2 <i className="h-2 w-2 rounded-full bg-emerald-400" /></span></div>}
          metrics={demoMetrics}
          now={new Date("2026-09-10T10:30:00+02:00")}
          page={demoPage}
          theme="dark"
        />
      </div>
    </main>
  );
}
