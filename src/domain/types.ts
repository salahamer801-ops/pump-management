/**
 * نموذج البيانات — نظام تنظيم المضخات (الإصدار 2)
 * ---------------------------------------------------
 * القاعدة الذهبية: لا استبدال — ربط. لا حذف للتاريخ — تسجيل للتعديل.
 * كل علاقة تعتمد على معرّف (ID) لا على الاسم.
 */

export type ID = string;

export type Currency = "YER" | "SAR" | "USD";
export type EnergyType = "solar" | "diesel" | "hybrid";
export type Theme = "light" | "dark";
export type Language = "ar" | "en";

export type FuelCalcMode = "hour" | "cycle";
export type RoyaltyMode = "cycle" | "hour";

/* ------------------------------- المضخة ------------------------------- */

export interface Pump {
  id: ID;
  name: string;
  wells: string;
  farm: string;
  engine: string;
  energyType: EnergyType;
  workStart: string;
  workEnd: string;
  /** لتر لكل ساعة تشغيل */
  fuelConsumptionPerHour: number;
  /** لتر لكل ديالة كاملة */
  fuelPerCycle: number;
  fuelCalcMode: FuelCalcMode;
  /** سعر اللتر المرجعي لدى المسؤول (ليس إلزاميًا على المستخدم) */
  fuelPrice: number;
  royaltyEnabled: boolean;
  royaltyMode: RoyaltyMode;
  royaltyPerCycle: number;
  royaltyPerHour: number;
  operatorName: string;
  operatorHourlyWage: number;
  operatorStart: string;
  operatorEnd: string;
  shareUnit: string;
  currency: Currency;
  notes: string;
  archived: boolean;
  createdAt: string;
}

/* ------------------------------ الأشخاص ------------------------------- */

export interface Person {
  id: ID;
  name: string;
  phone: string;
  nationalId: string;
  notes: string;
  /** أُضيف من داخل اليوم الفعلي ولم تُسجَّل له مساهمة أو حق */
  guest: boolean;
  archived: boolean;
  createdAt: string;
  createdBy: string;
}

/**
 * حالة استخدام السهم عند المساهم الأساسي:
 * مستمر = يستخدمه بنفسه · مؤاجر · مناقل (نقل/تنازل) · بايع
 * المساهم الأساسي يبقى ثابتًا في كل الحالات — الحالة تصف مَن يستخدم السهم الآن.
 */
export type ShareholderUseStatus = "continuing" | "rented" | "transferred" | "sold";

/** المساهم الأساسي — سجل مرجعي داخل المضخة */
export interface Shareholder {
  id: ID;
  pumpId: ID;
  personId: ID;
  shareNo: number;
  /** عدد الحصص الأساسية */
  units: number;
  /** الساعات الأساسية للمساهم */
  baseHoursMin: number;
  /** ترتيب الدور الأساسي */
  baseOrder: number;
  startDate: string;
  endDate: string | null;
  status: "active" | "suspended" | "ended";
  /* --- حالة استخدام السهم: مستمر / مؤاجر / مناقل / بايع --- */
  useStatus: ShareholderUseStatus;
  /** الطرف الآخر: المستأجر أو المالك الجديد أو المتنازل له */
  counterpartPersonId: ID | null;
  /** رقم هاتف الطرف الآخر كما أُدخل */
  counterpartPhone: string;
  /** تاريخ تسجيل الحالة */
  useStatusAt: string;
  useStatusNote: string;
  notes: string;
  archived: boolean;
  createdAt: string;
}

export type RightKind =
  | "rent"
  | "gift"
  | "transfer"
  | "loan"
  | "move_pump"
  | "inherit"
  | "return";

