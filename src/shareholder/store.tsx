import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  DayContributor,
  Language,
  ShareholderCycle,
  ShareholderEntry,
  ShareholderProfile,
  ShareholderPump,
  ShareholderSettings,
  ShareholderState,
  ShareholderTurn,
  Theme,
} from "./types";
import { uid } from "./calc";

const STORAGE_KEY = "pump-org-shareholder-v2";

type Action =
  | { type: "SET_PROFILE"; profile: ShareholderProfile }
  | { type: "SET_THEME"; theme: Theme }
  | { type: "SET_LANGUAGE"; language: Language }
  | { type: "ADD_PUMP"; pump: ShareholderPump }
  | { type: "UPDATE_PUMP"; pump: ShareholderPump }
  | { type: "TOGGLE_ARCHIVE_PUMP"; id: string }
  | { type: "ADD_CYCLE"; cycle: ShareholderCycle }
  | { type: "TOGGLE_ARCHIVE_CYCLE"; id: string }
  | { type: "ADD_TURN"; turn: ShareholderTurn }
  | { type: "UPDATE_TURN"; turn: ShareholderTurn }
  | { type: "DELETE_TURN"; id: string }
  | { type: "ADD_DAY_CONTRIBUTOR"; contributor: DayContributor }
  | { type: "UPDATE_DAY_CONTRIBUTOR"; contributor: DayContributor }
  | { type: "DELETE_DAY_CONTRIBUTOR"; id: string }
  | { type: "RESET" }
  | { type: "IMPORT"; state: ShareholderState };

function log(state: ShareholderState, text: string): ShareholderEntry[] {
  const entry: ShareholderEntry = { id: uid(), at: new Date().toISOString(), text };
  return [entry, ...state.history].slice(0, 200);
}

function reducer(state: ShareholderState, action: Action): ShareholderState {
  switch (action.type) {
    case "SET_PROFILE":
      return { ...state, profile: action.profile };

    case "SET_THEME":
      return { ...state, settings: { ...state.settings, theme: action.theme } };

    case "SET_LANGUAGE":
      return { ...state, settings: { ...state.settings, language: action.language } };

    case "ADD_PUMP":
      return {
        ...state,
        pumps: [...state.pumps, action.pump],
        history: log(state, `أُضيفت المضخة: ${action.pump.name}`),
      };

    case "UPDATE_PUMP":
      return {
        ...state,
        pumps: state.pumps.map((p) => (p.id === action.pump.id ? action.pump : p)),
      };

    case "TOGGLE_ARCHIVE_PUMP": {
      const pump = state.pumps.find((p) => p.id === action.id);
      return {
        ...state,
        pumps: state.pumps.map((p) =>
          p.id === action.id ? { ...p, archived: !p.archived } : p
        ),
        history: log(
          state,
          pump ? `${pump.archived ? "أُعيد تفعيل" : "أُرشفت"} المضخة: ${pump.name}` : "تغيير حالة مضخة"
        ),
      };
    }

    case "ADD_CYCLE":
      return {
        ...state,
        cycles: [...state.cycles, action.cycle],
        history: log(state, `أُضيفت الدياله: ${action.cycle.name}`),
      };

    case "TOGGLE_ARCHIVE_CYCLE":
      return {
        ...state,
        cycles: state.cycles.map((c) =>
          c.id === action.id ? { ...c, archived: !c.archived } : c
        ),
      };

    case "ADD_TURN":
      return {
        ...state,
        turns: [...state.turns, action.turn],
        history: log(state, "سُجّل دور جديد"),
      };

    case "UPDATE_TURN":
      return {
        ...state,
        turns: state.turns.map((t) => (t.id === action.turn.id ? action.turn : t)),
      };

    case "DELETE_TURN":
      return {
        ...state,
        turns: state.turns.filter((t) => t.id !== action.id),
      };

    case "ADD_DAY_CONTRIBUTOR":
      return {
        ...state,
        dayContributors: [...state.dayContributors, action.contributor],
        history: log(state, `أُضيف المساهم: ${action.contributor.name}`),
      };

    case "UPDATE_DAY_CONTRIBUTOR":
      return {
        ...state,
        dayContributors: state.dayContributors.map((c) =>
          c.id === action.contributor.id ? action.contributor : c
        ),
      };

    case "DELETE_DAY_CONTRIBUTOR":
      return {
        ...state,
        dayContributors: state.dayContributors.filter((c) => c.id !== action.id),
      };

    case "RESET":
      return emptyState(state.profile);

    case "IMPORT":
      return {
        profile: action.state.profile ?? state.profile,
        settings: action.state.settings ?? state.settings,
        pumps: action.state.pumps ?? [],
        cycles: action.state.cycles ?? [],
        turns: action.state.turns ?? [],
        dayContributors: action.state.dayContributors ?? [],
        history: action.state.history ?? [],
      };

    default:
      return state;
  }
}

