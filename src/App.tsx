import { useState } from "react";
import {
  Bell,
  CalendarCheck,
  Droplets,
  Layers,
  LogOut,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { AppProvider, useApp } from "./store";
import { debtors } from "./selectors";
import { clearSession, loadSession, saveSession, type SessionMode } from "./session";
import LoginScreen from "./screens/LoginScreen";
import Onboarding from "./screens/Onboarding";
import TodayScreen from "./screens/TodayScreen";
import ContributorsScreen from "./screens/ContributorsScreen";
import CyclesScreen from "./screens/CyclesScreen";
import FinanceScreen from "./screens/FinanceScreen";
import ReportsScreen from "./screens/ReportsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ShareholderApp from "./shareholder/ShareholderApp";
import { cx, Modal } from "./components/ui";
import { formatMoney } from "./format";

type Tab = "today" | "contributors" | "cycles" | "finance" | "reports" | "settings";

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "today", label: "اليوم", icon: <CalendarCheck size={22} /> },
  { id: "contributors", label: "المساهمون", icon: <Users size={22} /> },
  { id: "cycles", label: "الدياله", icon: <Layers size={22} /> },
  { id: "finance", label: "المالية", icon: <Wallet size={22} /> },
  { id: "reports", label: "التقارير", icon: <Bell size={22} /> },
  { id: "settings", label: "الإعدادات", icon: <Settings size={22} /> },
];

function ManagerApp({ onLogout }: { onLogout: () => void }) {
  const { state } = useApp();
  const [tab, setTab] = useState<Tab>("today");
  const [notifOpen, setNotifOpen] = useState(false);

  if (!state.pump) {
    return <Onboarding onLogout={onLogout} />;
  }

  const pump = state.pump;
  const debtorsList = debtors(state);
  const hasDebts = debtorsList.length > 0;

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-24">
      <header className="sticky top-0 z-30 border-b border-emerald-100/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-600/20">
              <Droplets size={18} />
            </div>
            <div>
              <div className="text-sm font-black leading-tight text-gray-900">
                مشروع تنظيم المضخات
              </div>
              <div className="text-xs text-gray-400">{pump.name}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              نشطة
            </span>
            <button
              onClick={() => setNotifOpen(true)}
              className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100"
              aria-label="التنبيهات"
            >
              <Bell size={20} />
              {hasDebts && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {debtorsList.length}
                </span>
              )}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
              aria-label="تسجيل الخروج"
            >
              <LogOut size={16} /> خروج
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {tab === "today" && (
          <TodayScreen
            onGoToCycles={() => setTab("cycles")}
            onGoToContributors={() => setTab("contributors")}
          />
        )}
        {tab === "contributors" && <ContributorsScreen />}
        {tab === "cycles" && <CyclesScreen />}
        {tab === "finance" && <FinanceScreen />}
        {tab === "reports" && <ReportsScreen />}
        {tab === "settings" && <SettingsScreen />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cx(
                "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition",
                tab === item.id ? "text-emerald-700" : "text-gray-400 hover:text-gray-600"
              )}
              aria-label={item.label}
            >
              <span
                className={cx(
                  "flex h-8 w-11 items-center justify-center rounded-full transition",
                  tab === item.id && "bg-emerald-50"
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <Modal open={notifOpen} onClose={() => setNotifOpen(false)} title="التنبيهات">
        {debtorsList.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            لا توجد تنبيهات — كل شيء على ما يرام.
          </p>
        ) : (
          <div className="space-y-2">
            {debtorsList.map((d) => (
              <div
                key={d.contributor.id}
                className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-bold text-gray-800">
                    {d.contributor.name}
                  </div>
                  <div className="text-xs text-amber-700">عليه مبالغ غير مسددة</div>
                </div>
                <div className="text-sm font-extrabold text-red-600">
                  {formatMoney(d.summary.balance, pump.currency)}
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                setNotifOpen(false);
                setTab("reports");
              }}
              className="mt-2 w-full rounded-2xl bg-emerald-50 py-3 text-sm font-bold text-emerald-700"
            >
              عرض قائمة الديون
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(loadSession);

  if (!session) {
    return (
      <LoginScreen
        onLogin={(mode: SessionMode, name: string) => {
          const s = { mode, name };
          saveSession(s);
          setSession(s);
        }}
      />
    );
  }

  const logout = () => {
    clearSession();
    setSession(null);
  };

  if (session.mode === "manager") {
    return (
      <AppProvider>
        <ManagerApp onLogout={logout} />
      </AppProvider>
    );
  }

  return <ShareholderApp onLogout={logout} userName={session.name} />;
}
