import { useState } from "react";
import { AppProvider } from "./store";
import { clearSession, loadSession, saveSession, type SessionMode } from "./session";
import LoginScreen from "./screens/LoginScreen";
import ManagerApp from "./manager/ManagerApp";
import ShareholderApp from "./shareholder/ShareholderApp";

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
        <ManagerApp onLogout={logout} userName={session.name} />
      </AppProvider>
    );
  }

  return <ShareholderApp onLogout={logout} userName={session.name} />;
}
