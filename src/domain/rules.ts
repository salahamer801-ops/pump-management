/**
 * طبقة الحساب والقواعد — مصدر واحد لكل حساب في النظام.
 * لا تُكرَّر أي معادلة داخل الواجهات؛ كل الصفحات تستدعي من هنا.
 */
import type {
  ActualUsage,
  AppState,
  ConflictKind,
  DayEntry,
  DayIssueSeverity,
  DialaDay,
  Person,
  Pump,
  Shareholder,
  ShareRight,
  Transaction,
  TxKind,
  UsageType,
} from "./types";
import { uid } from "./util";
export type { DayIssueSeverity };

import {
  addDaysISO,
  clamp,
  durationMin,
  isOvernight,
  isoToShort,
  minutesToTime,
  nowTime,
  rawDurationMin,
  rangesOverlap,
  timeInterval,
  timeToMinutes,
  toHours,
  todayISO,
} from "./util";

/* ------------------------------- استعلامات ------------------------------ */

export function findPerson(state: AppState, id: string | null): Person | null {
  if (!id) return null;
  return state.persons.find((p) => p.id === id) ?? null;
}

export function personName(state: AppState, id: string | null): string {
  const p = findPerson(state, id);
  if (p) return p.name;
  return "—";
}

export function findShareholder(state: AppState, id: string | null): Shareholder | null {
  if (!id) return null;
  return state.shareholders.find((s) => s.id === id) ?? null;
}

export function activeShareholders(state: AppState, pumpId: string): Shareholder[] {
  return state.shareholders
    .filter((s) => s.pumpId === pumpId && !s.archived && s.status !== "ended")
    .sort((a, b) => a.baseOrder - b.baseOrder);
}

export function totalUnits(state: AppState, pumpId: string): number {
  return activeShareholders(state, pumpId).reduce((s, sh) => s + (sh.units || 0), 0);
}

export function shareholderOfPerson(
  state: AppState,
  pumpId: string,
  personId: string
): Shareholder | null {
  return (
    state.shareholders.find(
      (s) => s.pumpId === pumpId && s.personId === personId && !s.archived
    ) ?? null
  );
}

export function isShareholder(state: AppState, pumpId: string, personId: string): boolean {
  return !!shareholderOfPerson(state, pumpId, personId);
}

export function rightsOfShareholder(state: AppState, shareholderId: string): ShareRight[] {
  return state.rights
    .filter((r) => r.shareholderId === shareholderId)
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
}

/** السلسلة الكاملة للحق — لا يُحفظ اسم صاحب الحق فقط */
export function rightChain(state: AppState, shareholderId: string): ShareRight[] {
  return rightsOfShareholder(state, shareholderId);
}

export function currentRight(
  state: AppState,
  shareholderId: string,
  date = todayISO()
): ShareRight | null {
  const list = rightsOfShareholder(state, shareholderId).filter((r) => r.status === "active");
  const applicable = list.filter(
    (r) => r.startedAt <= date && (!r.endedAt || r.endedAt >= date)
  );
  if (applicable.length === 0) return null;
  return applicable[applicable.length - 1];
}

/** صاحب الحق الحالي للمساهم (أو المساهم نفسه إن لم يوجد حق) */
export function rightHolderId(state: AppState, sh: Shareholder, date = todayISO()): string {
  const right = currentRight(state, sh.id, date);
  return right ? right.holderPersonId : sh.personId;
}

export function personPumpRelations(
  state: AppState,
  pumpId: string,
  personId: string
): { label: string; tone: "green" | "amber" | "blue" | "gray" }[] {
  const tags: { label: string; tone: "green" | "amber" | "blue" | "gray" }[] = [];
  const sh = shareholderOfPerson(state, pumpId, personId);
  if (sh) tags.push({ label: "مساهم أساسي", tone: "green" });
  const rights = state.rights.filter(
    (r) => r.pumpId === pumpId && r.holderPersonId === personId
  );
  if (rights.some((r) => r.status === "active" && r.kind === "rent"))
    tags.push({ label: "مستأجر حالي", tone: "amber" });
  else if (rights.some((r) => r.status === "active"))
    tags.push({ label: "صاحب حق حالي", tone: "blue" });
  if (rights.some((r) => r.status === "ended"))
    tags.push({ label: "حق منتهٍ", tone: "gray" });
  const usages = state.usages.filter((u) => u.pumpId === pumpId && u.personId === personId);
  if (usages.length > 0) tags.push({ label: "مستخدم سابق", tone: "gray" });
  return tags;
}

