export type Client = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  contact_person?: string | null;
  nip?: string | null;
  phone: string | null;
  email?: string | null;
  street?: string | null;
  building_number?: string | null;
  postal_code?: string | null;
  city: string | null;
  client_type: string | null;
  status: string | null;
};
