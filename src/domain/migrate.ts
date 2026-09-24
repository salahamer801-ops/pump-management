/**
 * الترحيل من الإصدار القديم (v1) إلى النموذج الجديد (v2)
 * + بيانات تجريبية تغطي حالات النظام الحقيقية.
 * قاعدة: لا نحذف بيانات حقيقية — كل ما كان موجودًا يُنقل كسجل تاريخي.
 */
import type {
  ActualUsage,
  AppState,
  AuditLog,
  ContributorV1,
  CycleV1,
  DialaDay,
  DayEntry,
  OtherChargeV1,
  Person,
  Pump,
  PumpV1,
  Shareholder,
  Transaction,
} from "./types";
import { addDaysISO, durationMin, isoToShort, minutesToTime, timeToMinutes, todayISO, uid } from "./util";
import { computeUsageDraft } from "./rules";

export function emptyState(): AppState {
  return {
    version: 2,
    pump: null,
    persons: [],
    shareholders: [],
    rights: [],
    rounds: [],
    days: [],
    entries: [],
    usages: [],
    stoppages: [],
    fuelRecords: [],
    operatorRecords: [],
    transactions: [],
    personalRecords: [],
    settlements: [],
    conflictAcks: [],
    notifications: [],
    auditLogs: [],
    syncQueue: [],
    settings: {
      theme: "light",
      language: "ar",
      deviceId: uid("dev"),
      lastSyncAt: "",
    },
    counters: { diala: 1, round: 1 },
  };
}

/* ------------------------------ ترحيل v1 ------------------------------- */

export function pumpFromV1(p: PumpV1): Pump {
  return {
    id: uid("pump"),
    name: p.name || "المضخة",
    wells: p.wells || "",
    farm: p.farm || "",
    engine: "",
    energyType: p.energyType || "diesel",
    workStart: p.workStart || "06:00",
    workEnd: p.workEnd || "18:00",
    fuelConsumptionPerHour: p.fuelConsumptionPerHour || 0,
    fuelPerCycle: p.fuelPerCycle || 0,
    fuelCalcMode: p.fuelCalcMode || "hour",
    fuelPrice: p.fuelPrice || 0,
    royaltyEnabled: !!p.hasRoyalty,
    royaltyMode: p.royaltyMode || "cycle",
    royaltyPerCycle: p.royaltyPerCycle || 0,
    royaltyPerHour: p.royaltyPerHour || 0,
    operatorName: "",
    operatorHourlyWage: 0,
    operatorStart: p.workStart || "06:00",
    operatorEnd: p.workEnd || "18:00",
    shareUnit: p.shareUnit || "حصة",
    currency: p.currency || "YER",
    notes: p.notes || "",
    archived: false,
    createdAt: new Date().toISOString(),
  };
}

