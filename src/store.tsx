import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  ActualUsage,
  AppNotification,
  AppState,
  AuditLog,
  ConflictAck,
  DialaDay,
  DialaRound,
  DayEntry,
  DieselSettlement,
  FuelRecord,
  MatchStatus,
  OperatorRecord,
  Person,
  PersonalRecord,
  Pump,
  RoyaltyPayMode,
  Settlement,
  ShareRight,
  Shareholder,
  Stoppage,
  SyncItem,
  Theme,
  Transaction,
  UsageType,
} from "./domain/types";
import { durationMin, isoToShort, nowTime, todayISO, uid } from "./domain/util";
import {
  computeUsageDraft,
  dayEntries as entriesOfDay,
  dieselSettlementLabel,
  findPerson,
  personBalance,
  planEntriesFromSchedule,
  royaltyModeLabel,
  settlementPostings,
} from "./domain/rules";
import { emptyState, migrateV1, normalizeState, seedDemo } from "./domain/migrate";
import { LEGACY_MANAGER_STORAGE_KEY as LEGACY_KEY, MANAGER_STORAGE_KEY as STORAGE_KEY } from "./domain/storage";

/* --------------------------------- الأفعال ------------------------------ */

export type Action =
  | { type: "SAVE_PUMP"; pump: Pump; isNew: boolean }
  | { type: "UPDATE_PUMP"; patch: Partial<Pump> }
  | { type: "SAVE_PERSON"; person: Person; isNew: boolean }
  | { type: "ARCHIVE_PERSON"; id: string; archived: boolean }
  | { type: "SAVE_SHAREHOLDER"; shareholder: Shareholder; isNew: boolean }
  | { type: "ARCHIVE_SHAREHOLDER"; id: string; archived: boolean }
  | { type: "ADD_RIGHT"; right: ShareRight; endPrevious: boolean }
  | { type: "END_RIGHT"; id: string; endedAt: string; reason: string; actor: string }
  | { type: "CANCEL_RIGHT"; id: string; reason: string }
  | {
      type: "CREATE_DAY";
      day: DialaDay;
      planFromSchedule: boolean;
      entries: DayEntry[];
    }
  | { type: "UPDATE_DAY"; id: string; patch: Partial<DialaDay> }
  | { type: "SET_DAY_STATUS"; id: string; status: DialaDay["status"]; actor: string }
  | { type: "CLOSE_DAY"; id: string; actor: string }
  | { type: "REOPEN_DAY"; id: string; actor: string; reason: string }
  | { type: "ARCHIVE_DAY"; id: string; archived: boolean }
  | { type: "CREATE_ROUND"; round: DialaRound; dates: string[] }
  | { type: "ARCHIVE_ROUND"; id: string; archived: boolean }
  | { type: "SAVE_ENTRY"; entry: DayEntry; isNew: boolean }
  | { type: "SAVE_ENTRIES"; dayId: string; entries: DayEntry[] }
  | { type: "MOVE_ENTRY"; id: string; dir: -1 | 1 }
  | { type: "DERIVE_ENTRIES"; dayId: string }
  | { type: "REMOVE_ENTRY"; id: string }
  | {
      type: "RECORD_USAGE";
      dayId: string;
      entryId: string | null;
      personId: string;
      shareholderId: string | null;
      rightHolderId: string | null;
      usageType: UsageType;
      startTime: string;
      endTime: string;
      notes: string;
      dieselSettlement: DieselSettlement;
      dieselShortageLiters: number;
      royaltyPayMode: RoyaltyPayMode;
      settlementNote: string;
      overCapacityReason: string;
      actor: string;
    }
  | {
      type: "SET_USAGE_SETTLEMENT";
      usageId: string;
      dieselSettlement: DieselSettlement;
      dieselShortageLiters: number;
      royaltyPayMode: RoyaltyPayMode;
      settlementNote: string;
      actor: string;
      reason: string;
    }
  | { type: "VOID_USAGE"; id: string; reason: string; actor: string }
  | { type: "SAVE_STOPPAGE"; stoppage: Stoppage; isNew: boolean }
  | { type: "ARCHIVE_STOPPAGE"; id: string; archived: boolean }
  | { type: "SAVE_FUEL"; record: FuelRecord; isNew: boolean }
  | { type: "ARCHIVE_FUEL"; id: string; archived: boolean }
  | { type: "SAVE_OPERATOR"; record: OperatorRecord; isNew: boolean }
  | { type: "ARCHIVE_OPERATOR"; id: string; archived: boolean }
  | { type: "ADD_TRANSACTION"; tx: Transaction }
  | {
      type: "CORRECT_TRANSACTION";
      id: string;
      newAmount: number;
      reason: string;
      actor: string;
    }
  | { type: "VOID_TRANSACTION"; id: string; reason: string; actor: string }
  | { type: "SAVE_PERSONAL"; record: PersonalRecord; isNew: boolean }
  | { type: "ARCHIVE_PERSONAL"; id: string; archived: boolean }
  | {
      type: "SETTLE";
      settlement: Settlement;
      personalRecordId: string | null;
      officialUsageId: string | null;
      adjustmentTx: Transaction | null;
    }
  | { type: "ACK_CONFLICT"; ack: ConflictAck }
  | { type: "READ_NOTIFICATIONS"; ids: string[] | null }
  | { type: "CLEAR_NOTIFICATIONS" }
  | { type: "SET_THEME"; theme: Theme }
  | { type: "MARK_SYNCED" }
  | { type: "RESET" }
  | { type: "SEED_DEMO" }
  | { type: "IMPORT"; state: AppState };

interface LogInput {
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  actor?: string;
  actorRole?: "manager" | "user" | "system";
  notify?: Omit<AppNotification, "id" | "at" | "read">[];
  op?: SyncItem["op"];
}

const short = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
};

/** كل تعديل حساس يمر من هنا: سجل تدقيق + قائمة مزامنة + إشعار */
function commit(_prev: AppState, next: AppState, log: LogInput): AppState {
  const at = new Date().toISOString();
  const audit: AuditLog = {
    id: uid("lg"),
    at,
    actor: log.actor ?? "manager",
    actorRole: log.actorRole ?? "manager",
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    summary: log.summary,
    before: short(log.before),
    after: short(log.after),
    reason: log.reason ?? "",
    deviceId: next.settings.deviceId,
    synced: false,
  };
  const sync: SyncItem = {
    id: uid("sq"),
    at,
    entity: log.entity,
    entityId: log.entityId,
    op: log.op ?? "update",
    summary: log.summary,
    status: "pending",
    conflictNote: "",
  };
  const notifications: AppNotification[] = (log.notify ?? []).map((n) => ({
    ...n,
    id: uid("nt"),
    at,
    read: false,
  }));
  return {
    ...next,
    auditLogs: [audit, ...next.auditLogs].slice(0, 800),
    syncQueue: [sync, ...next.syncQueue].slice(0, 500),
    notifications: [...notifications, ...next.notifications].slice(0, 200),
  };
}