export function hasPendingRightPlan(state: AppState, personId: string, pumpId: string): boolean {
  return state.rights.some(
    (r) => r.holderPersonId === personId && r.pumpId === pumpId && r.status === "active"
  );
}

/* --------------------------------- الأيام ------------------------------- */

export function pumpWindow(
  pump: Pump,
  day?: DialaDay | null
): { start: string; end: string; capacityMin: number } {
  const start = day?.workStart || pump.workStart || "06:00";
  const end = day?.workEnd || pump.workEnd || "18:00";
  return { start, end, capacityMin: durationMin(start, end) };
}

export function dayEntries(state: AppState, dayId: string): DayEntry[] {
  return state.entries
    .filter((e) => e.dayId === dayId && !e.archived)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function sortedDays(state: AppState): DialaDay[] {
  return state.days
    .filter((d) => !d.archived)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.dialaNumber - a.dialaNumber));
}

export function dayByDate(state: AppState, date: string): DialaDay | null {
  return (
    state.days.find((d) => !d.archived && d.date === date) ??
    null
  );
}

export function currentDialaDay(state: AppState): DialaDay | null {
  const today = todayISO();
  const exact = dayByDate(state, today);
  if (exact) return exact;
  const past = sortedDays(state).filter((d) => d.date < today);
  return past[0] ?? null;
}

