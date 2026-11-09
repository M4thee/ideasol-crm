export type ServiceLocation = {
  id: string;
  user_id: string;
  postal_code: string;
  places: string[];
  has_coordinates: boolean;
};

export type ServiceLocationUser = {
  id: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  hidden_from_assignment: boolean;
  ideasol: boolean;
  ideatermo: boolean;
  locations: ServiceLocation[];
};

export function normalizeServicePostalCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  if (!/^\d{2}-?\d{3}$/.test(code)) return null;
  const digits = code.replace("-", "");
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}
