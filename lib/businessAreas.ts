export const BUSINESS_AREAS = ["ideasol", "ideatermo"] as const;

export type BusinessArea = (typeof BUSINESS_AREAS)[number];

export type BusinessAreaPermissions = {
  ideasol: boolean;
  ideatermo: boolean;
};

export type BusinessAreaAssignmentAccess = {
  ideasol_access?: boolean | null;
  ideatermo_access?: boolean | null;
};

export const DEFAULT_BUSINESS_AREA_PERMISSIONS: BusinessAreaPermissions = {
  ideasol: true,
  ideatermo: false,
};

export function normalizeBusinessArea(value: unknown): BusinessArea {
  return value === "ideatermo" ? "ideatermo" : "ideasol";
}

export function hasBusinessAreaAccess(
  permissions: BusinessAreaPermissions,
  area: BusinessArea
) {
  return area === "ideatermo" ? permissions.ideatermo : permissions.ideasol;
}

export function canAssignUserToBusinessArea(
  user: BusinessAreaAssignmentAccess,
  area: BusinessArea
) {
  return area === "ideatermo"
    ? user.ideatermo_access === true
    : user.ideasol_access === true;
}

export function getDefaultBusinessArea(
  permissions: BusinessAreaPermissions
): BusinessArea | null {
  if (permissions.ideasol) return "ideasol";
  if (permissions.ideatermo) return "ideatermo";
  return null;
}

export function getBusinessAreaLabel(area: BusinessArea) {
  return area === "ideatermo" ? "IdeaTermo" : "IdeaSol";
}

export function canUsePvSalesModules(permissions: BusinessAreaPermissions) {
  return permissions.ideasol;
}

export function canUsePreaudit(permissions: BusinessAreaPermissions) {
  return permissions.ideatermo;
}