export function migrateV1(raw: unknown): AppState {
  const state = emptyState();
  if (!raw || typeof raw !== "object") return state;
  const v1 = raw as {
    pump?: PumpV1 | null;
    contributors?: ContributorV1[];
    cycles?: CycleV1[];
    otherCharges?: OtherChargeV1[];
    history?: { id: string; at: string; text: string }[];
  };

  if (v1.pump) state.pump = pumpFromV1(v1.pump);
  const pumpId = state.pump?.id ?? "pump_legacy";

  // المساهمون → أشخاص + أسهم
  const personByContributor = new Map<string, Person>();
  (v1.contributors ?? []).forEach((c, index) => {
    const person: Person = {
      id: uid("pr"),
      name: c.name,
      phone: c.phone || "",
      nationalId: "",
      notes: c.notes || "",
      guest: false,
      archived: !!c.archived,
      createdAt: c.createdAt || new Date().toISOString(),
      createdBy: "manager",
    };
    personByContributor.set(c.id, person);
    state.persons.push(person);
    const sh: Shareholder = {
      id: uid("sh"),
      pumpId,
      personId: person.id,
      shareNo: index + 1,
      units: c.shares || 0,
      baseHoursMin: 0,
      baseOrder: index,
      startDate: (c.createdAt || new Date().toISOString()).slice(0, 10),
      endDate: null,
      status: c.archived ? "ended" : "active",
      notes: "",
      archived: !!c.archived,
      createdAt: c.createdAt || new Date().toISOString(),
    };
    state.shareholders.push(sh);
  });

  // الديالات → أيام فعلية
  (v1.cycles ?? []).forEach((cycle) => {
    const date = (cycle.createdAt || new Date().toISOString()).slice(0, 10);
    const day: DialaDay = {
      id: uid("day"),
      pumpId,
      dialaNumber: cycle.number || state.counters.diala,
      date,
      status: cycle.archived
        ? "closed"
        : cycle.turns?.some((t) => t.status === "in_progress")
          ? "in_progress"
          : cycle.turns?.some((t) => t.status === "completed")
            ? "completed"
            : "draft",
      workStart: cycle.workStart,
      workEnd: cycle.workEnd,
      capacityMin: durationMin(cycle.workStart, cycle.workEnd),
      notes: "",
      openedBy: "manager",
      closedBy: "",
      closedAt: "",
      reopenedBy: "",
      reopenedAt: "",
      reopenReason: "",
      revision: 0,
      createdAt: cycle.createdAt,
      updatedAt: cycle.createdAt,
      archived: !!cycle.archived,
    };
    state.days.push(day);
    state.counters.diala = Math.max(state.counters.diala, (cycle.number || 0) + 1);

    (cycle.turns ?? []).forEach((turn, i) => {
      const person = personByContributor.get(turn.contributorId);
      if (!person) return;
      const shareholder = state.shareholders.find((s) => s.personId === person.id) ?? null;
      const entry: DayEntry = {
        id: uid("en"),
        dayId: day.id,
        pumpId,
        orderIndex: i,
        personId: person.id,
        role: "shareholder",
        shareholderId: shareholder?.id ?? null,
        rightId: null,
        startTime: turn.plannedStart,
        endTime: turn.plannedEnd,
        plannedMin: turn.durationMin,
        actualPersonId: null,
        usageId: null,
        status:
          turn.status === "completed"
            ? "done"
            : turn.status === "in_progress"
              ? "planned"
              : turn.status === "postponed"
                ? "postponed"
                : "planned",
        postponeToDayId: null,
        reason: "",
        notes: turn.note || "",
        createdAt: cycle.createdAt,
        createdBy: "manager",
        archived: false,
      };
      state.entries.push(entry);

      // استخدام فعلي إن وُجدت أوقات فعلية
      if (turn.actualStart && turn.actualEnd && state.pump) {
        const draft = computeUsageDraft(state.pump, day, turn.actualStart, turn.actualEnd);
        const usage: ActualUsage = {
          id: uid("us"),
          pumpId,
          dayId: day.id,
          entryId: entry.id,
          personId: person.id,
          rightHolderId: null,
          shareholderId: shareholder?.id ?? null,
          date: day.date,
          startTime: turn.actualStart,
          endTime: turn.actualEnd,
          minutes: draft.minutes,
          crossesMidnight: draft.crossesMidnight,
          usageType: "share",
          fuelPerHourSnapshot: draft.fuelPerHourSnapshot,
          fuelLiters: draft.fuelLiters,
          fuelPriceSnapshot: draft.fuelPriceSnapshot,
          fuelAmountDue: draft.fuelAmountDue,
          royaltyHourlySnapshot: draft.royaltyHourlySnapshot,
          royaltyAmountDue: draft.royaltyAmountDue,
          overCapacity: false,
          overCapacityReason: "",
          notes: "مُرحَّل من النظام القديم",
          status: "active",
          createdAt: cycle.createdAt,
          createdBy: "manager",
        };
        state.usages.push(usage);
        entry.usageId = usage.id;
      }

      // المالية القديمة → حركات
      if (turn.fuelDue > 0) {
        state.transactions.push(
          legacyTx(pumpId, person.id, shareholder?.id ?? null, day.id, "fuel", "debit", turn.fuelDue, day.date, "استحقاق ديزل (مُرحَّل)")
        );
      }
      if (turn.royaltyDue > 0) {
        state.transactions.push(
          legacyTx(pumpId, person.id, shareholder?.id ?? null, day.id, "royalty", "debit", turn.royaltyDue, day.date, "استحقاق رواسة (مُرحَّل)")
        );
      }
      if (turn.fuelPaid > 0) {
        state.transactions.push(
          legacyTx(pumpId, person.id, shareholder?.id ?? null, day.id, "payment", "credit", turn.fuelPaid, (turn.fuelPaidDate || day.date).slice(0, 10), "دفعة ديزل (مُرحَّلة)")
        );
      }
      if (turn.royaltyPaid > 0) {
        state.transactions.push(
          legacyTx(pumpId, person.id, shareholder?.id ?? null, day.id, "payment", "credit", turn.royaltyPaid, (turn.royaltyPaidDate || day.date).slice(0, 10), "دفعة رواسة (مُرحَّلة)")
        );
      }
    });
  });

  // الرسوم الأخرى → حركات
  for (const charge of v1.otherCharges ?? []) {
    const person = personByContributor.get(charge.contributorId);
    if (!person) continue;
    if (charge.amount > 0) {
      state.transactions.push(
        legacyTx(pumpId, person.id, null, null, "debt", "debit", charge.amount, (charge.date || todayISO()).slice(0, 10), charge.label || "دين (مُرحَّل)")
      );
    }
    if (charge.paid > 0) {
      state.transactions.push(
        legacyTx(pumpId, person.id, null, null, "payment", "credit", charge.paid, (charge.date || todayISO()).slice(0, 10), `دفعة ${charge.label || ""} (مُرحَّلة)`)
      );
    }
  }

  // السجل القديم → سجل تدقيق
  for (const h of v1.history ?? []) {
    const log: AuditLog = {
      id: uid("lg"),
      at: h.at,
      actor: "manager",
      actorRole: "manager",
      action: "legacy",
      entity: "history",
      entityId: h.id,
      summary: h.text,
      before: "",
      after: "",
      reason: "مُرحَّل من الإصدار الأول",
      deviceId: state.settings.deviceId,
      synced: true,
    };
    state.auditLogs.push(log);
  }

  state.auditLogs.unshift({
    id: uid("lg"),
    at: new Date().toISOString(),
    actor: "manager",
    actorRole: "manager",
    action: "migrate",
    entity: "state",
    entityId: "v1",
    summary: `تم ترحيل البيانات القديمة: ${state.persons.length} شخص، ${state.shareholders.length} سهم، ${state.days.length} يوم، ${state.transactions.length} حركة مالية`,
    before: "",
    after: JSON.stringify({ persons: state.persons.length, days: state.days.length }),
    reason: "ترقية النظام",
    deviceId: state.settings.deviceId,
    synced: true,
  });

  return state;
}

