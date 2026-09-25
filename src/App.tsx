import { useEffect } from "react";
import { Droplets } from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import LoginScreen from "./screens/LoginScreen";
import ManagerShell from "./manager/ManagerShell";
import ShareholderApp from "./shareholder/ShareholderApp";
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
  const { session, loading } = useAuth();

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

  if (!session) return <LoginScreen />;

  if (session.user.accountType === "manager") return <ManagerShell />;

  return <ShareholderApp />;
}
