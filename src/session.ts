/**
 * الجلسة الحقيقية تُدار على الخادم (رمز الجلسة مخزَّن مُهشَّرًا في قاعدة البيانات).
 * هنا فقط: أي مضخة يعمل عليها المسؤول الآن، وتنظيف بقايا الجلسات القديمة.
 */

const ACTIVE_PUMP_KEY = "pump-org-active-pump-v1";
const LEGACY_SESSION_KEY = "pump-org-session-v1";

/** مفاتيح كانت تُخزّن حسابات الوضع المحلي في المتصفح (وضع محذوف — لا تُقرأ الآن) */
const LOCAL_MODE_AUTH_KEYS = ["pump_users", "pump_session", "pump_audit_log"];

export function loadActivePumpId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PUMP_KEY);
  } catch {
    return null;
  }
}

export function saveActivePumpId(id: string | null): void {
  try {
    if (!id) localStorage.removeItem(ACTIVE_PUMP_KEY);
    else localStorage.setItem(ACTIVE_PUMP_KEY, id);
  } catch {
    /* ignore */
  }
}

/** الجلسة القديمة كانت باسم فقط — لا تُعتبر هوية، وتُزال */
export function clearLegacySession(): void {
  try {
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * يزيل بقايا حسابات الوضع المحلي (كانت كلمات مرور وجلسة وسجلًا في المتصفح فقط).
 * لا يمسّ بيانات التشغيل المحفوظة على الجهاز ولا نسخ البيانات الرسمية.
 */
export function clearLocalModeAuth(): void {
  try {
    for (const key of LOCAL_MODE_AUTH_KEYS) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
