import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Droplets,
  Home,
  Layers,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { ShareholderProvider, useShareholder } from "./store";
import { tr } from "./i18n";
import { cx } from "../components/ui";
import HomeScreen from "./screens/HomeScreen";
import PumpsScreen from "./screens/PumpsScreen";
import CyclesScreen from "./screens/CyclesScreen";
import TurnsScreen from "./screens/TurnsScreen";
import AccountsScreen from "./screens/AccountsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import OfficialScreen from "./screens/OfficialScreen";

type Tab = "home" | "pumps" | "cycles" | "turns" | "official" | "accounts" | "settings";

function Shell({
  onLogout,
  userName,
}: {
  onLogout: () => void;
  userName: string;
}) {
  const { state, actions } = useShareholder();
  const [tab, setTab] = useState<Tab>("home");
  const lang = state.settings.language;
  const t = (ar: string, en: string) => tr(lang, ar, en);

  // تطبيق الثيم واللغة على مستوى المستند
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", state.settings.theme === "dark");
    root.setAttribute("dir", lang === "en" ? "ltr" : "rtl");
    root.setAttribute("lang", lang === "en" ? "en" : "ar");
    return () => root.classList.remove("dark");
  }, [state.settings.theme, lang]);

  // نقل اسم الجلسة إلى الملف الشخصي عند أول دخول
  useEffect(() => {
    if (userName && !state.profile.name) {
      actions.setProfile({ ...state.profile, name: userName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: t("الرئيسية", "Home"), icon: <Home size={22} /> },
    { id: "pumps", label: t("المضخات", "Pumps"), icon: <Droplets size={22} /> },
    { id: "cycles", label: t("الدياله", "Cycles"), icon: <Layers size={22} /> },
    { id: "turns", label: t("دوري", "My Turn"), icon: <CalendarCheck size={22} /> },
    { id: "official", label: t("السجل الرسمي", "Official"), icon: <ShieldCheck size={22} /> },
    { id: "accounts", label: t("الحسابات", "Accounts"), icon: <Wallet size={22} /> },
    { id: "settings", label: t("الإعدادات", "Settings"), icon: <Settings size={22} /> },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-24">
      <header className="sticky top-0 z-30 border-b border-emerald-100/60 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-600/20">
              <Droplets size={18} />
            </div>
            <div>
              <div className="text-sm font-black leading-tight text-gray-900 dark:text-white">
                {t("مشروع تنظيم المضخات", "Pump Organization")}
              </div>
              <div className="text-xs text-gray-400 dark:text-slate-400">
                {state.profile.name || t("مساهم", "Member")}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {tab === "home" && (
          <HomeScreen onGoToPumps={() => setTab("pumps")} onGoToCycles={() => setTab("cycles")} />
        )}
        {tab === "pumps" && <PumpsScreen />}
        {tab === "cycles" && <CyclesScreen />}
        {tab === "turns" && <TurnsScreen />}
        {tab === "official" && <OfficialScreen />}
        {tab === "accounts" && <AccountsScreen />}
        {tab === "settings" && <SettingsScreen onLogout={onLogout} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-lg grid-cols-7">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cx(
                "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition",
                tab === item.id
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-300"
              )}
              aria-label={item.label}
            >
              <span
                className={cx(
                  "flex h-8 w-11 items-center justify-center rounded-full transition",
                  tab === item.id && "bg-emerald-50 dark:bg-emerald-900/30"
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function ShareholderApp({
  onLogout,
  userName,
}: {
  onLogout: () => void;
  userName: string;
}) {
  return (
    <ShareholderProvider>
      <Shell onLogout={onLogout} userName={userName} />
    </ShareholderProvider>
  );
}
