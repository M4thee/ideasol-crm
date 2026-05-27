

import type { CurrentProfile } from "./getCurrentProfile";

export function isAdmin(profile: CurrentProfile | null) {
  return profile?.role === "admin";
}

export function isOwner(profile: CurrentProfile | null) {
  return profile?.role === "owner";
}

export function isManager(profile: CurrentProfile | null) {
  return profile?.role === "manager";
}

export function isSeller(profile: CurrentProfile | null) {
  return profile?.role === "seller";
}

export function isCC(profile: CurrentProfile | null) {
  return profile?.role === "cc";
}

export function canManageUsers(profile: CurrentProfile | null) {
  return isAdmin(profile);
}

export function canViewAllData(profile: CurrentProfile | null) {
  return isAdmin(profile) || isOwner(profile);
}

export function canViewFinancialDetails(
  profile: CurrentProfile | null
) {
  return isAdmin(profile) || isOwner(profile);
}

export function canViewManagerFinancials(
  profile: CurrentProfile | null
) {
  return isManager(profile);
}

export function canManageSales(profile: CurrentProfile | null) {
  return (
    isAdmin(profile) ||
    isOwner(profile) ||
    isManager(profile)
  );
}

export function canAssignClients(profile: CurrentProfile | null) {
  return (
    isAdmin(profile) ||
    isOwner(profile) ||
    isManager(profile)
  );
}

export function canAccessAdminPanel(
  profile: CurrentProfile | null
) {
  return isAdmin(profile);
}