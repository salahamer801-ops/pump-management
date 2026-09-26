/**
 * معرّفات محلية تُولَّد في المتصفح (بلا خادم): تُستخدم لتسمية العناصر قبل حفظها
 * على الخادم. لا علاقة لها بالمصادقة ولا بالصلاحيات.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/** رقم تعريف مضخة محلي بصيغة الخادم (PMP-XXXXXX) — يُستبدل برقم الخادم عند التسجيل */
export function generatePumpCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "PMP-";
  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
