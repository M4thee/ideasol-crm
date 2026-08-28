export type EquipmentVoltageType = "low_voltage" | "high_voltage";

type EquipmentIdentity = {
  code?: string | null;
  name?: string | null;
  displayName?: string | null;
  display_name?: string | null;
};

export type CompatibleStorage = EquipmentIdentity & {
  voltageType?: EquipmentVoltageType | null;
  voltage_type?: EquipmentVoltageType | null;
};

export type CompatibleInverter = EquipmentIdentity & {
  type?: string | null;
  batteryVoltageType?: EquipmentVoltageType | null;
  battery_voltage_type?: EquipmentVoltageType | null;
  maxPvKw?: number | null;
  max_pv_kw?: number | null;
};

function getSearchableEquipmentName(item: EquipmentIdentity) {
  return [item.code, item.name, item.displayName, item.display_name]
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getEquipmentBrand(item: EquipmentIdentity) {
  const searchableName = getSearchableEquipmentName(item);
  const compactName = searchableName.replace(/[^a-z0-9]+/g, "");

  // W katalogu zdarza się też literówka „EcooBSS”. Obie wersje oznaczają ten sam zestaw.
  if (compactName.includes("ecobss") || compactName.includes("ecoobss")) return "ecobss";
  if (compactName.includes("deye")) return "deye";
  if (compactName.includes("foxess")) return "foxess";
  if (compactName.includes("sigen")) return "sigenergy";
  if (compactName.includes("sigenergy")) return "sigenergy";

  return null;
}

export function getExplicitStorageVoltageType(storage?: CompatibleStorage | null) {
  return storage?.voltage_type || storage?.voltageType || null;
}

export function getExplicitInverterVoltageType(inverter?: CompatibleInverter | null) {
  return inverter?.battery_voltage_type || inverter?.batteryVoltageType || null;
}

export function getInverterMaxPvKw(inverter: CompatibleInverter) {
  return Number(inverter.max_pv_kw ?? inverter.maxPvKw ?? 0);
}

export function isInverterCompatibleWithStorage(
  inverter: CompatibleInverter,
  storage: CompatibleStorage
) {
  const storageVoltageType = getExplicitStorageVoltageType(storage);
  const inverterVoltageType = getExplicitInverterVoltageType(inverter);

  return Boolean(
    storageVoltageType &&
    inverterVoltageType &&
    inverter.type === "hybrid" &&
    inverterVoltageType === storageVoltageType
  );
}

export function rankInvertersForStorage<T extends CompatibleInverter>(
  inverters: T[],
  storage: CompatibleStorage
) {
  const storageBrand = getEquipmentBrand(storage);

  return inverters
    .filter((inverter) => isInverterCompatibleWithStorage(inverter, storage))
    .filter(
      (inverter, index, compatibleInverters) =>
        compatibleInverters.findIndex((candidate) => candidate.name === inverter.name) === index
    )
    .sort((first, second) => {
      const firstMatchesStorageBrand = Boolean(
        storageBrand && getEquipmentBrand(first) === storageBrand
      );
      const secondMatchesStorageBrand = Boolean(
        storageBrand && getEquipmentBrand(second) === storageBrand
      );

      if (firstMatchesStorageBrand !== secondMatchesStorageBrand) {
        return firstMatchesStorageBrand ? -1 : 1;
      }

      return getInverterMaxPvKw(first) - getInverterMaxPvKw(second);
    });
}
