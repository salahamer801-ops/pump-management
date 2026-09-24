import type { Contributor, Cycle, PumpSettings, Turn } from "./types";

export function uid(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  );
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(min: number): string {
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Duration between a start and end time, handling overnight shifts. */
export function workDurationMin(start: string, end: string): number {
  let d = timeToMinutes(end) - timeToMinutes(start);
  if (d <= 0) d += 24 * 60;
  return d;
}

export function formatDuration(min: number): string {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0 && m === 0) return "0";
  if (h === 0) return `${m} دقيقة`;
  if (m === 0) return `${h} ساعة`;
  return `${h} س ${m} د`;
}

export function shareFraction(shares: number, totalShares: number): number {
  if (totalShares <= 0) return 0;
  return shares / totalShares;
}

export function contributorHoursMin(
  c: Contributor,
  pump: PumpSettings,
  totalShares: number
): number {
  return Math.round(
    workDurationMin(pump.workStart, pump.workEnd) *
      shareFraction(c.shares, totalShares)
  );
}

export function royaltyDueFor(
  c: Contributor,
  pump: PumpSettings,
  totalShares: number,
  durationMin: number
): number {
  if (!pump.hasRoyalty || totalShares <= 0) return 0;
  if (pump.royaltyMode === "cycle") {
    return roundMoney(shareFraction(c.shares, totalShares) * pump.royaltyPerCycle);
  }
  return roundMoney((durationMin / 60) * pump.royaltyPerHour);
}

export function fuelDueFor(
  c: Contributor,
  pump: PumpSettings,
  totalShares: number,
  durationMin: number
): number {
  if (pump.energyType === "solar" || totalShares <= 0) return 0;
  if (pump.fuelCalcMode === "cycle") {
    return roundMoney(
      shareFraction(c.shares, totalShares) * pump.fuelPerCycle * pump.fuelPrice
    );
  }
  return roundMoney(
    (durationMin / 60) * pump.fuelConsumptionPerHour * pump.fuelPrice
  );
}

export function roundMoney(n: number): number {
  return Math.round(n);
}

export function buildCycle(
  pump: PumpSettings,
  contributors: Contributor[],
  number: number
): Cycle {
  const active = contributors.filter((c) => !c.archived);
  const totalShares = active.reduce((s, c) => s + c.shares, 0);
  const totalDurationMin = workDurationMin(pump.workStart, pump.workEnd);
  const id = uid();
  let cursor = timeToMinutes(pump.workStart);

  const turns: Turn[] = active.map((c, i) => {
    const durationMin =
      totalShares > 0
        ? Math.round(totalDurationMin * shareFraction(c.shares, totalShares))
        : 0;
    const plannedStart = minutesToTime(cursor);
    const plannedEnd = minutesToTime(cursor + durationMin);
    cursor += durationMin;
    return {
      id: uid(),
      cycleId: id,
      contributorId: c.id,
      order: i,
      durationMin,
      plannedStart,
      plannedEnd,
      actualStart: "",
      actualEnd: "",
      fuelDue: fuelDueFor(c, pump, totalShares, durationMin),
      fuelPaid: 0,
      fuelPaidDate: "",
      royaltyDue: royaltyDueFor(c, pump, totalShares, durationMin),
      royaltyPaid: 0,
      royaltyPaidDate: "",
      note: "",
      status: "waiting",
    };
  });

  return {
    id,
    number,
    createdAt: new Date().toISOString(),
    workStart: pump.workStart,
    workEnd: pump.workEnd,
    totalShares,
    totalDurationMin,
    fuelPriceSnapshot: pump.fuelPrice,
    royaltySnapshot: pump.hasRoyalty ? pump.royaltyPerCycle : 0,
    turns,
    archived: false,
  };
}