function defaultProfile(): ShareholderProfile {
  return { name: "", phone: "", farm: "", notes: "" };
}

function defaultSettings(): ShareholderSettings {
  return { theme: "light", language: "ar" };
}

export function emptyState(profile?: ShareholderProfile): ShareholderState {
  return {
    profile: profile ?? defaultProfile(),
    settings: defaultSettings(),
    pumps: [],
    cycles: [],
    turns: [],
    dayContributors: [],
    history: [],
  };
}

/** ترحيل البيانات القديمة (التي كانت باسم name فقط) */
function migrate(raw: unknown): ShareholderState {
  const obj = raw as Partial<ShareholderState> & { name?: string };
  const profile: ShareholderProfile = {
    name: obj.profile?.name ?? obj.name ?? "",
    phone: obj.profile?.phone ?? "",
    farm: obj.profile?.farm ?? "",
    notes: obj.profile?.notes ?? "",
  };
  const settings: ShareholderSettings = {
    theme: obj.settings?.theme ?? "light",
    language: obj.settings?.language ?? "ar",
  };
  return {
    profile,
    settings,
    pumps: obj.pumps ?? [],
    cycles: obj.cycles ?? [],
    turns: obj.turns ?? [],
    dayContributors: obj.dayContributors ?? [],
    history: obj.history ?? [],
  };
}

function loadInitial(): ShareholderState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return migrate(parsed);
      }
    }
    // محاولة قراءة المفتاح القديم
    const legacy = localStorage.getItem("pump-org-shareholder-v1");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed && typeof parsed === "object") return migrate(parsed);
    }
  } catch {
    // ignore
  }
  return emptyState();
}

interface ShareholderContextValue {
  state: ShareholderState;
  actions: {
    setProfile: (profile: ShareholderProfile) => void;
    setTheme: (theme: Theme) => void;
    setLanguage: (language: Language) => void;
    addPump: (pump: ShareholderPump) => void;
    updatePump: (pump: ShareholderPump) => void;
    toggleArchivePump: (id: string) => void;
    addCycle: (cycle: ShareholderCycle) => void;
    toggleArchiveCycle: (id: string) => void;
    addTurn: (turn: ShareholderTurn) => void;
    updateTurn: (turn: ShareholderTurn) => void;
    deleteTurn: (id: string) => void;
    addDayContributor: (contributor: DayContributor) => void;
    updateDayContributor: (contributor: DayContributor) => void;
    deleteDayContributor: (id: string) => void;
    reset: () => void;
    importState: (state: ShareholderState) => void;
  };
}

const ShareholderContext = createContext<ShareholderContextValue | null>(null);

export function ShareholderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const actions = useMemo<ShareholderContextValue["actions"]>(
    () => ({
      setProfile: (profile) => dispatch({ type: "SET_PROFILE", profile }),
      setTheme: (theme) => dispatch({ type: "SET_THEME", theme }),
      setLanguage: (language) => dispatch({ type: "SET_LANGUAGE", language }),
      addPump: (pump) => dispatch({ type: "ADD_PUMP", pump }),
      updatePump: (pump) => dispatch({ type: "UPDATE_PUMP", pump }),
      toggleArchivePump: (id) => dispatch({ type: "TOGGLE_ARCHIVE_PUMP", id }),
      addCycle: (cycle) => dispatch({ type: "ADD_CYCLE", cycle }),
      toggleArchiveCycle: (id) => dispatch({ type: "TOGGLE_ARCHIVE_CYCLE", id }),
      addTurn: (turn) => dispatch({ type: "ADD_TURN", turn }),
      updateTurn: (turn) => dispatch({ type: "UPDATE_TURN", turn }),
      deleteTurn: (id) => dispatch({ type: "DELETE_TURN", id }),
      addDayContributor: (contributor) => dispatch({ type: "ADD_DAY_CONTRIBUTOR", contributor }),
      updateDayContributor: (contributor) => dispatch({ type: "UPDATE_DAY_CONTRIBUTOR", contributor }),
      deleteDayContributor: (id) => dispatch({ type: "DELETE_DAY_CONTRIBUTOR", id }),
      reset: () => dispatch({ type: "RESET" }),
      importState: (s) => dispatch({ type: "IMPORT", state: s }),
    }),
    []
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <ShareholderContext.Provider value={value}>
      {children}
    </ShareholderContext.Provider>
  );
}

export function useShareholder(): ShareholderContextValue {
  const ctx = useContext(ShareholderContext);
  if (!ctx) throw new Error("useShareholder must be used within ShareholderProvider");
  return ctx;
}
