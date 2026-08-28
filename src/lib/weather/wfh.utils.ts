export type WfhStatus = "PENDING" | "APPROVED" | "REJECTED";

export function wfhStatusLabel(s: WfhStatus): string {
  if (s === "PENDING") return "NA ČEKANJU";
  if (s === "APPROVED") return "ODOBRENO";
  return "ODBIJENO";
}

export function wfhBadgeClass(status: WfhStatus): string {
  if (status === "APPROVED") return "badge badge-present";
  if (status === "PENDING") return "badge badge-late";
  return "badge badge-absent";
}

export function isBadWeather(w: {
  tempMin: number | null;
  tempMax: number | null;
  precipSum: number | null;
  windMax: number | null;
  weatherCode: number | null;
}) {
  const temp = w.tempMin ?? 0;
  const precip = w.precipSum ?? 0;
  const wind = w.windMax ?? 0;
  const code = w.weatherCode ?? -1;

  const isCold = temp < 0;
  const isSnow = code >= 71 && code <= 77;
  const isThunder = code >= 95;
  const isHeavyRain = (code >= 61 && code <= 67) || (code >= 80 && code <= 82);
  const isHeat = (w.tempMax ?? 0) >= 33;

  return (
    isCold ||
    isThunder ||
    isSnow ||
    precip >= 8 ||
    wind >= 40 ||
    isHeavyRain ||
    isHeat
  );
}
