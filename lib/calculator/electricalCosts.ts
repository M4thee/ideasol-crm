export function isValidStorageOnlyElectricalCosts(costs: {
  storageOnlyProtections?: unknown;
  storageOnlyWiring?: unknown;
}) {
  return [costs.storageOnlyProtections, costs.storageOnlyWiring].every(
    (value) => typeof value === "number" && Number.isFinite(value) && value >= 0
  );
}

export function resolveElectricalCosts(input: {
  storageOnly: boolean;
  protections: number;
  wiring: number;
  storageOnlyProtections?: number | null;
  storageOnlyWiring?: number | null;
}) {
  // Older settings retain their own existing prices until the migration is applied.
  const protections = Number(input.storageOnly
    ? input.storageOnlyProtections ?? input.protections
    : input.protections);
  const wiring = Number(input.storageOnly
    ? input.storageOnlyWiring ?? input.wiring
    : input.wiring);

  if (input.storageOnly && !isValidStorageOnlyElectricalCosts({
    storageOnlyProtections: protections,
    storageOnlyWiring: wiring,
  })) {
    throw new Error("Nieprawidłowe stawki okablowania lub zabezpieczeń dla samego ME. Sprawdź ustawienia kalkulatora.");
  }

  return { protections, wiring };
}