export function nextDialaDay(state: AppState): DialaDay | null {
  const today = todayISO();
  const future = sortedDays(state)
    .filter((d) => d.date > today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return future[0] ?? null;
}

export function entryMinutes(entry: DayEntry): number {
  if (entry.plannedMin > 0 && !entry.startTime && !entry.endTime) return entry.plannedMin;
  if (!entry.startTime || !entry.endTime) return entry.plannedMin || 0;
  return durationMin(entry.startTime, entry.endTime);
}

/** الجدول الأساسي — مرجعي فقط، لا يتغير بتغير اليوم الفعلي */
export interface ScheduleRow {
  shareholder: Shareholder;
  person: Person | null;
  holderId: string;
  holderName: string;
  units: number;
  baseHoursMin: number;
  derivedHoursMin: number;
  order: number;
}

export function scheduleRows(state: AppState, pump: Pump): ScheduleRow[] {
  const list = activeShareholders(state, pump.id);
  const units = totalUnits(state, pump.id);
  const capacity = pumpWindow(pump).capacityMin;
  return list.map((s) => {
    const person = findPerson(state, s.personId);
    const holderId = rightHolderId(state, s);
    const derived =
      s.baseHoursMin > 0
        ? s.baseHoursMin
        : units > 0
          ? Math.round(capacity * (s.units / units))
          : 0;
    return {
      shareholder: s,
      person,
      holderId,
      holderName: personName(state, holderId),
      units: s.units,
      baseHoursMin: derived,
      derivedHoursMin: derived,
      order: s.baseOrder,
    };
  });
}

/** بناء صفوف اليوم من الجدول الأساسي (نقطة بداية قابلة للتعديل بالكامل) */
export function planEntriesFromSchedule(
  state: AppState,
  pump: Pump,
  workStart: string,
  workEnd: string
): Omit<DayEntry, "dayId">[] {
  const rows = scheduleRows(state, pump);
  const window = durationMin(workStart, workEnd);
  const units = rows.reduce((s, r) => s + r.units, 0) || 1;
  const base = timeToMinutes(workStart);
  let cursor = 0;
  return rows.map((row, i) => {
    const share = row.baseHoursMin > 0 ? row.baseHoursMin : Math.round(window * (row.units / units));
    const start = base + cursor;
    const end = base + cursor + share;
    cursor += share;
    const right = currentRight(state, row.shareholder.id);
    return {
      id: uid("en"),
      pumpId: pump.id,
      orderIndex: i,
      personId: row.holderId,
      role: right
        ? right.kind === "rent"
          ? "tenant"
          : "right_holder"
        : "shareholder",
      shareholderId: row.shareholder.id,
      rightId: right?.id ?? null,
      startTime: minutesToTime(start),
      endTime: minutesToTime(end),
      plannedMin: share,
      actualPersonId: null,
      usageId: null,
      status: "planned",
      postponeToDayId: null,
      reason: "",
      notes: "",
      createdAt: new Date().toISOString(),
      createdBy: "manager",
      archived: false,
    };
  });
}

/* -------------------------- الاقتراحات والبحث (§11) -------------------- */

export interface Suggestion {
  person: Person;
  tier: 1 | 2 | 3 | 4;
  tags: string[];
  lastSeen: string;
}

const TIER_LABEL: Record<number, string> = {
  1: "مساهم أساسي",
  2: "مرتبط بالمضخة",
  3: "سبق تسجيله",
  4: "شخص آخر",
};

export function tierLabel(tier: number): string {
  return TIER_LABEL[tier] ?? "";
}

export function suggestPeople(
  state: AppState,
  pumpId: string,
  query: string,
  limit = 40
): Suggestion[] {
  const q = query.trim();
  const map = new Map<string, Suggestion>();

  const push = (person: Person, tier: 1 | 2 | 3 | 4, tag: string, lastSeen: string) => {
    const existing = map.get(person.id);
    if (existing) {
      if (!existing.tags.includes(tag)) existing.tags.push(tag);
      if (tier < existing.tier) existing.tier = tier;
      if (lastSeen > existing.lastSeen) existing.lastSeen = lastSeen;
      return;
    }
    map.set(person.id, { person, tier, tags: [tag], lastSeen });
  };

  // الأولوية 1: المساهمون الأساسيون
  for (const sh of activeShareholders(state, pumpId)) {
    const p = findPerson(state, sh.personId);
    if (p) push(p, 1, "مساهم أساسي", sh.startDate || "");
  }

  // الأولوية 2: أصحاب الحقوق والمستأجرون والمستخدمون السابقون
  for (const r of state.rights.filter((r) => r.pumpId === pumpId)) {
    const p = findPerson(state, r.holderPersonId);
    if (!p) continue;
    push(p, 2, r.kind === "rent" ? "مستأجر" : "صاحب حق", r.startedAt || "");
  }
  for (const u of state.usages.filter((u) => u.pumpId === pumpId)) {
    const p = findPerson(state, u.personId);
    if (p) push(p, 2, "مستخدم سابق", u.date || "");
  }

  // الأولوية 3: من سبق تسجيله في أيام فعلية
  const pumpDays = new Set(state.days.filter((d) => d.pumpId === pumpId).map((d) => d.id));
  for (const e of state.entries) {
    if (!pumpDays.has(e.dayId)) continue;
    const p = findPerson(state, e.personId);
    if (p) push(p, 3, "سُجّل في يوم سابق", "");
    const a = findPerson(state, e.actualPersonId);
    if (a) push(a, 3, "استخدم سابقًا", "");
  }

  // الأولوية 4: بقية الأشخاص
  for (const p of state.persons) {
    if (!p.archived) push(p, 4, "شخص مسجّل", "");
  }

  let list = Array.from(map.values());
  if (q) {
    list = list.filter(
      (s) =>
        s.person.name.includes(q) ||
        (s.person.phone && s.person.phone.includes(q)) ||
        s.tags.some((t) => t.includes(q))
    );
  }
  list.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.person.name.localeCompare(b.person.name, "ar");
  });
  return list.slice(0, limit);
}

/* --------------------- كشف التعارضات والتحقق (§17-19,65) --------------- */

export type DayIssueKind =
  | ConflictKind
  | "outside_window"
  | "missing_time"
  | "no_person"
  | "empty_day";

export interface DayIssue {
  kind: DayIssueKind;
  severity: DayIssueSeverity;
  key: string;
  message: string;
  entryIds: string[];
}

