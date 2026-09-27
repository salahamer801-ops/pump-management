/**
 * تثبيت التطبيق على الجوال (PWA).
 * المتصفح يعلن جاهزية التثبيت مرة واحدة عند فتح الصفحة، وربما قبل أن يصل المستخدم
 * إلى الإعدادات — لذلك يُلتقط الحدث هنا عند إقلاع التطبيق ويُحتفظ به للاستخدام لاحقًا.
 */

type InstallChoice = { outcome: "accepted" | "dismissed" };

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    /* نوقف الشريط الافتراضي ونعرض الزر داخل الإعدادات بدلًا منه */
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** هل يوجد طلب تثبيت جاهز من المتصفح؟ */
export function getInstallPrompt(): InstallPromptEvent | null {
  return deferred;
}

/** متابعة تغيّر جاهزية التثبيت (لإظهار الزر أو التعليمات) */
export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** فتح نافذة التثبيت الأصلية في المتصفح */
export async function runInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  await event.prompt();
  const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" as const }));
  deferred = null;
  notify();
  return choice.outcome === "accepted" ? "accepted" : "dismissed";
}

/** هل التطبيق يعمل الآن كتطبيق مثبَّت (لا داخل تبويب متصفح)؟ */
export function isStandalone(): boolean {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    return (window.navigator as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}
