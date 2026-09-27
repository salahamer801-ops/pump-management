import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cx } from "./ui";

/**
 * زر صغير أنيق لمشاركة التطبيق: يفتح نافذة المشاركة الأصلية في الجوال
 * (واتساب وغيره)، وإن لم تكن متاحة ينسخ الرابط بدلًا منها.
 * الرابط يُقرأ من عنوان الصفحة نفسه — يعمل مع أي دومين بلا تعديل.
 */
export default function ShareAppButton({
  t = (ar: string) => ar,
  className,
}: {
  /** دالة الترجمة (للشاشات التي فيها عربي/إنجليزي) */
  t?: (ar: string, en: string) => string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const appUrl = () => `${window.location.origin}/`;
  const shareTitle = () => t("تنظيم المضخات", "Pump Organization");
  const shareText = () =>
    t(
      "تطبيق تنظيم المضخات — إدارة حصص المياه الزراعية والديالات والحسابات",
      "Pump Organization app — manage agricultural water shares, cycles and accounts"
    );

  const copyLink = () => {
    const payload = `${shareText()} ${appUrl()}`;
    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(payload).then(() => flash());
        return;
      }
    } catch {
      /* ننتقل إلى الطريقة التالية */
    }
    try {
      const field = document.createElement("textarea");
      field.value = payload;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      document.body.removeChild(field);
      flash();
    } catch {
      window.prompt(t("انسخ الرابط", "Copy the link"), appUrl());
    }
  };

  const flash = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const share = async () => {
    /* مشاركة أصلية: واتساب · تيليجرام · رسائل … حسب جهاز المستخدم */
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareTitle(), text: shareText(), url: appUrl() });
        return;
      } catch {
        return; // أغلق المستخدم نافذة المشاركة — لا نُظهر أي رسالة
      }
    }
    copyLink();
  };

  return (
    <div className={cx("flex flex-col items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => void share()}
        aria-label={t("مشاركة التطبيق", "Share the app")}
        data-testid="share-app"
        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-extrabold text-emerald-700 shadow-sm shadow-emerald-600/5 backdrop-blur transition hover:border-emerald-300 hover:bg-emerald-50 active:scale-[0.97] dark:border-slate-600 dark:bg-slate-800/80 dark:text-emerald-300 dark:hover:bg-slate-700"
      >
        {copied ? <Check size={14} /> : <Share2 size={14} />}
        {copied ? t("تم نسخ الرابط", "Link copied") : t("شارك التطبيق", "Share the app")}
      </button>
      {copied ? (
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400" role="status">
          {t("الصق الرابط في واتساب أو أي تطبيق", "Paste the link in WhatsApp or anywhere")}
        </span>
      ) : null}
    </div>
  );
}