export function isAcked(
  state: AppState,
  dayId: string | null,
  kind: ConflictKind,
  key: string
): boolean {
  return state.conflictAcks.some(
    (a) => a.kind === kind && a.key === key && (dayId ? a.dayId === dayId : true)
  );
}

export function dayIssues(state: AppState, day: DialaDay, pump: Pump): DayIssue[] {
  const issues: DayIssue[] = [];
  const entries = dayEntries(state, day.id);
  if (entries.length === 0) {
    issues.push({
      kind: "empty_day",
      severity: "warn",
      key: `empty-${day.id}`,
      message: "لا يوجد أي شخص في هذا اليوم بعد.",
      entryIds: [],
    });
  }

  const window = pumpWindow(pump, day);
  const anchor = timeToMinutes(window.start);
  const intervals = entries.map((e) => {
    const hasTimes = !!e.startTime && !!e.endTime;
    const span = hasTimes ? entryInterval(anchor, e.startTime, e.endTime, window.capacityMin) : null;
    return {
      entry: e,
      hasTimes,
      from: span ? span.from : 0,
      to: span ? span.to : 0,
    };
  });

  // تداخل غير مقصود — لا يُحذف أي سجل تلقائيًا
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i];
      const b = intervals[j];
      if (!a.hasTimes || !b.hasTimes) continue;
      const overlap = rangesOverlap({ from: a.from, to: a.to }, { from: b.from, to: b.to });
      if (overlap > 0) {
        const key = `overlap-${a.entry.id}-${b.entry.id}`;
        issues.push({
          kind: "overlap",
          severity: "warn",
          key,
          message: `تداخل في أوقات الاستخدام بين ${personName(state, a.entry.personId)} و${personName(
            state,
            b.entry.personId
          )} (${Math.round(overlap)} دقيقة).`,
          entryIds: [a.entry.id, b.entry.id],
        });
      }
    }
  }

  // تكرار غير مقصود لنفس الشخص (بنفس السهم) — لا يُحذف أي سجل
  const byPerson = new Map<string, DayEntry[]>();
  for (const e of entries) {
    if (!e.personId) continue;
    const list = byPerson.get(e.personId) ?? [];
    list.push(e);
    byPerson.set(e.personId, list);
  }
  for (const [personId, list] of byPerson) {
    if (list.length < 2) continue;
    const shares = new Set(list.map((e) => e.shareholderId ?? "none"));
    if (shares.size > 1) continue; // شخص يملك أكثر من سهم — ليس تكرارًا
    issues.push({
      kind: "duplicate",
      severity: "warn",
      key: `dup-${personId}`,
      message: `${personName(state, personId)} مسجَّل ${list.length} مرات في نفس اليوم.`,
      entryIds: list.map((e) => e.id),
    });
  }

  // خارج أوقات التشغيل
  for (const interval of intervals) {
    const e = interval.entry;
    if (!e.startTime) {
      issues.push({
        kind: "missing_time",
        severity: "error",
        key: `missing-${e.id}`,
        message: `${personName(state, e.personId)}: وقت البداية غير محدد.`,
        entryIds: [e.id],
      });
      continue;
    }
    if (interval.from < -1 || interval.to > window.capacityMin + 1) {
      issues.push({
        kind: "outside_window",
        severity: "warn",
        key: `outside-${e.id}`,
        message: `${personName(state, e.personId)}: الوقت خارج نافذة تشغيل المضخة (${window.start} → ${window.end}).`,
        entryIds: [e.id],
      });
    }
  }

  // تجاوز إجمالي ساعات التشغيل
  const total = entries
    .filter((e) => e.status !== "cancelled")
    .reduce((s, e) => s + entryMinutes(e), 0);
  if (total > window.capacityMin + 1) {
    issues.push({
      kind: "over_capacity",
      severity: "warn",
      key: `capacity-${day.id}`,
      message: `مجموع الساعات ${Math.round(total / 60 * 10) / 10} ساعة يتجاوز ساعات تشغيل المضخة (${Math.round(
        window.capacityMin / 60 * 10
      ) / 10} ساعة) بمقدار ${Math.round((total - window.capacityMin) / 60 * 10) / 10} ساعة.`,
      entryIds: [],
    });
  }

  return issues;
}