function normalizeOrders(entries: DayEntry[]): DayEntry[] {
  return entries
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((e, i) => ({ ...e, orderIndex: i }));
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    /* ------------------------------ المضخة ---------------------------- */
    case "SAVE_PUMP": {
      const next = { ...state, pump: action.pump };
      return commit(state, next, {
        action: action.isNew ? "create" : "update",
        entity: "pump",
        entityId: action.pump.id,
        summary: `${action.isNew ? "تسجيل" : "تعديل"} بيانات المضخة: ${action.pump.name}`,
        before: action.isNew ? "" : state.pump,
        after: action.pump,
        op: action.isNew ? "create" : "update",
      });
    }

    case "UPDATE_PUMP": {
      if (!state.pump) return state;
      const next = { ...state, pump: { ...state.pump, ...action.patch } };
      return commit(state, next, {
        action: "update",
        entity: "pump",
        entityId: state.pump.id,
        summary: `تعديل بيانات المضخة (${Object.keys(action.patch).join(", ")})`,
        before: state.pump,
        after: next.pump,
      });
    }

    /* ------------------------------ الأشخاص --------------------------- */
    case "SAVE_PERSON": {
      const exists = state.persons.some((p) => p.id === action.person.id);
      const before = state.persons.find((p) => p.id === action.person.id);
      const next = {
        ...state,
        persons: exists
          ? state.persons.map((p) => (p.id === action.person.id ? action.person : p))
          : [...state.persons, action.person],
      };
      return commit(state, next, {
        action: exists ? "update" : "create",
        entity: "person",
        entityId: action.person.id,
        summary: `${exists ? "تعديل" : "إضافة"} شخص: ${action.person.name}${action.person.phone ? ` — ${action.person.phone}` : ""}`,
        before,
        after: action.person,
        op: exists ? "update" : "create",
      });
    }

    case "ARCHIVE_PERSON": {
      const person = state.persons.find((p) => p.id === action.id);
      const next = {
        ...state,
        persons: state.persons.map((p) =>
          p.id === action.id ? { ...p, archived: action.archived } : p
        ),
      };
      return commit(state, next, {
        action: action.archived ? "archive" : "restore",
        entity: "person",
        entityId: action.id,
        summary: `${action.archived ? "أرشفة (حذف ناعم)" : "إعادة تفعيل"} شخص: ${person?.name ?? action.id}`,
        before: person,
        after: { ...person, archived: action.archived },
      });
    }

    /* --------------------------- المساهمون والأسهم -------------------- */
    case "SAVE_SHAREHOLDER": {
      const exists = state.shareholders.some((s) => s.id === action.shareholder.id);
      const before = state.shareholders.find((s) => s.id === action.shareholder.id);
      const name = findPerson(state, action.shareholder.personId)?.name ?? "";
      const next = {
        ...state,
        shareholders: exists
          ? state.shareholders.map((s) =>
              s.id === action.shareholder.id ? action.shareholder : s
            )
          : [...state.shareholders, action.shareholder],
      };
      return commit(state, next, {
        action: exists ? "update" : "create",
        entity: "shareholder",
        entityId: action.shareholder.id,
        summary: `${exists ? "تعديل" : "تسجيل"} المساهم الأساسي: ${name} — ${action.shareholder.units} ${state.pump?.shareUnit ?? "حصة"}`,
        before,
        after: action.shareholder,
        op: exists ? "update" : "create",
      });
    }

    case "ARCHIVE_SHAREHOLDER": {
      const sh = state.shareholders.find((s) => s.id === action.id);
      const next = {
        ...state,
        shareholders: state.shareholders.map((s) =>
          s.id === action.id ? { ...s, archived: action.archived } : s
        ),
      };
      return commit(state, next, {
        action: action.archived ? "archive" : "restore",
        entity: "shareholder",
        entityId: action.id,
        summary: `${action.archived ? "أرشفة" : "إعادة تفعيل"} سهم ${findPerson(state, sh?.personId ?? null)?.name ?? ""}`,
        before: sh,
        after: { ...sh, archived: action.archived },
      });
    }

    /* ---------------------------- الحقوق والتحويلات -------------------- */
    case "ADD_RIGHT": {
      let rights = state.rights;
      if (action.endPrevious) {
        rights = rights.map((r) =>
          r.shareholderId === action.right.shareholderId && r.status === "active"
            ? { ...r, status: "ended", endedAt: r.endedAt ?? action.right.startedAt }
            : r
        );
      }
      const next = { ...state, rights: [...rights, action.right] };
      const holder = findPerson(state, action.right.holderPersonId)?.name ?? "";
      const from = findPerson(state, action.right.fromPersonId)?.name ?? "المساهم الأساسي";
      const kindLabel =
        action.right.kind === "rent"
          ? "تأجير"
          : action.right.kind === "gift"
            ? "إعطاء"
            : action.right.kind === "loan"
              ? "إعارة"
              : action.right.kind === "move_pump"
                ? "نقل لمضخة أخرى"
                : action.right.kind === "inherit"
                  ? "توريث"
                  : action.right.kind === "return"
                    ? "إعادة الحق"
                    : "نقل الحق";
      return commit(state, next, {
        action: "transfer",
        entity: "right",
        entityId: action.right.id,
        summary: `${kindLabel}: من ${from} إلى ${holder} من ${action.right.startedAt}${action.right.endedAt ? ` حتى ${action.right.endedAt}` : ""}`,
        after: action.right,
        op: "create",
        notify: [
          {
            kind: "turn_changed",
            level: "info",
            title: `تغيير صاحب الحق — ${kindLabel}`,
            body: `${holder} أصبح صاحب الحق في السهم (${kindLabel} من ${from}).`,
            personId: action.right.holderPersonId,
            dayId: null,
          },
        ],
      });
    }

    case "END_RIGHT": {
      const right = state.rights.find((r) => r.id === action.id);
      if (!right) return state;
      const next = {
        ...state,
        rights: state.rights.map((r) =>
          r.id === action.id ? { ...r, status: "ended" as const, endedAt: action.endedAt } : r
        ),
      };
      return commit(state, next, {
        action: "update",
        entity: "right",
        entityId: action.id,
        summary: `انتهاء حق ${findPerson(state, right.holderPersonId)?.name ?? ""} بتاريخ ${action.endedAt}`,
        before: right,
        after: { ...right, status: "ended", endedAt: action.endedAt },
        reason: action.reason,
        actor: action.actor,
        notify: [
          {
            kind: "difference",
            level: "info",
            title: "انتهاء فترة حق",
            body: `انتهى حق ${findPerson(state, right.holderPersonId)?.name ?? ""} وعاد الحق للمساهم الأساسي ${findPerson(state, right.fromPersonId)?.name ?? ""}.`,
            personId: right.holderPersonId,
            dayId: null,
          },
        ],
      });
    }

    case "CANCEL_RIGHT": {
      const right = state.rights.find((r) => r.id === action.id);
      if (!right) return state;
      const next = {
        ...state,
        rights: state.rights.map((r) =>
          r.id === action.id ? { ...r, status: "cancelled" as const } : r
        ),
      };
      return commit(state, next, {
        action: "cancel",
        entity: "right",
        entityId: action.id,
        summary: `إلغاء عملية حق (${findPerson(state, right.holderPersonId)?.name ?? ""})`,
        before: right,
        after: { ...right, status: "cancelled" },
        reason: action.reason,
      });
    }

    /* ------------------------------ الأيام ----------------------------- */
    case "CREATE_DAY": {
      const exists = state.days.find((d) => d.date === action.day.date && !d.archived);
      if (exists) return state;
      if (action.planFromSchedule && !state.pump) return state;
      const entries = action.planFromSchedule
        ? planEntriesFromSchedule(
            state,
            state.pump!,
            action.day.workStart,
            action.day.workEnd
          ).map((e) => ({ ...e, dayId: action.day.id, id: uid("en") }) as DayEntry)
        : action.entries.map((e) => ({ ...e, dayId: action.day.id }));
      const next = {
        ...state,
        days: [...state.days, action.day],
        entries: [...state.entries, ...entries],
        counters: { ...state.counters, diala: Math.max(state.counters.diala, action.day.dialaNumber + 1) },
      };
      return commit(state, next, {
        action: "create",
        entity: "day",
        entityId: action.day.id,
        summary: `إنشاء يوم فعلي بتاريخ ${action.day.date} (${entries.length} شخص)`,
        after: action.day,
        op: "create",
        notify: [
          {
            kind: "day_edited",
            level: "info",
            title: "يوم جديد",
            body: `أُنشئ يوم ${action.day.date} بـ ${entries.length} مشاركًا.`,
            personId: null,
            dayId: action.day.id,
          },
        ],
      });
    }

    case "UPDATE_DAY": {
      const before = state.days.find((d) => d.id === action.id);
      if (!before) return state;
      const next = {
        ...state,
        days: state.days.map((d) =>
          d.id === action.id ? { ...d, ...action.patch, updatedAt: new Date().toISOString() } : d
        ),
      };
      return commit(state, next, {
        action: "update",
        entity: "day",
        entityId: action.id,
        summary: `تعديل اليوم ${before.date}`,
        before,
        after: { ...before, ...action.patch },
      });
    }

    case "SET_DAY_STATUS": {
      const before = state.days.find((d) => d.id === action.id);
      if (!before) return state;
      const next = {
        ...state,
        days: state.days.map((d) =>
          d.id === action.id
            ? { ...d, status: action.status, updatedAt: new Date().toISOString() }
            : d
        ),
      };
      return commit(state, next, {
        action: "update",
        entity: "day",
        entityId: action.id,
        summary: `تغيير حالة اليوم ${before.date}: ${before.status} ← ${action.status}`,
        before: { status: before.status },
        after: { status: action.status },
        actor: action.actor,
      });
    }

    case "CLOSE_DAY": {
      const before = state.days.find((d) => d.id === action.id);
      if (!before) return state;
      const next = {
        ...state,
        days: state.days.map((d) =>
          d.id === action.id
            ? {
                ...d,
                status: "closed" as const,
                closedBy: action.actor,
                closedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : d
        ),
      };
      return commit(state, next, {
        action: "close",
        entity: "day",
        entityId: action.id,
        summary: `إغلاق اليوم ${before.date}`,
        before: { status: before.status },
        after: { status: "closed", closedBy: action.actor },
        actor: action.actor,
      });
    }

    case "REOPEN_DAY": {
      const before = state.days.find((d) => d.id === action.id);
      if (!before) return state;
      const next = {
        ...state,
        days: state.days.map((d) =>
          d.id === action.id
            ? {
                ...d,
                status: "revised" as const,
                reopenedBy: action.actor,
                reopenedAt: new Date().toISOString(),
                reopenReason: action.reason,
                revision: d.revision + 1,
                updatedAt: new Date().toISOString(),
              }
            : d
        ),
      };
      return commit(state, next, {
        action: "reopen",
        entity: "day",
        entityId: action.id,
        summary: `إعادة فتح اليوم ${before.date}`,
        before: { status: before.status },
        after: { status: "revised", reopenedBy: action.actor, revision: before.revision + 1 },
        reason: action.reason,
        actor: action.actor,
        notify: [
          {
            kind: "day_edited",
            level: "warn",
            title: `إعادة فتح يوم ${before.date}`,
            body: `أُعيد فتح اليوم بواسطة ${action.actor}. السبب: ${action.reason || "غير محدد"}`,
            personId: null,
            dayId: action.id,
          },
        ],
      });
    }

    case "ARCHIVE_DAY": {
      const before = state.days.find((d) => d.id === action.id);
      const next = {
        ...state,
        days: state.days.map((d) => (d.id === action.id ? { ...d, archived: action.archived } : d)),
      };
      return commit(state, next, {
        action: action.archived ? "archive" : "restore",
        entity: "day",
        entityId: action.id,
        summary: `${action.archived ? "أرشفة" : "إعادة تفعيل"} اليوم ${before?.date ?? ""}`,
        before,
        after: { ...before, archived: action.archived },
      });
    }

    /* ------------------------- الديالات (الدورات) --------------------- */
    case "CREATE_ROUND": {
      if (!state.pump) return state;
      const pump = state.pump;
      const capacityMin = durationMin(pump.workStart, pump.workEnd);
      const busy = new Set(state.days.filter((d) => !d.archived).map((d) => d.date));
      const fresh = action.dates.filter((date) => !busy.has(date));
      let number = state.counters.diala;
      const newDays: DialaDay[] = [];
      const newEntries: DayEntry[] = [];
      for (const date of fresh) {
        const day: DialaDay = {
          id: uid("day"),
          pumpId: pump.id,
          dialaNumber: number,
          roundId: action.round.id,
          date,
          status: "scheduled",
          workStart: pump.workStart,
          workEnd: pump.workEnd,
          capacityMin,
          notes: "",
          openedBy: "manager",
          closedBy: "",
          closedAt: "",
          reopenedBy: "",
          reopenedAt: "",
          reopenReason: "",
          revision: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          archived: false,
        };
        newDays.push(day);
        number += 1;
        newEntries.push(
          ...planEntriesFromSchedule(state, pump, day.workStart, day.workEnd).map(
            (e) => ({ ...e, dayId: day.id, id: uid("en") }) as DayEntry
          )
        );
      }
      const round: DialaRound = { ...action.round };
      const next = {
        ...state,
        rounds: [...state.rounds, round],
        days: [...state.days, ...newDays],
        entries: [...state.entries, ...newEntries],
        counters: {
          diala: Math.max(number, state.counters.diala),
          round: Math.max(state.counters.round, round.number + 1),
        },
      };
      return commit(state, next, {
        action: "create",
        entity: "round",
        entityId: round.id,
        summary: `إنشاء ديالة ${round.number}: من ${round.startDate} إلى ${round.endDate} (${round.days} يوم، أُنشئ ${newDays.length} يوم)`,
        after: round,
        op: "create",
        notify: [
          {
            kind: "day_edited",
            level: "info",
            title: `ديالة ${round.number} جديدة`,
            body: `من ${isoToShort(round.startDate)} إلى ${isoToShort(round.endDate)} — ${round.days} يوم، وأُنشئ ${newDays.length} يوم للعمل.`,
            personId: null,
            dayId: null,
          },
        ],
      });
    }

    case "ARCHIVE_ROUND": {
      const before = state.rounds.find((r) => r.id === action.id);
      if (!before) return state;
      const at = new Date().toISOString();
      const next = {
        ...state,
        rounds: state.rounds.map((r) => (r.id === action.id ? { ...r, archived: action.archived } : r)),
        days: state.days.map((d) =>
          d.roundId === action.id ? { ...d, archived: action.archived, updatedAt: at } : d
        ),
      };
      return commit(state, next, {
        action: action.archived ? "archive" : "restore",
        entity: "round",
        entityId: action.id,
        summary: `${action.archived ? "أرشفة" : "إعادة تفعيل"} ديالة ${before.number} (${before.days} يوم)`,
        before,
        after: { ...before, archived: action.archived },
      });
    }

    /* ------------------------- صفوف اليوم الفعلي ---------------------- */
    case "SAVE_ENTRY": {
      const exists = state.entries.some((e) => e.id === action.entry.id);
      const before = state.entries.find((e) => e.id === action.entry.id);
      let entries: DayEntry[];
      if (exists) {
        entries = state.entries.map((e) => (e.id === action.entry.id ? action.entry : e));
      } else {
        const dayList = state.entries.filter(
          (e) => e.dayId === action.entry.dayId && !e.archived
        );
        entries = [
          ...state.entries,
          { ...action.entry, orderIndex: dayList.length },
        ];
      }
      const next = { ...state, entries: normalizeOrders(entries) };
      return commit(state, next, {
        action: exists ? "update" : "create",
        entity: "entry",
        entityId: action.entry.id,
        summary: `${exists ? "تعديل" : "إضافة"} ${findPerson(state, action.entry.personId)?.name ?? ""} في اليوم (${action.entry.startTime} → ${action.entry.endTime})`,
        before,
        after: action.entry,
        op: exists ? "update" : "create",
      });
    }

    case "SAVE_ENTRIES": {
      const others = state.entries.filter((e) => e.dayId !== action.dayId);
      const next = { ...state, entries: [...others, ...normalizeOrders(action.entries)] };
      return commit(state, next, {
        action: "update",
        entity: "day",
        entityId: action.dayId,
        summary: `إعادة ترتيب اليوم (${action.entries.length} صف)`,
        after: action.entries.map((e) => ({ p: e.personId, o: e.orderIndex })),
      });
    }

    case "MOVE_ENTRY": {
      const list = entriesOfDay(state, state.entries.find((e) => e.id === action.id)?.dayId ?? "");
      const index = list.findIndex((e) => e.id === action.id);
      const target = index + action.dir;
      if (index < 0 || target < 0 || target >= list.length) return state;
      const swapped = list.slice();
      const tmp = swapped[index];
      swapped[index] = swapped[target];
      swapped[target] = tmp;
      const reordered = normalizeOrders(swapped);
      const map = new Map(reordered.map((e) => [e.id, e]));
      const next = {
        ...state,
        entries: state.entries.map((e) => map.get(e.id) ?? e),
      };
      return commit(state, next, {
        action: "update",
        entity: "entry",
        entityId: action.id,
        summary: `${action.dir === -1 ? "تقديم" : "تأخير"} ${findPerson(state, swapped[target].personId)?.name ?? ""} في ترتيب اليوم`,
        before: { orderIndex: index },
        after: { orderIndex: target },
      });
    }

    case "DERIVE_ENTRIES": {
      if (!state.pump) return state;
      const day = state.days.find((d) => d.id === action.dayId);
      if (!day) return state;
      const derived = planEntriesFromSchedule(
        state,
        state.pump,
        day.workStart,
        day.workEnd
      ).map((e) => ({ ...e, dayId: day.id }) as DayEntry);
      const next = {
        ...state,
        entries: [...state.entries.filter((e) => e.dayId !== action.dayId), ...derived],
      };
      return commit(state, next, {
        action: "update",
        entity: "day",
        entityId: action.dayId,
        summary: `استرجاع الجدول الأساسي في اليوم ${day.date} (${derived.length} شخص)`,
      });
    }

    case "REMOVE_ENTRY": {
      const entry = state.entries.find((e) => e.id === action.id);
      if (!entry) return state;
      const next = {
        ...state,
        entries: normalizeOrders(
          state.entries.map((e) => (e.id === action.id ? { ...e, archived: true } : e))
        ),
      };
      return commit(state, next, {
        action: "delete",
        entity: "entry",
        entityId: action.id,
        summary: `إزالة ${findPerson(state, entry.personId)?.name ?? ""} من اليوم (حذف ناعم)`,
        before: entry,
        op: "delete",
      });
    }

    /* --------------------------- الاستخدام الفعلي --------------------- */
    case "RECORD_USAGE": {
      if (!state.pump) return state;
      const day = state.days.find((d) => d.id === action.dayId);
      if (!day) return state;
      const draft = computeUsageDraft(
        state.pump,
        day,
        action.startTime,
        action.endTime
      );
      const dayList = state.usages.filter((u) => u.dayId === day.id && u.status === "active");
      const totalMin = dayList.reduce((s, u) => s + u.minutes, 0) + draft.minutes;
      const capacity = durationMin(day.workStart, day.workEnd);
      const overCapacity = totalMin > capacity + 1;
      const usage: ActualUsage = {
        id: uid("us"),
        pumpId: day.pumpId,
        dayId: day.id,
        entryId: action.entryId,
        personId: action.personId,
        rightHolderId: action.rightHolderId,
        shareholderId: action.shareholderId,
        date: day.date,
        startTime: action.startTime,
        endTime: action.endTime,
        minutes: draft.minutes,
        crossesMidnight: draft.crossesMidnight,
        usageType: action.usageType,
        fuelPerHourSnapshot: draft.fuelPerHourSnapshot,
        fuelLiters: draft.fuelLiters,
        fuelPriceSnapshot: draft.fuelPriceSnapshot,
        fuelAmountDue: draft.fuelAmountDue,
        royaltyHourlySnapshot: draft.royaltyHourlySnapshot,
        royaltyAmountDue: draft.royaltyAmountDue,
        dieselSettlement: action.dieselSettlement,
        dieselShortageLiters: Math.max(0, action.dieselShortageLiters || 0),
        royaltyPayMode: action.royaltyPayMode,
        settlementNote: action.settlementNote,
        overCapacity,
        overCapacityReason: overCapacity ? action.overCapacityReason : "",
        notes: action.notes,
        status: "active",
        createdAt: new Date().toISOString(),
        createdBy: action.actor,
      };

      const newTx: Transaction[] = settlementPostings(usage).map((p) =>
        makeTx(day, usage, p.kind, p.direction, p.amount, p.reason, p.notes)
      );
      const person = findPerson(state, action.personId);

      const next = {
        ...state,
        usages: [...state.usages, usage],
        entries: action.entryId
          ? state.entries.map((e) =>
              e.id === action.entryId
                ? { ...e, usageId: usage.id, status: "done" as const }
                : e
            )
          : state.entries,
        transactions: [...state.transactions, ...newTx],
      };
      return commit(state, next, {
        action: "create",
        entity: "usage",
        entityId: usage.id,
        summary: `تسجيل استخدام فعلي: ${person?.name ?? ""} — ${action.startTime} → ${action.endTime} (${Math.round(draft.minutes)} دقيقة، ${draft.fuelLiters} لتر) · ديزل: ${dieselSettlementLabel(
          usage.dieselSettlement
        )} · رواسة: ${royaltyModeLabel(usage.royaltyPayMode)}`,
        after: usage,
        op: "create",
        notify: [
          {
            kind: "debt",
            level: overCapacity ? "danger" : usage.dieselSettlement === "unpaid" ? "warn" : "info",
            title: overCapacity ? "تجاوز ساعات التشغيل" : "تسجيل استخدام",
            body: overCapacity
              ? `مجموع ساعات اليوم تجاوز ساعات تشغيل المضخة — السبب: ${action.overCapacityReason || "غير محدد"}`
              : `سُجّل استخدام ${person?.name ?? ""} بمقدار ${Math.round(draft.minutes)} دقيقة — ديزل: ${dieselSettlementLabel(
                  usage.dieselSettlement
                )}${usage.dieselSettlement === "shortage" ? ` (${usage.dieselShortageLiters} لتر)` : ""} · رواسة: ${royaltyModeLabel(
                  usage.royaltyPayMode
                )}.`,
            personId: action.personId,
            dayId: day.id,
          },
        ],
      });
    }

    case "SET_USAGE_SETTLEMENT": {
      const usage = state.usages.find((u) => u.id === action.usageId);
      if (!usage) return state;
      const day = state.days.find((d) => d.id === usage.dayId);
      if (!day) return state;
      const updated: ActualUsage = {
        ...usage,
        dieselSettlement: action.dieselSettlement,
        dieselShortageLiters: Math.max(0, action.dieselShortageLiters || 0),
        royaltyPayMode: action.royaltyPayMode,
        settlementNote: action.settlementNote,
      };
      // الحركات السابقة لهذه العملية تُلغى (لا تُحذف) ثم تُسجَّل الحركات الجديدة
      const at = new Date().toISOString();
      const voidedTx = state.transactions.map((t) =>
        t.usageId === usage.id && t.status === "posted"
          ? {
              ...t,
              status: "void" as const,
              notes: `${t.notes}${t.notes ? " | " : ""}أُلغيت لتعديل حالة التسديد (${at.slice(0, 16).replace("T", " ")}): ${
                action.reason || "بدون سبب مسجّل"
              }`,
            }
          : t
      );
      const newTx = settlementPostings(updated).map((p) =>
        makeTx(day, updated, p.kind, p.direction, p.amount, p.reason, p.notes)
      );
      const next = {
        ...state,
        usages: state.usages.map((u) => (u.id === updated.id ? updated : u)),
        transactions: [...voidedTx, ...newTx],
      };
      return commit(state, next, {
        action: "update",
        entity: "usage",
        entityId: updated.id,
        summary: `تعديل تسديد ${findPerson(state, updated.personId)?.name ?? ""} — ديزل: ${dieselSettlementLabel(
          updated.dieselSettlement
        )}${updated.dieselSettlement === "shortage" ? ` (${updated.dieselShortageLiters} لتر)` : ""} · رواسة: ${royaltyModeLabel(
          updated.royaltyPayMode
        )}`,
        before: usage,
        after: updated,
        reason: action.reason,
        actor: action.actor,
        notify: [
          {
            kind: updated.dieselSettlement === "unpaid" ? "debt" : "payment",
            level: updated.dieselSettlement === "unpaid" ? "warn" : "info",
            title: "تعديل حالة التسديد",
            body: `${findPerson(state, updated.personId)?.name ?? ""}: ديزل ${dieselSettlementLabel(
              updated.dieselSettlement
            )} · رواسة ${royaltyModeLabel(updated.royaltyPayMode)}${
              action.reason ? ` — ${action.reason}` : ""
            }`,
            personId: updated.personId,
            dayId: updated.dayId,
          },
        ],
      });
    }

    case "VOID_USAGE": {
      const usage = state.usages.find((u) => u.id === action.id);
      if (!usage) return state;
      const next = {
        ...state,
        usages: state.usages.map((u) => (u.id === action.id ? { ...u, status: "void" as const } : u)),
        transactions: state.transactions.map((t) =>
          t.usageId === action.id && t.status === "posted" ? { ...t, status: "void" as const } : t
        ),
        entries: state.entries.map((e) =>
          e.usageId === action.id
            ? { ...e, usageId: null, status: "planned" as const }
            : e
        ),
      };
      return commit(state, next, {
        action: "cancel",
        entity: "usage",
        entityId: action.id,
        summary: `إلغاء استخدام (${findPerson(state, usage.personId)?.name ?? ""}) بتاريخ ${usage.date}`,
        before: usage,
        after: { ...usage, status: "void" },
        reason: action.reason,
        actor: action.actor,
        notify: [
          {
            kind: "day_edited",
            level: "warn",
            title: "إلغاء سجل استخدام",
            body: `أُلغي سجل استخدام ${findPerson(state, usage.personId)?.name ?? ""} بتاريخ ${usage.date}. السبب: ${action.reason || "غير محدد"}`,
            personId: usage.personId,
            dayId: usage.dayId,
          },
        ],
      });
    }

    /* --------------------- التوقفات والوقود والرواسة ------------------- */
    case "SAVE_STOPPAGE": {
      const exists = state.stoppages.some((s) => s.id === action.stoppage.id);
      const next = {
        ...state,
        stoppages: exists
          ? state.stoppages.map((s) => (s.id === action.stoppage.id ? action.stoppage : s))
          : [...state.stoppages, action.stoppage],
      };
      return commit(state, next, {
        action: exists ? "update" : "create",
        entity: "stoppage",
        entityId: action.stoppage.id,
        summary: `تسجيل توقف (${action.stoppage.reason}) — ${action.stoppage.minutes} دقيقة`,
        after: action.stoppage,
        op: exists ? "update" : "create",
        notify: [
          {
            kind: "stoppage",
            level: "warn",
            title: "توقف المضخة",
            body: `توقف ${action.stoppage.reason} لمدة ${Math.round(action.stoppage.minutes)} دقيقة بتاريخ ${action.stoppage.date}.`,
            personId: null,
            dayId: action.stoppage.dayId,
          },
        ],
      });
    }

    case "ARCHIVE_STOPPAGE":
      return commit(
        state,
        {
          ...state,
          stoppages: state.stoppages.map((s) =>
            s.id === action.id ? { ...s, archived: action.archived } : s
          ),
        },
        {
          action: "update",
          entity: "stoppage",
          entityId: action.id,
          summary: `${action.archived ? "أرشفة" : "إعادة تفعيل"} توقف`,
        }
      );

    case "SAVE_FUEL": {
      const exists = state.fuelRecords.some((f) => f.id === action.record.id);
      const next = {
        ...state,
        fuelRecords: exists
          ? state.fuelRecords.map((f) => (f.id === action.record.id ? action.record : f))
          : [...state.fuelRecords, action.record],
      };
      return commit(state, next, {
        action: exists ? "update" : "create",
        entity: "fuel",
        entityId: action.record.id,
        summary: `تسجيل استهلاك ديزل: ${action.record.liters} لتر (${action.record.hoursRun} ساعة تشغيل)`,
        after: action.record,
        op: exists ? "update" : "create",
      });
    }

    case "ARCHIVE_FUEL":
      return commit(
        state,
        {
          ...state,
          fuelRecords: state.fuelRecords.map((f) =>
            f.id === action.id ? { ...f, archived: action.archived } : f
          ),
        },
        {
          action: "update",
          entity: "fuel",
          entityId: action.id,
          summary: `${action.archived ? "أرشفة" : "إعادة تفعيل"} سجل ديزل`,
        }
      );

    case "SAVE_OPERATOR": {
      const exists = state.operatorRecords.some((o) => o.id === action.record.id);
      const next = {
        ...state,
        operatorRecords: exists
          ? state.operatorRecords.map((o) => (o.id === action.record.id ? action.record : o))
          : [...state.operatorRecords, action.record],
      };
      return commit(state, next, {
        action: exists ? "update" : "create",
        entity: "operator",
        entityId: action.record.id,
        summary: `تسجيل رواسة ${action.record.operatorName}: أجر مستحق ${action.record.dueAmount}`,
        after: action.record,
        op: exists ? "update" : "create",
      });
    }

    case "ARCHIVE_OPERATOR":
      return commit(
        state,
        {
          ...state,
          operatorRecords: state.operatorRecords.map((o) =>
            o.id === action.id ? { ...o, archived: action.archived } : o
          ),
        },
        {
          action: "update",
          entity: "operator",
          entityId: action.id,
          summary: `${action.archived ? "أرشفة" : "إعادة تفعيل"} سجل رواسة`,
        }
      );

    /* ------------------------------- المالية --------------------------- */
    case "ADD_TRANSACTION": {
      const next = { ...state, transactions: [...state.transactions, action.tx] };
      const person = findPerson(state, action.tx.personId);
      const isPayment = action.tx.direction === "credit";
      return commit(state, next, {
        action: "create",
        entity: "transaction",
        entityId: action.tx.id,
        summary: `${isPayment ? "تسجيل دفعة" : "تسجيل استحقاق/دين"} ${action.tx.amount} على ${person?.name ?? "—"} — ${action.tx.reason}`,
        after: action.tx,
        op: "create",
        notify: [
          {
            kind: isPayment ? "payment" : "debt",
            level: isPayment ? "info" : "warn",
            title: isPayment ? "تسجيل دفعة" : "تسجيل مبلغ مستحق",
            body: `${isPayment ? "دُفعت" : "استحق"} ${action.tx.amount} لـ ${person?.name ?? "—"} (${action.tx.reason})`,
            personId: action.tx.personId,
            dayId: action.tx.dayId,
          },
        ],
      });
    }

    case "CORRECT_TRANSACTION": {
      const original = state.transactions.find((t) => t.id === action.id);
      if (!original) return state;
      const delta = action.newAmount - original.amount;
      if (delta === 0) return state;
      const correction: Transaction = {
        id: uid("tx"),
        pumpId: original.pumpId,
        kind: "correction",
        direction:
          delta > 0 ? original.direction : original.direction === "debit" ? "credit" : "debit",
        personId: original.personId,
        shareholderId: original.shareholderId,
        dayId: original.dayId,
        usageId: original.usageId,
        operatorRecordId: original.operatorRecordId,
        fuelRecordId: original.fuelRecordId,
        amount: Math.abs(delta),
        date: original.date,
        reason: `تصحيح: الأصل ${original.amount} ← ${action.newAmount} (الفرق ${delta > 0 ? "+" : ""}${delta})`,
        status: "posted",
        correctsTxId: original.id,
        notes: action.reason,
        source: "manager",
        createdAt: new Date().toISOString(),
        createdBy: action.actor,
      };
      const next = { ...state, transactions: [...state.transactions, correction] };
      return commit(state, next, {
        action: "update",
        entity: "transaction",
        entityId: original.id,
        summary: `تصحيح دفعة من ${original.amount} إلى ${action.newAmount} (فرق ${delta > 0 ? "+" : ""}${delta})`,
        before: original,
        after: correction,
        reason: action.reason,
        actor: action.actor,
        notify: [
          {
            kind: "payment",
            level: "info",
            title: "تصحيح حركة مالية",
            body: `صُحّحت حركة بمقدار ${delta > 0 ? "+" : ""}${delta} — ${action.reason || "بدون سبب"}`,
            personId: original.personId,
            dayId: original.dayId,
          },
        ],
      });
    }

    case "VOID_TRANSACTION": {
      const original = state.transactions.find((t) => t.id === action.id);
      if (!original) return state;
      const next = {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.id ? { ...t, status: "void" as const, notes: `${t.notes} | إلغاء: ${action.reason}` } : t
        ),
      };
      return commit(state, next, {
        action: "cancel",
        entity: "transaction",
        entityId: action.id,
        summary: `إلغاء حركة مالية بمقدار ${original.amount}`,
        before: original,
        after: { ...original, status: "void" },
        reason: action.reason,
        actor: action.actor,
      });
    }

    /* ------------------------------ السجل الشخصي ---------------------- */
    case "SAVE_PERSONAL": {
      const exists = state.personalRecords.some((p) => p.id === action.record.id);
      const next = {
        ...state,
        personalRecords: exists
          ? state.personalRecords.map((p) => (p.id === action.record.id ? action.record : p))
          : [...state.personalRecords, action.record],
      };
      return commit(state, next, {
        action: exists ? "update" : "create",
        entity: "personal_record",
        entityId: action.record.id,
        summary: `سجل شخصي: ${findPerson(state, action.record.personId)?.name ?? ""} — ${action.record.date} (${Math.round(action.record.minutes)} دقيقة)`,
        after: action.record,
        actor: "user",
        actorRole: "user",
        op: exists ? "update" : "create",
      });
    }

    case "ARCHIVE_PERSONAL":
      return commit(
        state,
        {
          ...state,
          personalRecords: state.personalRecords.map((p) =>
            p.id === action.id ? { ...p, archived: action.archived } : p
          ),
        },
        {
          action: action.archived ? "archive" : "restore",
          entity: "personal_record",
          entityId: action.id,
          summary: action.archived ? "أرشفة سجل شخصي (حذف ناعم)" : "إعادة تفعيل سجل شخصي",
          actor: "user",
          actorRole: "user",
        }
      );

    case "SETTLE": {
      const next = {
        ...state,
        settlements: [action.settlement, ...state.settlements],
        personalRecords: action.personalRecordId
          ? state.personalRecords.map((p) =>
              p.id === action.personalRecordId ? { ...p, matchStatus: "settled" as MatchStatus } : p
            )
          : state.personalRecords,
        transactions: action.adjustmentTx
          ? [...state.transactions, action.adjustmentTx]
          : state.transactions,
      };
      return commit(state, next, {
        action: "settle",
        entity: "settlement",
        entityId: action.settlement.id,
        summary: `تسوية اختلاف: رسمي ${action.settlement.officialMinutes} د / شخصي ${action.settlement.personalMinutes} د — القرار: ${action.settlement.decision}`,
        after: action.settlement,
        reason: action.settlement.notes,
        notify: [
          {
            kind: "settlement",
            level: "info",
            title: "تسوية اختلاف",
            body: `تمت تسوية اختلاف ${findPerson(state, action.settlement.personId)?.name ?? ""} بقرار: ${action.settlement.decision}`,
            personId: action.settlement.personId,
            dayId: action.settlement.dayId,
          },
        ],
      });
    }

    case "ACK_CONFLICT": {
      const next = { ...state, conflictAcks: [action.ack, ...state.conflictAcks] };
      return commit(state, next, {
        action: "ack",
        entity: "conflict",
        entityId: action.ack.id,
        summary: `تجاوز تعارض (${action.ack.kind}) — السبب: ${action.ack.reason}`,
        after: action.ack,
        reason: action.ack.reason,
      });
    }

    /* --------------------------- الإشعارات والمزامنة ------------------- */
    case "READ_NOTIFICATIONS": {
      const next = {
        ...state,
        notifications: state.notifications.map((n) =>
          !action.ids || action.ids.includes(n.id) ? { ...n, read: true } : n
        ),
      };
      return { ...next };
    }

    case "CLEAR_NOTIFICATIONS":
      return { ...state, notifications: [] };

    case "SET_THEME":
      return { ...state, settings: { ...state.settings, theme: action.theme } };

    case "MARK_SYNCED": {
      const at = new Date().toISOString();
      return {
        ...state,
        settings: { ...state.settings, lastSyncAt: at },
        syncQueue: state.syncQueue.map((s) => ({ ...s, status: "synced" as const })),
        auditLogs: state.auditLogs.map((l) => ({ ...l, synced: true })),
      };
    }

    case "RESET":
      return emptyState();

    case "SEED_DEMO":
      return seedDemo();

    case "IMPORT":
      return action.state;

    default:
      return state;
  }
}

