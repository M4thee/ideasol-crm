const WARSAW_TIME_ZONE = "Europe/Warsaw";

export function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidTimeOnly(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return Boolean(match);
}

function timeZoneOffsetMilliseconds(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return representedAsUtc - instant.getTime();
}

export function polishLocalDateTimeToIso(dateValue: string, timeValue: string) {
  if (!isValidDateOnly(dateValue) || !isValidTimeOnly(timeValue)) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = new Date(localAsUtc);

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const offset = timeZoneOffsetMilliseconds(instant, WARSAW_TIME_ZONE);
    instant = new Date(localAsUtc - offset);
  }

  const roundTrip = new Intl.DateTimeFormat("sv-SE", {
    timeZone: WARSAW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);

  if (roundTrip !== `${dateValue} ${timeValue}`) return null;
  return instant.toISOString();
}
