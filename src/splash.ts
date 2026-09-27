/**
 * شاشة البدء (index.html) — عنصر ثابت يرسم فورًا قبل تحميل التطبيق.
 * تُخفى مرة واحدة بعد أن يصبح التطبيق جاهزًا (أو بعد مدة الاحتياط داخل index.html).
 * لا تعتمد على أي مكتبة، والملف الوحيد الذي تُحمّله هو شعار صغير (44KB) محفوظ في الكاش.
 */

/** لون شريط المتصفح بعد انتهاء شاشة البدء (لون التطبيق) */
const APP_THEME_COLOR = "#059669";
/** أقل مدة تظهر فيها الشاشة حتى لا يكون ظهورها وميضًا مزعجًا */
const MIN_VISIBLE_MS = 650;
/** مدة التلاشي — يجب أن تطابق قيمة transition في index.html */
const FADE_MS = 400;

const startedAt =
  typeof performance !== "undefined" ? performance.now() : Date.now();

let finished = false;

export function hideSplash(): void {
  if (finished || typeof document === "undefined") return;
  finished = true;

  const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (theme) theme.content = APP_THEME_COLOR;

  const el = document.getElementById("app-splash");
  if (!el) return;

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const wait = Math.max(0, MIN_VISIBLE_MS - (now - startedAt));

  window.setTimeout(() => {
    el.classList.add("is-hiding");
    window.setTimeout(() => {
      el.classList.add("is-gone");
      el.remove(); // لا يبقى أي عنصر ثابت فوق التطبيق
    }, FADE_MS);
  }, wait);
}