function makeTx(
  day: DialaDay,
  usage: ActualUsage,
  kind: Transaction["kind"],
  direction: Transaction["direction"],
  amount: number,
  reason: string,
  notes = ""
): Transaction {
  return {
    id: uid("tx"),
    pumpId: day.pumpId,
    kind,
    direction,
    personId: usage.personId,
    shareholderId: usage.shareholderId,
    dayId: day.id,
    usageId: usage.id,
    operatorRecordId: null,
    fuelRecordId: null,
    amount,
    date: day.date,
    reason,
    status: "posted",
    correctsTxId: null,
    notes:
      notes ||
      (kind === "fuel"
        ? `محسوبة من ${usage.fuelLiters} لتر × ${usage.fuelPriceSnapshot} (استهلاك وقت العملية ${usage.fuelPerHourSnapshot} لتر/ساعة)`
        : ""),
    source: "manager",
    createdAt: new Date().toISOString(),
    createdBy: "manager",
  };
}

/* ------------------------------- السياق -------------------------------- */

export interface AppActions {
  savePump: (pump: Pump, isNew: boolean) => void;
  updatePump: (patch: Partial<Pump>) => void;
  savePerson: (person: Person, isNew: boolean) => void;
  archivePerson: (id: string, archived: boolean) => void;
  saveShareholder: (sh: Shareholder, isNew: boolean) => void;
  archiveShareholder: (id: string, archived: boolean) => void;
  addRight: (right: ShareRight, endPrevious: boolean) => void;
  endRight: (id: string, endedAt: string, reason: string, actor: string) => void;
  cancelRight: (id: string, reason: string) => void;
  createDay: (day: DialaDay, planFromSchedule: boolean, entries: DayEntry[]) => void;
  updateDay: (id: string, patch: Partial<DialaDay>) => void;
  setDayStatus: (id: string, status: DialaDay["status"], actor: string) => void;
  closeDay: (id: string, actor: string) => void;
  reopenDay: (id: string, actor: string, reason: string) => void;
  archiveDay: (id: string, archived: boolean) => void;
  createRound: (round: DialaRound, dates: string[]) => void;
  archiveRound: (id: string, archived: boolean) => void;
  saveEntry: (entry: DayEntry, isNew: boolean) => void;
  saveEntries: (dayId: string, entries: DayEntry[]) => void;
  moveEntry: (id: string, dir: -1 | 1) => void;
  deriveEntries: (dayId: string) => void;
  removeEntry: (id: string) => void;
  recordUsage: (input: {
    dayId: string;
    entryId: string | null;
    personId: string;
    shareholderId: string | null;
    rightHolderId: string | null;
    usageType: UsageType;
    startTime: string;
    endTime: string;
    notes: string;
    dieselSettlement: DieselSettlement;
    dieselShortageLiters: number;
    royaltyPayMode: RoyaltyPayMode;
    settlementNote: string;
    overCapacityReason: string;
    actor: string;
  }) => void;
  setUsageSettlement: (
    usageId: string,
    input: {
      dieselSettlement: DieselSettlement;
      dieselShortageLiters: number;
      royaltyPayMode: RoyaltyPayMode;
      settlementNote: string;
      reason: string;
      actor: string;
    }
  ) => void;
  voidUsage: (id: string, reason: string, actor: string) => void;
  saveStoppage: (s: Stoppage, isNew: boolean) => void;
  archiveStoppage: (id: string, archived: boolean) => void;
  saveFuel: (r: FuelRecord, isNew: boolean) => void;
  archiveFuel: (id: string, archived: boolean) => void;
  saveOperator: (r: OperatorRecord, isNew: boolean) => void;
  archiveOperator: (id: string, archived: boolean) => void;
  addTransaction: (tx: Transaction) => void;
  correctTransaction: (id: string, newAmount: number, reason: string, actor: string) => void;
  voidTransaction: (id: string, reason: string, actor: string) => void;
  savePersonal: (r: PersonalRecord, isNew: boolean) => void;
  archivePersonal: (id: string, archived: boolean) => void;
  settle: (
    settlement: Settlement,
    personalRecordId: string | null,
    officialUsageId: string | null,
    adjustmentTx: Transaction | null
  ) => void;
  ackConflict: (ack: ConflictAck) => void;
  readNotifications: (ids: string[] | null) => void;
  clearNotifications: () => void;
  setTheme: (theme: Theme) => void;
  markSynced: () => void;
  reset: () => void;
  seedDemo: () => void;
  importState: (state: AppState) => void;
}

