/**
 * قراءة/كتابة بيانات المسؤول من داخل تطبيق المستخدم (نفس الجهاز).
 * المستخدم لا يعدّل السجل الرسمي — يقرأه فقط، ويكتب سجله الشخصي كسجل مستقل.
 */
import type { AppState, AuditLog, PersonalRecord, SyncItem } from "./types";
import { uid } from "./util";

export const MANAGER_STORAGE_KEY = "pump-org-state-v2";
export const LEGACY_MANAGER_STORAGE_KEY = "pump-organization-state-v1";
export const USER_LINK_KEY = "pump-org-user-link-v1";

/**
 * بيانات كل مضخة منفصلة بمفتاحها — المضخة التي يديرها المسؤول معرّفها الحقيقي
 * من الخادم (pumpId)، لا الاسم.
 */
export function managerStorageKey(pumpId?: string | null): string {
  return pumpId ? `${MANAGER_STORAGE_KEY}::${pumpId}` : MANAGER_STORAGE_KEY;
}

export function readManagerState(pumpId?: string | null): AppState | null {
  try {
    const raw = pumpId ? localStorage.getItem(managerStorageKey(pumpId)) : null;
    const fallback = raw ?? localStorage.getItem(MANAGER_STORAGE_KEY);
    if (!fallback) return null;
    const parsed = JSON.parse(fallback) as AppState;
    const version = (parsed as { version?: number } | null)?.version;
    if (!parsed || (version !== 2 && version !== 3)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeManagerState(state: AppState, pumpId?: string | null): void {
  try {
    localStorage.setItem(managerStorageKey(pumpId ?? state.pump?.id ?? null), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** يضيف سجلًا شخصيًا (من المستخدم) إلى النظام المشترك مع تسجيل تدقيق وقائمة مزامنة */
export function appendPersonalRecord(
  record: PersonalRecord,
  actor: string,
  pumpId?: string | null
): boolean {
  const state = readManagerState(pumpId);
  if (!state) return false;
  const audit: AuditLog = {
    id: uid("lg"),
    at: new Date().toISOString(),
    actor,
    actorRole: "user",
    action: "create",
    entity: "personal_record",
    entityId: record.id,
    summary: `سجل شخصي من المستخدم: ${actor} — ${record.date} (${Math.round(record.minutes)} دقيقة)`,
    before: "",
    after: JSON.stringify({
      minutes: record.minutes,
      liters: record.dieselLiters,
      paid: record.paidAmount,
    }),
    reason: "",
    deviceId: state.settings.deviceId,
    synced: false,
  };
  const sync: SyncItem = {
    id: uid("sq"),
    at: new Date().toISOString(),
    entity: "personal_record",
    entityId: record.id,
    op: "create",
    summary: audit.summary,
    status: "pending",
    conflictNote: "",
  };
  writeManagerState(
    {
      ...state,
      personalRecords: [...state.personalRecords, record],
      auditLogs: [audit, ...state.auditLogs].slice(0, 800),
      syncQueue: [sync, ...state.syncQueue].slice(0, 500),
      notifications: [
        {
          id: uid("nt"),
          at: new Date().toISOString(),
          kind: "difference" as const,
          level: "info" as const,
          title: "سجل شخصي جديد",
          body: `${actor} سجّل استخدامًا شخصيًا بتاريخ ${record.date} (${Math.round(record.minutes)} دقيقة) — قارنه بالسجل الرسمي.`,
          personId: record.personId,
          dayId: record.dayId,
          read: false,
        },
        ...state.notifications,
      ].slice(0, 200),
    },
    pumpId
  );
  return true;
}

/**
 * ارتباط الحساب بالشخص صار بموافقة المسؤول على الخادم (§21، §34) —
 * لم يبقَ ارتباط ذاتي محلي. هذه الدوال تُبقى للتنظيف فقط.
 */
export function clearLegacyUserLink(): void {
  try {
    localStorage.removeItem(USER_LINK_KEY);
  } catch {
    /* ignore */
  }
}