/**
 * موضع الفترة داخل نافذة تشغيل المضخة بالدقائق (يدعم عبور منتصف الليل):
 * الفترة التي تبدأ بعد منتصف الليل داخل نافذة تنتهي في اليوم التالي تُحسب في نهايتها الصحيحة.
 */
export function entryInterval(
  anchorMin: number,
  start: string,
  end: string,
  capacityMin: number
): { from: number; to: number; minutes: number } {
  const minutes = durationMin(start, end);
  const base = timeToMinutes(start) - anchorMin;
  const candidates = [base, base + 1440, base - 1440];
  const fit = candidates.find((c) => c >= -1 && c + minutes <= capacityMin + 1);
  const from = fit !== undefined ? fit : base < 0 ? base + 1440 : base;
  return { from, to: from + minutes, minutes };
}

export function openIssues(state: AppState, day: DialaDay, pump: Pump): DayIssue[] {
  return dayIssues(state, day, pump).filter((i) => !isAcked(state, day.id, i.kind as ConflictKind, i.key));
}

/* ------------------------------ ملخص اليوم ----------------------------- */

export interface DaySummary {
  dayId: string;
  persons: number;
  plannedMin: number;
  usageMin: number;
  capacityMin: number;
  remainingMin: number;
  overMin: number;
  liters: number;
  fuelAmount: number;
  royaltyAmount: number;
  usageAmount: number;
  stoppageMin: number;
  issues: number;
}

export function daySummary(state: AppState, day: DialaDay, pump: Pump): DaySummary {
  const entries = dayEntries(state, day.id).filter((e) => e.status !== "cancelled");
  const usages = state.usages.filter((u) => u.dayId === day.id && u.status === "active");
  const window = pumpWindow(pump, day);
  const plannedMin = entries.reduce((s, e) => s + entryMinutes(e), 0);
  const usageMin = usages.reduce((s, u) => s + u.minutes, 0);
  const liters = usages.reduce((s, u) => s + u.fuelLiters, 0);
  const fuelAmount = usages.reduce((s, u) => s + u.fuelAmountDue, 0);
  const royaltyAmount = usages.reduce((s, u) => s + u.royaltyAmountDue, 0);
  const stoppageMin = state.stoppages
    .filter((s) => s.dayId === day.id && !s.archived)
    .reduce((s, st) => s + st.minutes, 0);
  const effective = plannedMin > 0 ? plannedMin : usageMin;
  return {
    dayId: day.id,
    persons: entries.length,
    plannedMin,
    usageMin,
    capacityMin: window.capacityMin,
    remainingMin: Math.max(0, window.capacityMin - effective),
    overMin: Math.max(0, effective - window.capacityMin),
    liters: Math.round(liters * 10) / 10,
    fuelAmount: Math.round(fuelAmount),
    royaltyAmount: Math.round(royaltyAmount),
    usageAmount: Math.round(fuelAmount + royaltyAmount),
    stoppageMin,
    issues: openIssues(state, day, pump).length,
  };
}

/* --------------------------- الاستخدام الفعلي (§17,22) ------------------ */

export interface UsageDraft {
  minutes: number;
  crossesMidnight: boolean;
  fuelPerHourSnapshot: number;
  fuelLiters: number;
  fuelPriceSnapshot: number;
  fuelAmountDue: number;
  royaltyHourlySnapshot: number;
  royaltyAmountDue: number;
}