interface AppContextValue {
  state: AppState;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === 2) {
        // الحقول الحديثة تُضاف ولا تُحذف أي بيانات قائمة
        return normalizeState(parsed);
      }
      return migrateV1(parsed);
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated = migrateV1(parsed);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        /* ignore */
      }
      return migrated;
    }
  } catch {
    /* بيانات تالفة — نبدأ من حالة فارغة دون حذف أي شيء */
  }
  return emptyState();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", state.settings.theme === "dark");
  }, [state.settings.theme]);

  const actions = useMemo<AppActions>(
    () => ({
      savePump: (pump, isNew) => dispatch({ type: "SAVE_PUMP", pump, isNew }),
      updatePump: (patch) => dispatch({ type: "UPDATE_PUMP", patch }),
      savePerson: (person, isNew) => dispatch({ type: "SAVE_PERSON", person, isNew }),
      archivePerson: (id, archived) => dispatch({ type: "ARCHIVE_PERSON", id, archived }),
      saveShareholder: (shareholder, isNew) =>
        dispatch({ type: "SAVE_SHAREHOLDER", shareholder, isNew }),
      archiveShareholder: (id, archived) =>
        dispatch({ type: "ARCHIVE_SHAREHOLDER", id, archived }),
      addRight: (right, endPrevious) => dispatch({ type: "ADD_RIGHT", right, endPrevious }),
      endRight: (id, endedAt, reason, actor) =>
        dispatch({ type: "END_RIGHT", id, endedAt, reason, actor }),
      cancelRight: (id, reason) => dispatch({ type: "CANCEL_RIGHT", id, reason }),
      createDay: (day, planFromSchedule, entries) =>
        dispatch({ type: "CREATE_DAY", day, planFromSchedule, entries }),
      updateDay: (id, patch) => dispatch({ type: "UPDATE_DAY", id, patch }),
      setDayStatus: (id, status, actor) =>
        dispatch({ type: "SET_DAY_STATUS", id, status, actor }),
      closeDay: (id, actor) => dispatch({ type: "CLOSE_DAY", id, actor }),
      reopenDay: (id, actor, reason) => dispatch({ type: "REOPEN_DAY", id, actor, reason }),
      archiveDay: (id, archived) => dispatch({ type: "ARCHIVE_DAY", id, archived }),
      createRound: (round, dates) => dispatch({ type: "CREATE_ROUND", round, dates }),
      archiveRound: (id, archived) => dispatch({ type: "ARCHIVE_ROUND", id, archived }),
      saveEntry: (entry, isNew) => dispatch({ type: "SAVE_ENTRY", entry, isNew }),
      saveEntries: (dayId, entries) => dispatch({ type: "SAVE_ENTRIES", dayId, entries }),
      moveEntry: (id, dir) => dispatch({ type: "MOVE_ENTRY", id, dir }),
      deriveEntries: (dayId) => dispatch({ type: "DERIVE_ENTRIES", dayId }),
      removeEntry: (id) => dispatch({ type: "REMOVE_ENTRY", id }),
      recordUsage: (input) => dispatch({ type: "RECORD_USAGE", ...input }),
      setUsageSettlement: (usageId, input) =>
        dispatch({ type: "SET_USAGE_SETTLEMENT", usageId, ...input }),
      voidUsage: (id, reason, actor) => dispatch({ type: "VOID_USAGE", id, reason, actor }),
      saveStoppage: (stoppage, isNew) => dispatch({ type: "SAVE_STOPPAGE", stoppage, isNew }),
      archiveStoppage: (id, archived) => dispatch({ type: "ARCHIVE_STOPPAGE", id, archived }),
      saveFuel: (record, isNew) => dispatch({ type: "SAVE_FUEL", record, isNew }),
      archiveFuel: (id, archived) => dispatch({ type: "ARCHIVE_FUEL", id, archived }),
      saveOperator: (record, isNew) => dispatch({ type: "SAVE_OPERATOR", record, isNew }),
      archiveOperator: (id, archived) => dispatch({ type: "ARCHIVE_OPERATOR", id, archived }),
      addTransaction: (tx) => dispatch({ type: "ADD_TRANSACTION", tx }),
      correctTransaction: (id, newAmount, reason, actor) =>
        dispatch({ type: "CORRECT_TRANSACTION", id, newAmount, reason, actor }),
      voidTransaction: (id, reason, actor) =>
        dispatch({ type: "VOID_TRANSACTION", id, reason, actor }),
      savePersonal: (record, isNew) => dispatch({ type: "SAVE_PERSONAL", record, isNew }),
      archivePersonal: (id, archived) => dispatch({ type: "ARCHIVE_PERSONAL", id, archived }),
      settle: (settlement, personalRecordId, officialUsageId, adjustmentTx) =>
        dispatch({ type: "SETTLE", settlement, personalRecordId, officialUsageId, adjustmentTx }),
      ackConflict: (ack) => dispatch({ type: "ACK_CONFLICT", ack }),
      readNotifications: (ids) => dispatch({ type: "READ_NOTIFICATIONS", ids }),
      clearNotifications: () => dispatch({ type: "CLEAR_NOTIFICATIONS" }),
      setTheme: (theme) => dispatch({ type: "SET_THEME", theme }),
      markSynced: () => dispatch({ type: "MARK_SYNCED" }),
      reset: () => dispatch({ type: "RESET" }),
      seedDemo: () => dispatch({ type: "SEED_DEMO" }),
      importState: (state) => dispatch({ type: "IMPORT", state }),
    }),
    []
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { STORAGE_KEY, nowTime, todayISO, personBalance };
