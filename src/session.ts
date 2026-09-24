export type SessionMode = "manager" | "shareholder";

export interface Session {
  mode: SessionMode;
  name: string;
}

const SESSION_KEY = "pump-org-session-v1";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed && (parsed.mode === "manager" || parsed.mode === "shareholder")) {
      return { mode: parsed.mode, name: parsed.name || "" };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