/** الحق والتحويلات — تاريخ كامل لا يُستبدل */
export interface ShareRight {
  id: ID;
  pumpId: ID;
  shareholderId: ID;
  /** المساهم الأساسي أو صاحب الحق السابق */
  fromPersonId: ID | null;
  /** صاحب الحق بعد هذه العملية */
  holderPersonId: ID;
  kind: RightKind;
  /** كل السهم أو جزء منه (بالدقائق) */
  hoursMin: number;
  amount: number;
  agreement: string;
  startedAt: string;
  endedAt: string | null;
  toPumpId: ID | null;
  status: "active" | "ended" | "cancelled";
  notes: string;
  /** العملية السابقة في نفس السهم — لبناء السلسلة */
  parentId: ID | null;
  createdAt: string;
  createdBy: string;
}

/* --------------------------- الديالات والأيام -------------------------- */

export type DayStatus =
  | "scheduled"
  | "draft"
  | "in_progress"
  | "completed"
  | "closed"
  | "revised";

/**
 * الديالة — دورة/مرحلة دوران لها يوم بداية وعدد أيام،
 * وتاريخ النهاية يُحسب من عدد الأيام المُدخل.
 */
export interface DialaRound {
  id: ID;
  pumpId: ID;
  /** رقم الديالة المتسلسل */
  number: number;
  /** YYYY-MM-DD — يوم بداية الديالة */
  startDate: string;
  /** عدد أيام الديالة كما أدخلها المستخدم */
  days: number;
  /** YYYY-MM-DD — يُحسب: البداية + (عدد الأيام − 1) */
  endDate: string;
  notes: string;
  createdAt: string;
  createdBy: string;
  archived: boolean;
}

