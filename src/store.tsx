import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  AppState,
  Contributor,
  Cycle,
  HistoryEntry,
  OtherCharge,
  PumpSettings,
  Turn,
} from "./types";
import { buildCycle, uid } from "./calc";

const STORAGE_KEY = "pump-organization-state-v1";

type Action =
  | { type: "SET_PUMP"; pump: PumpSettings }
  | { type: "ADD_CONTRIBUTOR"; contributor: Contributor }
  | { type: "UPDATE_CONTRIBUTOR"; contributor: Contributor }
  | { type: "TOGGLE_ARCHIVE_CONTRIBUTOR"; id: string }
  | { type: "ADD_CYCLE"; cycle: Cycle }
  | { type: "ARCHIVE_CYCLE"; id: string }
  | { type: "RESTORE_CYCLE"; id: string }
  | { type: "START_TURN"; turnId: string }
  | { type: "END_TURN"; turnId: string }
  | { type: "PAY_FUEL"; turnId: string; amount: number; date: string }
  | { type: "PAY_ROYALTY"; turnId: string; amount: number; date: string }
  | { type: "SET_TURN_NOTE"; turnId: string; note: string }
  | { type: "ADD_CHARGE"; charge: OtherCharge }
  | { type: "UPDATE_CHARGE"; charge: OtherCharge }
  | { type: "DELETE_CHARGE"; id: string }
  | { type: "RESET" }
  | { type: "SEED_DEMO" };

function log(state: AppState, text: string): HistoryEntry[] {
  const entry: HistoryEntry = { id: uid(), at: new Date().toISOString(), text };
  return [entry, ...state.history].slice(0, 200);
}

function updateTurn(
  turns: Turn[],
  turnId: string,
  patch: Partial<Turn>
): Turn[] {
  return turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t));
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_PUMP":
      return { ...state, pump: action.pump, history: log(state, "تم تحديث إعدادات المضخة") };

    case "ADD_CONTRIBUTOR":
      return {
        ...state,
        contributors: [...state.contributors, action.contributor],
        history: log(state, `أُضيف المساهم: ${action.contributor.name}`),
      };

    case "UPDATE_CONTRIBUTOR":
      return {
        ...state,
        contributors: state.contributors.map((c) =>
          c.id === action.contributor.id ? action.contributor : c
        ),
      };

    case "TOGGLE_ARCHIVE_CONTRIBUTOR": {
      const contributor = state.contributors.find((c) => c.id === action.id);
      return {
        ...state,
        contributors: state.contributors.map((c) =>
          c.id === action.id ? { ...c, archived: !c.archived } : c
        ),
        history: log(
          state,
          contributor
            ? `${contributor.archived ? "أُعيد تفعيل" : "أُرشف"} المساهم: ${contributor.name}`
            : "تغيير حالة مساهم"
        ),
      };
    }

    case "ADD_CYCLE":
      return {
        ...state,
        cycles: [...state.cycles, action.cycle],
        history: log(state, `أُنشئت الدياله رقم ${action.cycle.number}`),
      };

    case "ARCHIVE_CYCLE":
      return {
        ...state,
        cycles: state.cycles.map((c) =>
          c.id === action.id ? { ...c, archived: true } : c
        ),
      };

    case "RESTORE_CYCLE":
      return {
        ...state,
        cycles: state.cycles.map((c) =>
          c.id === action.id ? { ...c, archived: false } : c
        ),
      };

    case "START_TURN":
      return {
        ...state,
        cycles: state.cycles.map((c) => ({
          ...c,
          turns: updateTurn(c.turns, action.turnId, {
            actualStart: new Date().toTimeString().slice(0, 5),
            status: "in_progress",
          }),
        })),
      };

    case "END_TURN":
      return {
        ...state,
        cycles: state.cycles.map((c) => ({
          ...c,
          turns: updateTurn(c.turns, action.turnId, {
            actualEnd: new Date().toTimeString().slice(0, 5),
            status: "completed",
          }),
        })),
      };

    case "PAY_FUEL":
      return {
        ...state,
        cycles: state.cycles.map((c) => ({
          ...c,
          turns: updateTurn(c.turns, action.turnId, {
            fuelPaid: action.amount,
            fuelPaidDate: action.date,
          }),
        })),
      };

    case "PAY_ROYALTY":
      return {
        ...state,
        cycles: state.cycles.map((c) => ({
          ...c,
          turns: updateTurn(c.turns, action.turnId, {
            royaltyPaid: action.amount,
            royaltyPaidDate: action.date,
          }),
        })),
      };

    case "SET_TURN_NOTE":
      return {
        ...state,
        cycles: state.cycles.map((c) => ({
          ...c,
          turns: updateTurn(c.turns, action.turnId, { note: action.note }),
        })),
      };

    case "ADD_CHARGE":
      return { ...state, otherCharges: [...state.otherCharges, action.charge] };

    case "UPDATE_CHARGE":
      return {
        ...state,
        otherCharges: state.otherCharges.map((c) =>
          c.id === action.charge.id ? action.charge : c
        ),
      };

    case "DELETE_CHARGE":
      return {
        ...state,
        otherCharges: state.otherCharges.filter((c) => c.id !== action.id),
      };

    case "RESET":
      return emptyState();

    case "SEED_DEMO":
      return seedDemoState();

    default:
      return state;
  }
}

export function emptyState(): AppState {
  return {
    pump: null,
    contributors: [],
    cycles: [],
    otherCharges: [],
    history: [],
  };
}