export function computeUsageDraft(
  pump: Pump,
  day: DialaDay,
  startTime: string,
  endTime: string,
  royaltyProrate = true
): UsageDraft {
  const minutes = durationMin(startTime, endTime);
  const window = pumpWindow(pump, day);
  const hours = toHours(minutes);
  const liters =
    pump.energyType === "solar"
      ? 0
      : pump.fuelCalcMode === "cycle"
        ? window.capacityMin > 0
          ? Math.round(pump.fuelPerCycle * (minutes / window.capacityMin) * 100) / 100
          : 0
        : Math.round(hours * pump.fuelConsumptionPerHour * 100) / 100;
  const fuelPrice = pump.fuelPrice || 0;
  const royalty =
    !pump.royaltyEnabled
      ? 0
      : pump.royaltyMode === "hour"
        ? Math.round(hours * pump.royaltyPerHour)
        : royaltyProrate && window.capacityMin > 0
          ? Math.round(pump.royaltyPerCycle * (minutes / window.capacityMin))
          : 0;
  return {
    minutes,
    crossesMidnight: isOvernight(startTime, endTime),
    fuelPerHourSnapshot: pump.fuelConsumptionPerHour,
    fuelLiters: liters,
    fuelPriceSnapshot: fuelPrice,
    fuelAmountDue: Math.round(liters * fuelPrice),
    royaltyHourlySnapshot: pump.royaltyMode === "hour" ? pump.royaltyPerHour : pump.royaltyPerCycle,
    royaltyAmountDue: royalty,
  };
}

export function usageTypeLabel(t: UsageType): string {
  switch (t) {
    case "share":
      return "حصة أساسية";
    case "rental":
      return "تأجير";
    case "loan":
      return "إعارة";
    case "purchase":
      return "شراء ساعات";
    case "extra":
      return "ساعات إضافية";
    default:
      return "ضيف";
  }
}

/* ------------------------------- المالية (§27) ------------------------- */

export function txSignedAmount(t: Transaction): number {
  return t.direction === "debit" ? t.amount : -t.amount;
}

export function personTransactions(state: AppState, personId: string): Transaction[] {
  return state.transactions
    .filter((t) => t.personId === personId && t.status === "posted")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt < a.createdAt ? 1 : -1));
}

export interface PersonBalance {
  personId: string;
  debit: number;
  credit: number;
  balance: number;
  byKind: Record<string, { debit: number; credit: number }>;
}

export function personBalance(state: AppState, personId: string): PersonBalance {
  const byKind: Record<string, { debit: number; credit: number }> = {};
  let debit = 0;
  let credit = 0;
  for (const t of personTransactions(state, personId)) {
    const bucket = (byKind[t.kind] ??= { debit: 0, credit: 0 });
    if (t.direction === "debit") {
      debit += t.amount;
      bucket.debit += t.amount;
    } else {
      credit += t.amount;
      bucket.credit += t.amount;
    }
  }
  return { personId, debit, credit, balance: debit - credit, byKind };
}

export function debtors(state: AppState): PersonBalance[] {
  return state.persons
    .filter((p) => !p.archived)
    .map((p) => personBalance(state, p.id))
    .filter((b) => b.balance > 0)
    .sort((a, b) => b.balance - a.balance);
}

export function txKindLabel(kind: TxKind): string {
  switch (kind) {
    case "fuel":
      return "ديزل";
    case "royalty":
      return "رواسة";
    case "payment":
      return "دفعة";
    case "debt":
      return "دين";
    case "loan":
      return "سلفة";
    case "advance":
      return "ساعات مقدمة";
    case "postpone_fee":
      return "أجر تأجيل";
    case "operators":
      return "أجور الرواسة";
    case "correction":
      return "تصحيح";
    default:
      return "أخرى";
  }
}

export interface PumpFinancials {
  charging: number;
  collected: number;
  outstanding: number;
  fuelCharged: number;
  royaltyCharged: number;
  operatorDue: number;
  operatorPaid: number;
  fuelLiters: number;
  fuelShortage: number;
}

export function pumpFinancials(state: AppState, from?: string, to?: string): PumpFinancials {
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  let charging = 0;
  let collected = 0;
  let fuelCharged = 0;
  let royaltyCharged = 0;
  for (const t of state.transactions) {
    if (t.status !== "posted" || !inRange(t.date)) continue;
    if (t.direction === "debit") {
      charging += t.amount;
      if (t.kind === "fuel") fuelCharged += t.amount;
      if (t.kind === "royalty") royaltyCharged += t.amount;
    } else {
      collected += t.amount;
    }
  }
  let operatorDue = 0;
  for (const r of state.operatorRecords.filter((r) => !r.archived && inRange(r.date))) {
    operatorDue += r.dueAmount;
  }
  const records = state.fuelRecords.filter((r) => !r.archived && inRange(r.date));
  return {
    charging,
    collected,
    outstanding: charging - collected,
    fuelCharged,
    royaltyCharged,
    operatorDue,
    operatorPaid: state.transactions
      .filter((t) => t.status === "posted" && t.kind === "operators" && inRange(t.date))
      .reduce((s, t) => s + t.amount, 0),
    fuelLiters: Math.round(records.reduce((s, r) => s + r.liters, 0) * 10) / 10,
    fuelShortage: Math.round(records.reduce((s, r) => s + r.shortageLiters, 0) * 10) / 10,
  };
}

