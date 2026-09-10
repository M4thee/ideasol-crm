export const COMMAND_CENTER_SCHEMA_VERSION = 1 as const;

export type CommandCenterTheme = "light" | "dark" | "auto";

export type CommandCenterWidgetKind =
  | "leads-kpi"
  | "sales-kpi"
  | "sales-value"
  | "lead-funnel"
  | "lead-sources"
  | "lead-statuses"
  | "advisor-ranking"
  | "meetings-today"
  | "monthly-target"
  | "status-ticker";

export type CommandCenterPeriod = "today" | "week" | "month";

export type CommandCenterWidget = {
  id: string;
  kind: CommandCenterWidgetKind;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: {
    period?: CommandCenterPeriod;
    targetAmount?: number;
    rankingMetric?: "sales" | "salesValue" | "contactRate" | "conversion";
    limit?: number;
  };
};

export type CommandCenterPage = {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  rotationSeconds: number;
  widgets: CommandCenterWidget[];
};

export type CommandCenterSnapshot = {
  schemaVersion: typeof COMMAND_CENTER_SCHEMA_VERSION;
  pages: CommandCenterPage[];
};

export type CommandCenterDashboardRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  default_rotation_seconds: number;
  draft_snapshot: CommandCenterSnapshot;
  published_version_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandCenterDeviceRow = {
  id: string;
  name: string;
  platform: "browser" | "android_tv" | "google_tv" | "apple_tv" | "fire_tv" | "other";
  dashboard_id: string | null;
  theme: CommandCenterTheme;
  timezone: string;
  auto_dark_from: number;
  auto_light_from: number;
  radio_station_id: string | null;
  radio_volume: number;
  radio_autoplay: boolean;
  is_online?: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CommandCenterRadioStationRow = {
  id: string;
  name: string;
  stream_url: string;
  homepage_url: string | null;
  is_active: boolean;
  sort_order: number;
};

export type CommandCenterRankingRow = {
  advisorId: string;
  advisorName: string;
  leads: number;
  contactedLeads: number;
  contactRate: number;
  sales: number;
  salesValue: number;
  conversion: number;
};

export type CommandCenterMetrics = {
  generatedAt: string;
  leads: {
    today: number;
    week: number;
    month: number;
    contactedMonth: number;
    contactRateMonth: number;
    averageFirstActivityMinutes: number | null;
    sources: Array<{ label: string; value: number }>;
    statuses: Array<{ label: string; value: number }>;
  };
  sales: {
    today: number;
    week: number;
    month: number;
    valueToday: number;
    valueWeek: number;
    valueMonth: number;
  };
  funnel: {
    leads: number;
    contacted: number;
    meetings: number;
    offers: number;
    sales: number;
  };
  meetings: {
    today: number;
    upcomingToday: number;
  };
  ranking: CommandCenterRankingRow[];
  reliability: string[];
};

export type CommandCenterDevicePayload = {
  device: CommandCenterDeviceRow;
  dashboard: {
    id: string;
    name: string;
    defaultRotationSeconds: number;
    versionId: string;
    versionNumber: number;
    publishedAt: string;
  };
  snapshot: CommandCenterSnapshot;
  metrics: CommandCenterMetrics;
  radioStation: CommandCenterRadioStationRow | null;
};
