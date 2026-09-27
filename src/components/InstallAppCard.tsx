import { useEffect, useState } from "react";
import { Check, Download, Share, Smartphone } from "lucide-react";
import { Button, Card, cx } from "./ui";
import { getInstallPrompt, isStandalone, runInstallPrompt, subscribeInstall } from "../lib/install";

/**
 * بطاقة تثبيت التطبيق على الجوال — عُنصر إعدادات عادي في كل التطبيقات.
 * تُظهر زر التثبيت الأصلي حين يسمح المتصفح، وإلا خطوة واحدة مكتوبة لكل جهاز.
 */
export default function InstallAppCard({
  t = (ar: string) => ar,
  bare = false,
}: {
  /** دالة الترجمة (شاشات فيها عربي/إنجليزي) */
  t?: (ar: string, en: string) => string;
  /** بلا بطاقة خارجية — للاستخدام داخل بطاقة قائمة */
  bare?: boolean;
}) {
  const [installed, setInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const sync = () => {
      setInstalled(isStandalone());
      setCanInstall(Boolean(getInstallPrompt()));
    };
    sync();
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    const unsubscribe = subscribeInstall(sync);
    const media = window.matchMedia("(display-mode: standalone)");
    const onChange = () => sync();
    media.addEventListener?.("change", onChange);
    return () => {
      unsubscribe();
      media.removeEventListener?.("change", onChange);
    };
  }, []);

  const install = async () => {
    setBusy(true);
    setNote("");
    const result = await runInstallPrompt();
    setBusy(false);
    if (result === "accepted") {
      setNote(t("جارٍ التثبيت على جهازك…", "Installing on your device…"));
      return;
    }
    if (result === "dismissed") {
      setNote(t("لم تكتمل عملية التثبيت.", "Installation was not completed."));
      return;
    }
    setCanInstall(false);
    setNote(
      t(
        "افتح التطبيق من متصفح الجوال ثم اختر «تثبيت التطبيق» من قائمة المتصفح.",
        "Open the app in your phone browser, then choose “Install app” from the browser menu."
      )
    );
  };

  const content = (
    <>
      <div className="flex items-center gap-2">
        <Smartphone size={16} className="text-emerald-600" />
        <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">
          {t("تطبيق الجوال", "Mobile app")}
        </h2>
        {installed ? (
          <span className="mr-auto">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Check size={11} /> {t("مثبَّت", "Installed")}
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <img
          src="/icons/icon-192.png"
          width={44}
          height={44}
          alt=""
          loading="lazy"
          className="h-11 w-11 shrink-0 rounded-2xl border border-gray-100 shadow-sm dark:border-slate-700"
        />
        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-slate-300">
          {installed
            ? t(
                "التطبيق مثبَّت على هذا الجهاز ويفتح من أيقونته مباشرة.",
                "The app is installed on this device and opens from its own icon."
              )
            : t(
                "ثبّت التطبيق على شاشة جوالك: أيقونة خاصة ويفتح ملء الشاشة بلا متصفح.",
                "Install it on your phone's home screen: its own icon, opened full screen without a browser."
              )}
        </p>
      </div>

      {installed ? null : canInstall ? (
        <Button className="w-full" onClick={() => void install()} disabled={busy} data-testid="install-app">
          <Download size={16} /> {t("تثبيت التطبيق", "Install app")}
        </Button>
      ) : (
        <div className="space-y-1.5 rounded-2xl bg-gray-50 px-3 py-2.5 text-[11px] leading-relaxed text-gray-600 dark:bg-slate-700/60 dark:text-slate-300">
          <p className={cx("flex items-start gap-1.5", isIOS && "font-bold text-gray-800 dark:text-white")}>
            <Share size={12} className="mt-0.5 shrink-0" />
            <span>
              {t("آيفون: زر المشاركة", "iPhone: the Share button")} →{" "}
              {t("«إضافة إلى الشاشة الرئيسية»", "“Add to Home Screen”")}
            </span>
          </p>
          <p className={cx("flex items-start gap-1.5", !isIOS && "font-bold text-gray-800 dark:text-white")}>
            <span className="mt-0.5 shrink-0 font-black">⋮</span>
            <span>
              {t("أندرويد: قائمة المتصفح", "Android: browser menu")} →{" "}
              {t("«تثبيت التطبيق»", "“Install app”")}
            </span>
          </p>
        </div>
      )}

      {note ? (
        <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {note}
        </p>
      ) : null}
    </>
  );

  if (bare) return <div className="space-y-3">{content}</div>;
  return <Card className="space-y-3 p-4">{content}</Card>;
}
