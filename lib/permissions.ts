export type UserRole =
  | "admin"
  | "owner"
  | "manager"
  | "seller"
  | "cc";

export function isAdmin(role: UserRole) {
  return ["admin", "owner"].includes(role);
}

export function canManageUsers(role: UserRole) {
  return ["admin", "owner"].includes(role);
}

export function canViewTeamCalendar(role: UserRole) {
  return ["admin", "owner", "manager"].includes(role);
}

export function canViewCompanySales(role: UserRole) {
  return ["admin", "owner", "manager"].includes(role);
}

export function canViewAllClients(role: UserRole) {
  return ["admin", "owner"].includes(role);
}

export function canViewTeamClients(role: UserRole) {
  return ["admin", "owner", "manager"].includes(role);
}

export function canManageSales(role: UserRole) {
  return ["admin", "owner", "manager"].includes(role);
}

export function canDeleteClients(role: UserRole) {
  return ["admin", "owner"].includes(role);
}

export function canAssignClients(role: UserRole) {
  return ["admin", "owner", "manager"].includes(role);
}

export function canManageOffers(role: UserRole) {
  return ["admin", "owner", "manager"].includes(role);
}