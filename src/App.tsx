import { useEffect, useMemo, useState } from "react";
import { Droplets } from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import LoginScreen from "./screens/LoginScreen";
import LocalLoginScreen from "./components/LoginScreen";
import ManagerShell from "./manager/ManagerShell";
import ManagerApp from "./manager/ManagerApp";
import ShareholderApp from "./shareholder/ShareholderApp";
import { AppProvider } from "./store";
import { managerStorageKey } from "./domain/storage";
import type { ManagedPump } from "./auth/types";
import { generatePumpCode, getSession, logoutUser } from "./lib/auth";
import type { AuthSession as LocalAuthSession } from "./types";
import { clearLegacySession } from "./session";

export default function App() {
  useEffect(() => {
    /* الجلسة القديمة (الاسم فقط) لم تكن هوية — تُزال عند أول تشغيل */
    clearLegacySession();
  }, []);

  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

function Root() {
  const { session, loading, logout } = useAuth();
  /**
   * الوضع التجريبي المحلي: باب جانبي للتجربة بلا خادم (src/lib/auth.ts).
   * لا يعمل أبدًا بدلًا من الحساب الحقيقي — إن وُجدت جلسة خادم فهي الأصل.
   */
  const [demoLoginOpen, setDemoLoginOpen] = useState(false);
  const [demoSession, setDemoSession] = useState<LocalAuthSession | null>(() => getSession());

  const exitDemo = () => {
    if (demoSession) logoutUser(demoSession.userId);
    setDemoSession(null);
    setDemoLoginOpen(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 animate-pulse items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
            <Droplets size={28} />
          </div>
          <p className="text-sm font-bold text-gray-500">جارٍ التحقق من الحساب…</p>
        </div>
      </div>
    );
  }

  if (session) {
    if (session.user.accountType === "manager") return <ManagerShell />;
    return <ShareholderApp userName={session.user.name} onLogout={() => void logout()} />;
  }

  if (demoSession) return <LocalDemo session={demoSession} onExit={exitDemo} />;

  if (demoLoginOpen) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DemoBanner note="حساب محلي في هذا المتصفح فقط" exitLabel="رجوع للدخول العادي" onExit={() => setDemoLoginOpen(false)} />
        <LocalLoginScreen onLogin={(next) => setDemoSession(next)} />
      </div>
    );
  }

  return <LoginScreen onOpenLocalDemo={() => setDemoLoginOpen(true)} />;
}

/** شريط ثابت يُعلن الوضع التجريبي ويُخرج منه بنقرة */
function DemoBanner({
  note,
  exitLabel,
  onExit,
}: {
  note: string;
  exitLabel: string;
  onExit: () => void;
}) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-2" data-testid="local-demo-banner">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
        <span className="text-[11px] font-bold leading-relaxed text-amber-900">وضع تجريبي محلي — {note}</span>
        <button
          type="button"
          onClick={onExit}
          aria-label={exitLabel}
          data-testid="exit-local-demo"
          className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-extrabold text-amber-900 ring-1 ring-amber-300 transition hover:bg-amber-100"
        >
          {exitLabel}
        </button>
      </div>
    </div>
  );
}

const DEMO_PUMP_CODE_KEY = "pump_demo_code_v1";

/** مضخة محلية للوضع التجريبي — رقم تعريف ثابت في هذا المتصفح */
function demoPump(managerId: string, name: string): ManagedPump {
  let pumpCode = "";
  try {
    pumpCode = localStorage.getItem(DEMO_PUMP_CODE_KEY) ?? "";
  } catch {
    /* ignore */
  }
  if (!pumpCode) {
    pumpCode = generatePumpCode();
    try {
      localStorage.setItem(DEMO_PUMP_CODE_KEY, pumpCode);
    } catch {
      /* ignore */
    }
  }
  return {
    id: "local-demo-pump",
    pumpCode,
    name,
    description: "مضخة تجريبية محلية — لا تُرسل بياناتها إلى أي خادم.",
    location: "",
    managerId,
    status: "active",
    createdAt: new Date().toISOString(),
    membersCount: 0,
    pendingCount: 0,
  };
}

/** واجهة الوضع التجريبي: مخزن محلي كامل، بلا أي نداء إلى الخادم */
function LocalDemo({ session, onExit }: { session: LocalAuthSession; onExit: () => void }) {
  const pump = useMemo(
    () => (session.accountType === "manager" ? demoPump(session.userId, "مضخة تجريبية (محلية)") : null),
    [session]
  );

  if (!pump) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DemoBanner note="بياناتك محفوظة في هذا المتصفح فقط" exitLabel="خروج من الوضع التجريبي" onExit={onExit} />
        <ShareholderApp userName={session.name} onLogout={onExit} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DemoBanner note="بياناتك محفوظة في هذا المتصفح فقط" exitLabel="خروج من الوضع التجريبي" onExit={onExit} />
      <AppProvider key={pump.id} storageKey={managerStorageKey(pump.id)} adoptName={pump.name}>
        <ManagerApp pump={pump} onSwitchPump={() => undefined} offline />
      </AppProvider>
    </div>
  );
}