function seedDemoState(): AppState {
  const now = new Date();
  const pump: PumpSettings = {
    name: "مضخة العليا",
    energyType: "diesel",
    wells: "بئر الحافة",
    farm: "وادي الحمراء",
    notes: "",
    workStart: "06:00",
    workEnd: "02:00",
    hasRoyalty: true,
    royaltyMode: "cycle",
    royaltyPerCycle: 100000,
    royaltyPerHour: 0,
    currency: "YER",
    fuelPrice: 1200,
    fuelConsumptionPerHour: 6,
    fuelPerCycle: 120,
    fuelCalcMode: "hour",
    shareMode: "fraction",
    shareUnit: "حصة",
  };

  const contributors: Contributor[] = [
    {
      id: uid(),
      name: "علي حسن",
      phone: "",
      shares: 2,
      notes: "",
      archived: false,
      createdAt: now.toISOString(),
    },
    {
      id: uid(),
      name: "محمد كريم",
      phone: "",
      shares: 3,
      notes: "",
      archived: false,
      createdAt: now.toISOString(),
    },
    {
      id: uid(),
      name: "أحمد خليل",
      phone: "",
      shares: 1.5,
      notes: "",
      archived: false,
      createdAt: now.toISOString(),
    },
  ];

  const cycle = buildCycle(pump, contributors, 1);
  // Simulate: first turn completed with payments, second in progress now.
  if (cycle.turns[0]) {
    cycle.turns[0].status = "completed";
    cycle.turns[0].actualStart = "06:00";
    cycle.turns[0].actualEnd = "08:20";
    cycle.turns[0].fuelPaid = cycle.turns[0].fuelDue;
    cycle.turns[0].fuelPaidDate = now.toISOString();
    cycle.turns[0].royaltyPaid = 0;
  }
  if (cycle.turns[1]) {
    cycle.turns[1].status = "in_progress";
    cycle.turns[1].actualStart = "08:25";
    cycle.turns[1].fuelPaid = cycle.turns[1].fuelDue;
    cycle.turns[1].fuelPaidDate = now.toISOString();
    cycle.turns[1].royaltyPaid = cycle.turns[1].royaltyDue;
    cycle.turns[1].royaltyPaidDate = now.toISOString();
  }

  return {
    pump,
    contributors,
    cycles: [cycle],
    otherCharges: [],
    history: [
      {
        id: uid(),
        at: now.toISOString(),
        text: "تم تعبئة البيانات التجريبية للاستعراض",
      },
    ],
  };
}

interface AppContextValue {
  state: AppState;
  actions: {
    setPump: (pump: PumpSettings) => void;
    addContributor: (contributor: Contributor) => void;
    updateContributor: (contributor: Contributor) => void;
    toggleArchiveContributor: (id: string) => void;
    addCycle: (cycle: Cycle) => void;
    archiveCycle: (id: string) => void;
    restoreCycle: (id: string) => void;
    startTurn: (turnId: string) => void;
    endTurn: (turnId: string) => void;
    payFuel: (turnId: string, amount: number, date: string) => void;
    payRoyalty: (turnId: string, amount: number, date: string) => void;
    setTurnNote: (turnId: string, note: string) => void;
    addCharge: (charge: OtherCharge) => void;
    updateCharge: (charge: OtherCharge) => void;
    deleteCharge: (id: string) => void;
    reset: () => void;
    seedDemo: () => void;
  };
}

const AppContext = createContext<AppContextValue | null>(null);

function loadInitial(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && typeof parsed === "object") {
        return {
          pump: parsed.pump ?? null,
          contributors: parsed.contributors ?? [],
          cycles: parsed.cycles ?? [],
          otherCharges: parsed.otherCharges ?? [],
          history: parsed.history ?? [],
        };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return emptyState();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage may be unavailable; the app still works in memory
    }
  }, [state]);

  const actions = useMemo<AppContextValue["actions"]>(
    () => ({
      setPump: (pump) => dispatch({ type: "SET_PUMP", pump }),
      addContributor: (contributor) =>
        dispatch({ type: "ADD_CONTRIBUTOR", contributor }),
      updateContributor: (contributor) =>
        dispatch({ type: "UPDATE_CONTRIBUTOR", contributor }),
      toggleArchiveContributor: (id) =>
        dispatch({ type: "TOGGLE_ARCHIVE_CONTRIBUTOR", id }),
      addCycle: (cycle) => dispatch({ type: "ADD_CYCLE", cycle }),
      archiveCycle: (id) => dispatch({ type: "ARCHIVE_CYCLE", id }),
      restoreCycle: (id) => dispatch({ type: "RESTORE_CYCLE", id }),
      startTurn: (turnId) => dispatch({ type: "START_TURN", turnId }),
      endTurn: (turnId) => dispatch({ type: "END_TURN", turnId }),
      payFuel: (turnId, amount, date) =>
        dispatch({ type: "PAY_FUEL", turnId, amount, date }),
      payRoyalty: (turnId, amount, date) =>
        dispatch({ type: "PAY_ROYALTY", turnId, amount, date }),
      setTurnNote: (turnId, note) =>
        dispatch({ type: "SET_TURN_NOTE", turnId, note }),
      addCharge: (charge) => dispatch({ type: "ADD_CHARGE", charge }),
      updateCharge: (charge) => dispatch({ type: "UPDATE_CHARGE", charge }),
      deleteCharge: (id) => dispatch({ type: "DELETE_CHARGE", id }),
      reset: () => dispatch({ type: "RESET" }),
      seedDemo: () => dispatch({ type: "SEED_DEMO" }),
    }),
    []
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