export interface DialaDay {
  id: ID;
  pumpId: ID;
  dialaNumber: number;
  /** الديالة (الدورة) التي ينتمي إليها هذا اليوم — إن وُجدت */
  roundId?: ID | null;
  /** YYYY-MM-DD */
  date: string;
  status: DayStatus;
  workStart: string;
  workEnd: string;
  capacityMin: number;
  notes: string;
  openedBy: string;
  closedBy: string;
  closedAt: string;
  reopenedBy: string;
  reopenedAt: string;
  reopenReason: string;
  /** عدد مرات إعادة الفتح / التصحيح */
  revision: number;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export type EntryRole = "shareholder" | "right_holder" | "tenant" | "guest" | "other";
export type EntryStatus = "planned" | "done" | "cancelled" | "postponed";

/** ترتيب اليوم الفعلي — لا يغيّر الجدول الأساسي */
export interface DayEntry {
  id: ID;
  dayId: ID;
  pumpId: ID;
  orderIndex: number;
  personId: ID;
  role: EntryRole;
  shareholderId: ID | null;
  rightId: ID | null;
  startTime: string;
  endTime: string;
  plannedMin: number;
  /** المستخدم الفعلي إذا اختلف عن صاحب الدور */
  actualPersonId: ID | null;
  usageId: ID | null;
  status: EntryStatus;
  postponeToDayId: ID | null;
  reason: string;
  notes: string;
  createdAt: string;
  createdBy: string;
  archived: boolean;
}

/* ---------------------------- الاستخدام الفعلي -------------------------- */

export type UsageType = "share" | "rental" | "loan" | "purchase" | "extra" | "guest";

/** هل سدّد المستخدم قيمة الديزل أم لا أم هناك نقص؟ */
export type DieselSettlement = "paid" | "shortage" | "unpaid";

/** سداد رسوم الرواسة: نقد أو أجل */
export type RoyaltyPayMode = "cash" | "credit";

export interface ActualUsage {
  id: ID;
  pumpId: ID;
  dayId: ID;
  entryId: ID | null;
  /** من أخذ الماء فعليًا */
  personId: ID;
  /** صاحب الحق وقت الاستخدام */
  rightHolderId: ID | null;
  shareholderId: ID | null;
  date: string;
  startTime: string;
  endTime: string;
  minutes: number;
  crossesMidnight: boolean;
  usageType: UsageType;
  /* Snapshot للقيم وقت العملية */
  fuelPerHourSnapshot: number;
  fuelLiters: number;
  fuelPriceSnapshot: number;
  fuelAmountDue: number;
  royaltyHourlySnapshot: number;
  royaltyAmountDue: number;
  /* حالة التسديد — كل خيار له أثر مالي مختلف */
  dieselSettlement: DieselSettlement;
  /** نقص الديزل باللتر (عند اختيار «نقص») */
  dieselShortageLiters: number;
  royaltyPayMode: RoyaltyPayMode;
  settlementNote: string;
  overCapacity: boolean;
  overCapacityReason: string;
  notes: string;
  status: "active" | "void";
  createdAt: string;
  createdBy: string;
}

/* ------------------------- التوقفات والوقود والرواسة --------------------- */

export type StoppageKind =
  | "breakdown"
  | "rain"
  | "fuel_shortage"
  | "planned"
  | "unplanned"
  | "temporary";

export interface Stoppage {
  id: ID;
  pumpId: ID;
  dayId: ID | null;
  date: string;
  startTime: string;
  endTime: string;
  minutes: number;
  kind: StoppageKind;
  reason: string;
  notes: string;
  createdAt: string;
  createdBy: string;
  archived: boolean;
}

export interface FuelRecord {
  id: ID;
  pumpId: ID;
  dayId: ID | null;
  date: string;
  hoursRun: number;
  litersPerHour: number;
  liters: number;
  shortageLiters: number;
  fuelPrice: number;
  notes: string;
  createdAt: string;
  createdBy: string;
  archived: boolean;
}

export interface OperatorRecord {
  id: ID;
  pumpId: ID;
  dayId: ID | null;
  date: string;
  operatorName: string;
  hourlyWage: number;
  startTime: string;
  endTime: string;
  minutes: number;
  dueAmount: number;
  notes: string;
  createdAt: string;
  createdBy: string;
  archived: boolean;
}

/* -------------------------------- المالية ------------------------------ */

export type TxKind =
  | "fuel"
  | "royalty"
  | "payment"
  | "debt"
  | "loan"
  | "advance"
  | "postpone_fee"
  | "operators"
  | "correction"
  | "other";

/** credit = له / دفع ، debit = عليه / استحقاق */
export type TxDirection = "debit" | "credit";

export interface Transaction {
  id: ID;
  pumpId: ID;
  kind: TxKind;
  direction: TxDirection;
  personId: ID | null;
  shareholderId: ID | null;
  dayId: ID | null;
  usageId: ID | null;
  operatorRecordId: ID | null;
  fuelRecordId: ID | null;
  /** موجبة دائمًا — الاتجاه يحدد الإشارة */
  amount: number;
  date: string;
  reason: string;
  status: "posted" | "void";
  correctsTxId: ID | null;
  notes: string;
  source: "manager" | "user";
  createdAt: string;
  createdBy: string;
}

/* --------------------------- السجل الشخصي والتسوية ---------------------- */

export type MatchStatus =
  | "matched"
  | "different"
  | "personal_only"
  | "official_only"
  | "under_review"
  | "settled";

export type PersonalOpType =
  | "usage"
  | "payment"
  | "debt"
  | "loan"
  | "advance"
  | "other";

export interface PersonalRecord {
  id: ID;
  personId: ID;
  pumpId: ID | null;
  dayId: ID | null;
  date: string;
  startTime: string;
  endTime: string;
  minutes: number;
  dieselLiters: number;
  dieselPricePerLiter: number;
  dieselAmount: number;
  royaltyAmount: number;
  paidAmount: number;
  debtAmount: number;
  operationType: PersonalOpType;
  notes: string;
  matchStatus: MatchStatus;
  /** حذف ناعم — لا يُفقد التاريخ */
  archived?: boolean;
  createdAt: string;
}

export interface Settlement {
  id: ID;
  pumpId: ID;
  personId: ID;
  dayId: ID | null;
  officialUsageId: ID | null;
  personalRecordId: ID | null;
  officialMinutes: number;
  personalMinutes: number;
  minutesDiff: number;
  officialAmount: number;
  personalAmount: number;
  amountDiff: number;
  decision: string;
  notes: string;
  byUser: string;
  at: string;
}

export type DayIssueSeverity = "warn" | "error";

export type ConflictKind =
  | "overlap"
  | "over_capacity"
  | "duplicate"
  | "official_personal"
  | "guest_relation";

export interface ConflictAck {
  id: ID;
  pumpId: ID;
  dayId: ID | null;
  kind: ConflictKind;
  key: string;
  reason: string;
  byUser: string;
  at: string;
}

/* ---------------------- الإشعارات والتدقيق والمزامنة -------------------- */

export interface AppNotification {
  id: ID;
  at: string;
  kind:
    | "turn_soon"
    | "turn_changed"
    | "turn_postponed"
    | "difference"
    | "debt"
    | "payment"
    | "stoppage"
    | "day_edited"
    | "settlement";
  level: "info" | "warn" | "danger";
  title: string;
  body: string;
  personId: ID | null;
  dayId: ID | null;
  read: boolean;
}

export interface AuditLog {
  id: ID;
  at: string;
  actor: string;
  actorRole: "manager" | "user" | "system";
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  before: string;
  after: string;
  reason: string;
  deviceId: string;
  synced: boolean;
}

export interface SyncItem {
  id: ID;
  at: string;
  entity: string;
  entityId: string;
  op: "create" | "update" | "delete";
  summary: string;
  status: "pending" | "synced" | "conflict";
  conflictNote: string;
}

/* -------------------- أسماء الإصدار الأول (للترحيل فقط) ----------------- */

export interface PumpV1 {
  name: string;
  energyType: EnergyType;
  wells: string;
  farm: string;
  notes: string;
  workStart: string;
  workEnd: string;
  hasRoyalty: boolean;
  royaltyMode: RoyaltyMode;
  royaltyPerCycle: number;
  royaltyPerHour: number;
  currency: Currency;
  fuelPrice: number;
  fuelConsumptionPerHour: number;
  fuelPerCycle: number;
  fuelCalcMode: FuelCalcMode;
  shareMode: "whole" | "fraction";
  shareUnit: string;
}

export interface ContributorV1 {
  id: string;
  name: string;
  phone: string;
  shares: number;
  notes: string;
  archived: boolean;
  createdAt: string;
}

export interface TurnV1 {
  id: string;
  cycleId: string;
  contributorId: string;
  order: number;
  durationMin: number;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  fuelDue: number;
  fuelPaid: number;
  fuelPaidDate: string;
  royaltyDue: number;
  royaltyPaid: number;
  royaltyPaidDate: string;
  note: string;
  status: "waiting" | "in_progress" | "completed" | "postponed";
}

export interface CycleV1 {
  id: string;
  number: number;
  createdAt: string;
  workStart: string;
  workEnd: string;
  totalShares: number;
  totalDurationMin: number;
  fuelPriceSnapshot: number;
  royaltySnapshot: number;
  turns: TurnV1[];
  archived: boolean;
}

export interface OtherChargeV1 {
  id: string;
  contributorId: string;
  label: string;
  amount: number;
  paid: number;
  date: string;
}

/* -------------------------------- الحالة ------------------------------- */

export interface AppSettings {
  theme: Theme;
  language: Language;
  deviceId: string;
  lastSyncAt: string;
}

export interface AppState {
  version: 2;
  pump: Pump | null;
  persons: Person[];
  shareholders: Shareholder[];
  rights: ShareRight[];
  rounds: DialaRound[];
  days: DialaDay[];
  entries: DayEntry[];
  usages: ActualUsage[];
  stoppages: Stoppage[];
  fuelRecords: FuelRecord[];
  operatorRecords: OperatorRecord[];
  transactions: Transaction[];
  personalRecords: PersonalRecord[];
  settlements: Settlement[];
  conflictAcks: ConflictAck[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  syncQueue: SyncItem[];
  settings: AppSettings;
  counters: { diala: number; round: number };
}
