export const BUSINESS_AREAS = ["ideasol", "ideatermo"] as const;

export type BusinessArea = (typeof BUSINESS_AREAS)[number];

export type BusinessAreaPermissions = {
  ideasol: boolean;
  ideatermo: boolean;
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