export function operatorPaidFor(state: AppState, operatorRecordId: string): number {
  return state.transactions
    .filter(
      (t) =>
        t.operatorRecordId === operatorRecordId && t.status === "posted"
    )
    .reduce((s, t) => s + t.amount, 0);
}

/* ------------------- السجل الرسمي مقابل السجل الشخصي (§31-33) ---------- */

export interface CompareRow {
  date: string;
  dayId: string | null;
  dayLabel: string;
  officialMinutes: number;
  personalMinutes: number;
  minutesDiff: number;
  officialAmount: number;
  personalAmount: number;
  amountDiff: number;
  status: "matched" | "different" | "personal_only" | "official_only" | "settled";
}

export interface PersonComparison {
  rows: CompareRow[];
  officialMinutes: number;
  personalMinutes: number;
  officialAmount: number;
  personalAmount: number;
  differences: number;
}

export function officialAmountForUsage(u: ActualUsage): number {
  return u.fuelAmountDue + u.royaltyAmountDue;
}

/** ما سجّله المسؤول عن هذا الشخص في يوم معيّن */
export function officialForDay(
  state: AppState,
  day: DialaDay,
  personId: string
): { minutes: number; amount: number; usageIds: string[] } {
  const usages = state.usages.filter(
    (u) => u.dayId === day.id && u.personId === personId && u.status === "active"
  );
  if (usages.length > 0) {
    return {
      minutes: usages.reduce((s, u) => s + u.minutes, 0),
      amount: usages.reduce((s, u) => s + officialAmountForUsage(u), 0),
      usageIds: usages.map((u) => u.id),
    };
  }
  if (day.status === "completed" || day.status === "closed" || day.status === "revised") {
    const entries = dayEntries(state, day.id).filter(
      (e) =>
        (e.actualPersonId ?? e.personId) === personId && e.status !== "cancelled"
    );
    return {
      minutes: entries.reduce((s, e) => s + entryMinutes(e), 0),
      amount: 0,
      usageIds: [],
    };
  }
  return { minutes: 0, amount: 0, usageIds: [] };
}

export function comparePerson(
  state: AppState,
  personId: string
): PersonComparison {
  const personal = state.personalRecords.filter((r) => r.personId === personId);
  const days = state.days.filter((d) => !d.archived);
  const dates = Array.from(
    new Set<string>([...days.map((d) => d.date), ...personal.map((r) => r.date)])
  ).sort((a, b) => (a < b ? 1 : -1));

  const rows: CompareRow[] = [];
  const settlementFor = (_date: string, dayId: string | null) =>
    dayId
      ? state.settlements.find((s) => s.personId === personId && s.dayId === dayId)
      : undefined;

  for (const date of dates) {
    const day = days.find((d) => d.date === date) ?? null;
    const official = day
      ? officialForDay(state, day, personId)
      : { minutes: 0, amount: 0, usageIds: [] };
    const mine = personal.filter((r) => r.date === date);
    const personalMinutes = mine.reduce((s, r) => s + r.minutes, 0);
    const personalAmount = mine.reduce((s, r) => s + r.dieselAmount + r.royaltyAmount, 0);
    if (official.minutes === 0 && personalMinutes === 0 && personalAmount === 0) continue;
    const minutesDiff = official.minutes - personalMinutes;
    const amountDiff = official.amount - personalAmount;
    let status: CompareRow["status"] = "matched";
    if (official.minutes > 0 && personalMinutes === 0) status = "official_only";
    else if (personalMinutes > 0 && official.minutes === 0) status = "personal_only";
    else if (minutesDiff !== 0 || amountDiff !== 0) status = "different";
    const settled = settlementFor(date, day?.id ?? null);
    if (settled) status = "settled";
    rows.push({
      date,
      dayId: day?.id ?? null,
      dayLabel: isoToShort(date),
      officialMinutes: official.minutes,
      personalMinutes,
      minutesDiff,
      officialAmount: official.amount,
      personalAmount,
      amountDiff,
      status,
    });
  }

  return {
    rows,
    officialMinutes: rows.reduce((s, r) => s + r.officialMinutes, 0),
    personalMinutes: rows.reduce((s, r) => s + r.personalMinutes, 0),
    officialAmount: rows.reduce((s, r) => s + r.officialAmount, 0),
    personalAmount: rows.reduce((s, r) => s + r.personalAmount, 0),
    differences: rows.filter((r) => r.status === "different" || r.status === "official_only" || r.status === "personal_only")
      .length,
  };
}

