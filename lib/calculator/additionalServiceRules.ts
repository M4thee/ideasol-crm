export function isPmeApplicationServiceName(name: string) {
  const normalizedName = name
    .trim()
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    (normalizedName.includes("pme") ||
      normalizedName.includes("przydomowe magazyny energii")) &&
    (normalizedName.includes("wniosk") || normalizedName.includes("dotac"))
  );
}
