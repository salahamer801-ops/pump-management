export interface ShareholderPump {
  id: string;
  name: string;
  dailyHours: number; // ساعات التشغيل اليومية
  dieselPerHour: number; // لتر ديزل لكل ساعة
  dieselPricePerLiter: number; // سعر لتر الديزل بالريال اليمني
  startTime: string; // وقت التشغيل (HH:MM)
  royaltyName: string; // اسم الرواس
  royaltyCost: number; // تكلفة الرواسة بالريال
  myShares: number; // أسهمي (وصفي)
  totalShares: number; // إجمالي أسهم المضخة (وصفي)
  notes: string;
  archived: boolean;
  createdAt: string;
}

export type LendDirection = "lend" | "borrow"; // سلفت / تسلفت
export type LendUnit = "hour" | "cycle"; // ساعة / دور كامل

export interface ShareholderTurn {
  id: string;
  cycleId: string;
  pumpId: string;
  dayIndex: number; // اليوم في الدياله (يبدأ من 1)
  date: string; // ISO date
  hours: number; // ساعات دوري (يدوي)
  startTime: string;
  endTime: string;
  dieselLiters: number; // محسوب
  dieselCost: number; // محسوب (لتر × سعر)
  direction: LendDirection | null; // سلفة / تسلفة
  lendUnit: LendUnit | null;
  lendQty: number; // كم ساعة أو كم دور
  lendCost: number; // قيمة السلفة/التسلفة بالديزل
  royaltyPaid: boolean; // سددت؟ (true) / أجل (false)
  note: string;
  createdAt: string;
}

export interface ShareholderCycle {
  id: string;
  pumpId: string;
  name: string; // من 1 ديسمبر إلى 17 ديسمبر
  startDate: string; // ISO date
  days: number;
  createdAt: string;
  archived: boolean;
}

export type DayShareType = "owned" | "purchase" | "loan"; // ملك / شراء / سلف

export interface DayContributor {
  id: string;
  cycleId: string;
  pumpId: string;
  dayIndex: number;
  name: string;
  hours: number; // نصيبه من اليوم بالساعات
  startTime: string; // من الساعة
  endTime: string; // إلى الساعة
  dieselPaid: boolean; // سدد الديزل
  royaltyPaid: boolean; // سدد الرواسة
  shareType: DayShareType; // ملك / شراء / سلف
  note: string;
  createdAt: string;
}

export interface ShareholderEntry {
  id: string;
  at: string;
  text: string;
}

export interface ShareholderProfile {
  name: string;
  phone: string;
  farm: string;
  notes: string;
}

export type Theme = "light" | "dark";
export type Language = "ar" | "en";

export interface ShareholderSettings {
  theme: Theme;
  language: Language;
}

export interface ShareholderState {
  profile: ShareholderProfile;
  settings: ShareholderSettings;
  pumps: ShareholderPump[];
  cycles: ShareholderCycle[];
  turns: ShareholderTurn[];
  dayContributors: DayContributor[];
  history: ShareholderEntry[];
}