export function matchStatusLabel(s: CompareRow["status"]): string {
  switch (s) {
    case "matched":
      return "مطابق";
    case "different":
      return "مختلف";
    case "personal_only":
      return "شخصي فقط";
    case "official_only":
      return "رسمي فقط";
    case "settled":
      return "تمت التسوية";
    default:
      return "قيد المراجعة";
  }
}

/* ----------------------- دور الشخص: الحالي والقادم --------------------- */

export interface PersonTurnInfo {
  day: DialaDay;
  entry: DayEntry;
  isCurrent: boolean;
}

export function personTurns(state: AppState, personId: string): PersonTurnInfo[] {
  const list: PersonTurnInfo[] = [];
  for (const day of sortedDays(state)) {
    for (const entry of dayEntries(state, day.id)) {
      const owner = entry.actualPersonId ?? entry.personId;
      if (owner === personId || entry.personId === personId) {
        list.push({ day, entry, isCurrent: day.date === todayISO() });
      }
    }
  }
  return list;
}

export function personCurrentTurn(state: AppState, personId: string): PersonTurnInfo | null {
  const now = nowTime();
  const today = todayISO();
  const turns = personTurns(state, personId);
  const todayTurn = turns.find((t) => t.day.date === today && t.entry.status !== "cancelled");
  if (todayTurn) return todayTurn;
  const timeNow = timeToMinutes(now);
  const live = turns.find(
    (t) =>
      t.day.date === today &&
      t.entry.status !== "cancelled" &&
      t.entry.startTime &&
      timeToMinutes(t.entry.startTime) <= timeNow &&
      timeNow < timeToMinutes(t.entry.startTime) + entryMinutes(t.entry)
  );
  return live ?? null;
}

export function personNextTurn(state: AppState, personId: string): PersonTurnInfo | null {
  const today = todayISO();
  const future = personTurns(state, personId)
    .filter((t) => t.day.date > today && t.entry.status !== "cancelled")
    .sort((a, b) => (a.day.date < b.day.date ? -1 : 1));
  return future[0] ?? null;
}

export function remainingMinutesForEntry(entry: DayEntry): number {
  if (entry.status === "done") return 0;
  const minutes = entryMinutes(entry);
  if (entry.startTime) {
    const elapsed = durationMin(entry.startTime, nowTime());
    return Math.max(0, minutes - elapsed);
  }
  return minutes;
}

/* -------------------------------- إشعارات ------------------------------ */

export function unreadNotifications(state: AppState) {
  return state.notifications.filter((n) => !n.read);
}

export function notificationTone(level: "info" | "warn" | "danger") {
  return level === "danger" ? "red" : level === "warn" ? "amber" : "blue";
}

/* --------------------------- تقارير ومساعدات --------------------------- */

export function groupBy<T>(list: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}

export function formatHoursLabel(min: number): string {
  return `${toHours(min)} س`;
}

export function dayCapacity(min: number, total: number): number {
  return clamp(Math.round((min / (total || 1)) * 100), 0, 100);
}

export function isoRangeDays(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  let cur = fromISO;
  let guard = 0;
  while (cur <= toISO && guard < 400) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
    guard += 1;
  }
  return out;
}

export { rawDurationMin, timeInterval };