function legacyTx(
  pumpId: string,
  personId: string,
  shareholderId: string | null,
  dayId: string | null,
  kind: Transaction["kind"],
  direction: Transaction["direction"],
  amount: number,
  date: string,
  reason: string
): Transaction {
  return {
    id: uid("tx"),
    pumpId,
    kind,
    direction,
    personId,
    shareholderId,
    dayId,
    usageId: null,
    operatorRecordId: null,
    fuelRecordId: null,
    amount,
    date: date || todayISO(),
    reason,
    status: "posted",
    correctsTxId: null,
    notes: "",
    source: "manager",
    createdAt: new Date().toISOString(),
    createdBy: "manager",
  };
}

/* ---------------------------- بيانات تجريبية --------------------------- */

export function seedDemo(): AppState {
  const state = emptyState();
  const today = todayISO();
  const yesterday = addDaysISO(today, -1);
  const pumpId = "pump_demo";

  state.pump = {
    id: pumpId,
    name: "مضخة العليا",
    wells: "بئر الحافة",
    farm: "وادي الحمراء",
    engine: "محرك 60 حصان",
    energyType: "diesel",
    workStart: "06:00",
    workEnd: "02:00",
    fuelConsumptionPerHour: 6,
    fuelPerCycle: 120,
    fuelCalcMode: "hour",
    fuelPrice: 1200,
    royaltyEnabled: true,
    royaltyMode: "hour",
    royaltyPerCycle: 0,
    royaltyPerHour: 500,
    operatorName: "سالم الرواس",
    operatorHourlyWage: 1500,
    operatorStart: "06:00",
    operatorEnd: "02:00",
    shareUnit: "حصة",
    currency: "YER",
    notes: "المضخة تعمل 20 ساعة يوميًا مع توقف يومي للتشحيل",
    archived: false,
    createdAt: new Date().toISOString(),
  };

  const mkPerson = (name: string, phone = "", notes = ""): Person => ({
    id: uid("pr"),
    name,
    phone,
    nationalId: "",
    notes,
    guest: false,
    archived: false,
    createdAt: new Date().toISOString(),
    createdBy: "manager",
  });

  const ahmed = mkPerson("أحمد خليل", "777111111");
  const mohammedK = mkPerson("محمد كريم", "777222222");
  const khaled = mkPerson("خالد أحمد", "777333333");
  const ali = mkPerson("علي حسن", "777444444");
  const mohammedA1 = mkPerson("محمد أحمد", "777555551", "ساكن الجهة الشرقية");
  const mohammedA2 = mkPerson("محمد أحمد", "777555552", "ساكن الجهة الغربية — شخص مختلف تمامًا");
  state.persons.push(ahmed, mohammedK, khaled, ali, mohammedA1, mohammedA2);

  const mkShare = (person: Person, units: number, baseHours: number, order: number): Shareholder => ({
    id: uid("sh"),
    pumpId,
    personId: person.id,
    shareNo: order + 1,
    units,
    baseHoursMin: baseHours * 60,
    baseOrder: order,
    startDate: addDaysISO(today, -120),
    endDate: null,
    status: "active",
    notes: "",
    archived: false,
    createdAt: new Date().toISOString(),
  });

  const shAhmed = mkShare(ahmed, 2, 6, 0);
  const shMohammed = mkShare(mohammedK, 3, 8, 1);
  const shAli = mkShare(ali, 1.5, 4, 2);
  const shMohA1 = mkShare(mohammedA1, 0.5, 2, 3);
  state.shareholders.push(shAhmed, shMohammed, shAli, shMohA1);

  // حالة 2 و3: أحمد أجّر سهمه لمحمد كريم لمدة سنة
  state.rights.push({
    id: uid("rt"),
    pumpId,
    shareholderId: shAhmed.id,
    fromPersonId: ahmed.id,
    holderPersonId: mohammedK.id,
    kind: "rent",
    hoursMin: shAhmed.baseHoursMin,
    amount: 50000,
    agreement: "تأجير سنة كاملة",
    startedAt: addDaysISO(today, -30),
    endedAt: addDaysISO(today, 335),
    toPumpId: null,
    status: "active",
    notes: "أحمد = المساهم الأساسي، محمد = صاحب الحق الحالي",
    parentId: null,
    createdAt: new Date().toISOString(),
    createdBy: "manager",
  });

  // يوم أمس: مُغلق مع استخدام فعلي
  const mkDay = (date: string, number: number, status: DialaDay["status"]): DialaDay => ({
    id: uid("day"),
    pumpId,
    dialaNumber: number,
    date,
    status,
    workStart: "06:00",
    workEnd: "02:00",
    capacityMin: 20 * 60,
    notes: "",
    openedBy: "manager",
    closedBy: status === "closed" ? "manager" : "",
    closedAt: status === "closed" ? new Date().toISOString() : "",
    reopenedBy: "",
    reopenedAt: "",
    reopenReason: "",
    revision: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archived: false,
  });

  const dayYes = mkDay(yesterday, 41, "closed");
  const dayToday = mkDay(today, 42, "draft");
  state.days.push(dayYes, dayToday);
  state.counters.diala = 43;

  const plan = (
    day: DialaDay,
    rows: { holder: Person; shareholder: Shareholder; hours: number; actual?: Person; role?: DayEntry["role"] }[],
    startOffsetMin = 0
  ) => {
    let cursor = timeToMinutes(day.workStart) + startOffsetMin;
    rows.forEach((row, i) => {
      const start = cursor;
      const end = cursor + row.hours * 60;
      cursor = end;
      const entry: DayEntry = {
        id: uid("en"),
        dayId: day.id,
        pumpId,
        orderIndex: i,
        personId: row.holder.id,
        role: row.role ?? (row.shareholder.personId === row.holder.id ? "shareholder" : "tenant"),
        shareholderId: row.shareholder.id,
        rightId: null,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        plannedMin: row.hours * 60,
        actualPersonId: row.actual?.id ?? null,
        usageId: null,
        status: "planned",
        postponeToDayId: null,
        reason: "",
        notes: "",
        createdAt: new Date().toISOString(),
        createdBy: "manager",
        archived: false,
      };
      state.entries.push(entry);
    });
  };

  // أمس: محمد (صاحب حق سهم أحمد) 6 ساعات، محمد كريم 8 ساعات، وخالد أخذ سهم علي (شخص ثالث)
  plan(dayYes, [
    { holder: mohammedK, shareholder: shAhmed, hours: 6, role: "tenant" },
    { holder: mohammedK, shareholder: shMohammed, hours: 8 },
    { holder: ali, shareholder: shAli, hours: 4, actual: khaled, role: "shareholder" },
  ]);

  const yesEntries = state.entries.filter((e) => e.dayId === dayYes.id);
  let cursor = timeToMinutes(dayYes.workStart);
  for (const entry of yesEntries) {
    const start = minutesToTime(cursor);
    const end = minutesToTime(cursor + entry.plannedMin);
    cursor += entry.plannedMin;
    entry.status = "done";
    const draft = computeUsageDraft(state.pump!, dayYes, start, end);
    const personId = entry.actualPersonId ?? entry.personId;
    const usage: ActualUsage = {
      id: uid("us"),
      pumpId,
      dayId: dayYes.id,
      entryId: entry.id,
      personId,
      rightHolderId: entry.personId,
      shareholderId: entry.shareholderId,
      date: dayYes.date,
      startTime: start,
      endTime: end,
      minutes: draft.minutes,
      crossesMidnight: draft.crossesMidnight,
      usageType: entry.actualPersonId ? "loan" : "share",
      fuelPerHourSnapshot: draft.fuelPerHourSnapshot,
      fuelLiters: draft.fuelLiters,
      fuelPriceSnapshot: draft.fuelPriceSnapshot,
      fuelAmountDue: draft.fuelAmountDue,
      royaltyHourlySnapshot: draft.royaltyHourlySnapshot,
      royaltyAmountDue: draft.royaltyAmountDue,
      overCapacity: false,
      overCapacityReason: "",
      notes: entry.actualPersonId ? "أخذ الساعات من صاحب الدور" : "",
      status: "active",
      createdAt: new Date().toISOString(),
      createdBy: "manager",
    };
    state.usages.push(usage);
    entry.usageId = usage.id;
    // استحقاقات
    state.transactions.push(
      tx(pumpId, personId, entry.shareholderId, dayYes.id, usage.id, "fuel", "debit", usage.fuelAmountDue, dayYes.date, "استحقاق ديزل"),
      tx(pumpId, personId, entry.shareholderId, dayYes.id, usage.id, "royalty", "debit", usage.royaltyAmountDue, dayYes.date, "استحقاق رواسة")
    );
  }

  // اليوم: مسودة من الجدول (مع إتاحة التعديل الكامل)
  plan(dayToday, [
    { holder: mohammedK, shareholder: shAhmed, hours: 6, role: "tenant" },
    { holder: mohammedK, shareholder: shMohammed, hours: 8 },
    { holder: ali, shareholder: shAli, hours: 4 },
    { holder: mohammedA1, shareholder: shMohA1, hours: 2 },
  ]);

  // توقف أمس بسبب نقص الديزل
  state.stoppages.push({
    id: uid("st"),
    pumpId,
    dayId: dayYes.id,
    date: dayYes.date,
    startTime: "14:00",
    endTime: "16:00",
    minutes: 120,
    kind: "fuel_shortage",
    reason: "نقص الديزل",
    notes: "توقف مؤقت حتى وصول الديزل",
    createdAt: new Date().toISOString(),
    createdBy: "manager",
    archived: false,
  });

  state.fuelRecords.push({
    id: uid("fr"),
    pumpId,
    dayId: dayYes.id,
    date: dayYes.date,
    hoursRun: 18,
    litersPerHour: 6,
    liters: 108,
    shortageLiters: 12,
    fuelPrice: 1200,
    notes: "ديزل عادي",
    createdAt: new Date().toISOString(),
    createdBy: "manager",
    archived: false,
  });

  state.operatorRecords.push({
    id: uid("op"),
    pumpId,
    dayId: dayYes.id,
    date: dayYes.date,
    operatorName: "سالم الرواس",
    hourlyWage: 1500,
    startTime: "06:00",
    endTime: "22:00",
    minutes: 16 * 60,
    dueAmount: 24000,
    notes: "",
    createdAt: new Date().toISOString(),
    createdBy: "manager",
    archived: false,
  });

  // دفعة جزئية من محمد كريم
  state.transactions.push(
    tx(pumpId, mohammedK.id, shMohammed.id, dayYes.id, null, "payment", "credit", 60000, yesterday, "دفعة نقدية")
  );

  // السجل الشخصي لخالد: 5 ساعات بينما السجل الرسمي 4 ساعات (حالة 13)
  state.personalRecords.push({
    id: uid("pr"),
    personId: khaled.id,
    pumpId,
    dayId: dayYes.id,
    date: yesterday,
    startTime: "18:00",
    endTime: "23:00",
    minutes: 300,
    dieselLiters: 30,
    dieselPricePerLiter: 1200,
    dieselAmount: 36000,
    royaltyAmount: 2500,
    paidAmount: 20000,
    debtAmount: 18500,
    operationType: "usage",
    notes: "أخذت 5 ساعات فعلًا",
    matchStatus: "different",
    createdAt: new Date().toISOString(),
  });

  state.notifications.push(
    {
      id: uid("nt"),
      at: new Date().toISOString(),
      kind: "difference",
      level: "warn",
      title: "اختلاف في الساعات",
      body: `في يوم ${isoToShort(yesterday)}: السجل الرسمي 4 ساعات والسجل الشخصي 5 ساعات (خالد أحمد).`,
      personId: khaled.id,
      dayId: dayYes.id,
      read: false,
    },
    {
      id: uid("nt"),
      at: new Date().toISOString(),
      kind: "stoppage",
      level: "warn",
      title: "توقف المضخة",
      body: `توقف بسبب نقص الديزل لمدة ساعتين يوم ${isoToShort(yesterday)}.`,
      personId: null,
      dayId: dayYes.id,
      read: false,
    },
    {
      id: uid("nt"),
      at: new Date().toISOString(),
      kind: "debt",
      level: "danger",
      title: "مبالغ غير مسددة",
      body: "يوجد مساهمون عليهم مبالغ غير مسددة — راجع قسم المالية.",
      personId: null,
      dayId: null,
      read: false,
    }
  );

  state.auditLogs.push({
    id: uid("lg"),
    at: new Date().toISOString(),
    actor: "manager",
    actorRole: "manager",
    action: "seed",
    entity: "state",
    entityId: "demo",
    summary: "تم تحميل بيانات تجريبية للاستعراض",
    before: "",
    after: "",
    reason: "استعراض",
    deviceId: state.settings.deviceId,
    synced: true,
  });

  return state;
}

export function tx(
  pumpId: string,
  personId: string | null,
  shareholderId: string | null,
  dayId: string | null,
  usageId: string | null,
  kind: Transaction["kind"],
  direction: Transaction["direction"],
  amount: number,
  date: string,
  reason: string
): Transaction {
  return {
    id: uid("tx"),
    pumpId,
    kind,
    direction,
    personId,
    shareholderId,
    dayId,
    usageId,
    operatorRecordId: null,
    fuelRecordId: null,
    amount,
    date,
    reason,
    status: "posted",
    correctsTxId: null,
    notes: "",
    source: "manager",
    createdAt: new Date().toISOString(),
    createdBy: "manager",
  };
}
