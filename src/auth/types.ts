export type AccountType = "manager" | "user";

export type MembershipType =
  | "shareholder"
  | "rightHolder"
  | "actualUser"
  | "viewer"
  | "accountant"
  | "pumpOperator";

export type MembershipStatus = "pending" | "approved" | "rejected" | "removed";

export interface AccountUser {
  id: string;
  name: string;
  phone: string;
  accountType: AccountType;
  status: "active" | "suspended";
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ManagedPump {
  id: string;
  /** رقم تعريف المضخة الثابت (PMP-XXXXXX) */
  pumpCode: string;
  name: string;
  description: string;
  location: string;
  /** معرّف حساب المسؤول المالك للمضخة */
  managerId: string;
  status: string;
  createdAt: string;
  membersCount: number;
  pendingCount: number;
}

export interface Membership {
  id: string;
  pumpId: string;
  pumpCode: string;
  pumpName: string | null;
  pumpLocation?: string | null;
  managerName?: string | null;
  membershipType: MembershipType;
  status: MembershipStatus;
  personId: string | null;
  personName: string;
  shareRef: string;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason?: string;
  removedAt: string | null;
  removeReason?: string;
}

export interface MemberRow extends Membership {
  user: { id: string; name: string; phoneMasked: string; accountType?: AccountType };
}

export interface AuditRow {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  pumpId: string | null;
  source: string;
  metadata: Record<string, unknown>;
}

export interface AuthSession {
  user: AccountUser;
  managedPumps: ManagedPump[];
  memberships: Membership[];
  pendingRequests: number;
}

export type AuthResponse = AuthSession & { token: string };

export const MEMBERSHIP_LABEL: Record<MembershipType, string> = {
  shareholder: "مساهم أساسي",
  rightHolder: "صاحب حق",
  actualUser: "مستخدم فعلي",
  viewer: "مشاهد فقط",
  accountant: "محاسب",
  pumpOperator: "مشغّل المضخة",
};

export const STATUS_LABEL: Record<MembershipStatus, string> = {
  pending: "بانتظار موافقة المسؤول",
  approved: "مرتبط ومعتمد",
  rejected: "مرفوض",
  removed: "أُزيل الارتباط",
};

export const ACTION_LABEL: Record<string, string> = {
  "account.create": "إنشاء حساب",
  "account.update": "تعديل حساب",
  "auth.login": "تسجيل دخول",
  "auth.logout": "تسجيل خروج",
  "auth.login_failed": "محاولة دخول فاشلة",
  "password.change": "تغيير كلمة المرور",
  "password.reset_request": "طلب استعادة كلمة المرور",
  "password.reset_request_failed": "طلب استعادة غير مطابق",
  "password.reset": "استعادة كلمة المرور",
  "password.reset_failed": "رمز استعادة خاطئ",
  "pump.create": "إنشاء مضخة",
  "pump.update": "تعديل بيانات المضخة",
  "membership.request": "طلب ربط بمضخة",
  "membership.approve": "قبول طلب ربط",
  "membership.reject": "رفض طلب ربط",
  "membership.update": "تغيير صلاحية/ربط شخص",
  "membership.remove": "إزالة مستخدم من المضخة",
};
