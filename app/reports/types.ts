export type PeriodPreset = "day" | "week" | "month" | "quarter" | "year" | "custom";

export type FinancialDetailType =
  | "allContracts"
  | "activeContracts"
  | "lostContracts"
  | "equipment"
  | "installation"
  | "commissions"
  | "guarantee"
  | "marketing"
  | "companyProfit"
  | "ownerProfit";

export type AdvisorDetailType =
  | "remoteContacts"
  | "phoneCalls"
  | "emails"
  | "savedOffers"
  | "sentOffers"
  | "meetingsScheduled"
  | "meetingsCompleted"
  | "sales"
  | "documentation";

export type MetricDetailType = FinancialDetailType | AdvisorDetailType;

export type MetricCard = {
  label: string;
  value: string;
  change?: string;
  changeTone?: "positive" | "negative" | "neutral";
  hint?: string;
  detailType?: MetricDetailType;
};

export type ActivityRow = {
  id?: string;
  client_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  user_id?: string | null;
  owner_id?: string | null;
  assigned_user_id?: string | null;
  activity_type?: string | null;
  type?: string | null;
  category?: string | null;
  phone_status?: string | null;
  contact_type?: string | null;
  contact_status?: string | null;
  status?: string | null;
  outcome?: string | null;
  result?: string | null;
  description?: string | null;
  note?: string | null;
  [key: string]: unknown;
};

export type CalendarEventRow = {
  id?: string;
  client_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  user_id?: string | null;
  owner_id?: string | null;
  assigned_user_id?: string | null;
  source_activity_id?: string | null;
  event_type?: string | null;
  status?: string | null;
  title?: string | null;
  event_at?: string | null;
  [key: string]: unknown;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
  manager_id?: string | null;
  [key: string]: unknown;
};

export type ClientRow = {
  id: string;
  full_name?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  public_id?: string | null;
  lead_id?: string | null;
  lead_public_id?: string | null;
  client_public_id?: string | null;
  [key: string]: unknown;
};

export type OfferRow = {
  id?: string;
  client_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  user_id?: string | null;
  seller_id?: string | null;
  owner_id?: string | null;
  assigned_user_id?: string | null;
  status?: string | null;
  sent_at?: string | null;
  email_sent_at?: string | null;
  mail_sent_at?: string | null;
  [key: string]: unknown;
};

export type FinancialSaleRow = {
  id: string;
  sale_public_id?: string | null;
  client_id?: string | null;
  public_id?: string | null;
  created_at?: string | null;
  sale_date?: string | null;
  date?: string | null;
  status?: string | null;
  seller_id?: string | null;
  created_by?: string | null;
  assigned_user_id?: string | null;
  user_id?: string | null;
  manager_id?: string | null;
  contract_value?: number | string | null;
  contract_value_gross?: number | string | null;
  total_gross?: number | string | null;
  final_gross?: number | string | null;
  gross_value?: number | string | null;
  total_net?: number | string | null;
  final_net?: number | string | null;
  equipment_cost?: number | string | null;
  equipment_cost_net?: number | string | null;
  installation_cost?: number | string | null;
  installation_cost_net?: number | string | null;
  seller_commission?: number | string | null;
  seller_commission_net?: number | string | null;
  seller_margin?: number | string | null;
  seller_markup_net?: number | string | null;
  manager_fee?: number | string | null;
  manager_fee_net?: number | string | null;
  warranty_fund?: number | string | null;
  warranty_fund_net?: number | string | null;
  guarantee_fund?: number | string | null;
  guarantee_fund_net?: number | string | null;
  marketing_cost?: number | string | null;
  marketing_cost_net?: number | string | null;
  marketing_fund?: number | string | null;
  owner_margin?: number | string | null;
  owner_margin_net?: number | string | null;
  company_margin?: number | string | null;
  company_margin_net?: number | string | null;
  offer_snapshot?: Record<string, unknown> | null;
  offer_data?: Record<string, unknown> | null;
  financial_data?: Record<string, unknown> | null;
  customer_data?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type FinancialSummary = {
  totalRevenueGross: number;
  revenueGross: number;
  lostRevenueGross: number;
  guaranteeFund: number;
  marketingFund: number;
  equipmentCost: number;
  equipmentCostGross: number;
  installationCost: number;
  installationCostGross: number;
  sellerCommissions: number;
  managerCommissions: number;
  companyProfit: number;
  ownerProfit: number;
  advisorCommissionForecast: number;
  advisorCommissionPayable: number;
  managerFeeForecast: number;
  managerFeePayable: number;
  managerOwnSalesCommissionForecast: number;
  managerOwnSalesCommissionPayable: number;
  salesCount: number;
  [key: string]: number;
};

export type FinancialDetailRow = {
  saleId: string;
  clientName: string;
  status: string;
  net: number;
  gross: number;
  description: string;
};

export type AdvisorDetailRow = {
  id: string;
  date: string;
  advisorName: string;
  clientId?: string | null;
  clientName: string;
  leadId: string;
  type: string;
  status: string;
  description: string;
};

export type CcUserSummary = {
  userId: string;
  name: string;
  phoneCalls: number;
  uniqueClientConversations: number;
  emails: number;
  sms: number;
  meetingsScheduled: number;
  conversionRate: number;
};

export type CcReportSummary = {
  phoneCalls: number;
  uniqueClientConversations: number;
  emails: number;
  sms: number;
  meetingsScheduled: number;
  noAnswer: number;
  callBackRequests: number;
  notInterested: number;
  conversionRate: number;
  users: CcUserSummary[];
};

export type AdvisorUserOption = {
  id: string;
  name: string;
  role: string;
};

export type ManagerTeamOption = {
  id: string;
  name: string;
  managerId: string;
  memberIds: string[];
};

export type AdvisorReportSummary = {
  remoteContacts: number;
  phoneCalls: number;
  emails: number;
  sms: number;
  savedOffers: number;
  sentOffers: number;
  meetingsScheduled: number;
  meetingsCompleted: number;
  salesCount: number;
  documentationCompleteness: number;
};

export type BoardReportSummary = {
  newLeads: number;
  meetings: number;
  offers: number;
  sales: number;
  revenueGross: number;
  conversionRate: number;
};

export type BoardAdvisorRankingRow = {
  advisorId: string;
  advisorName: string;
  remoteContacts: number;
  meetings: number;
  offers: number;
  sales: number;
  revenueGross: number;
  conversionRate: number;
};