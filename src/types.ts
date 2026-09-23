export type EnergyType = "solar" | "diesel" | "hybrid";
export type Currency = "YER" | "SAR" | "USD";
export type RoyaltyMode = "cycle" | "hour";
export type FuelCalcMode = "hour" | "cycle";
export type ShareMode = "whole" | "fraction";
export type TurnStatus = "waiting" | "in_progress" | "completed" | "postponed";

export interface PumpSettings {
  name: string;
  energyType: EnergyType;
  wells: string;
  farm: string;
  notes: string;
  workStart: string;
  workEnd: string;
  hasRoyalty: boolean;
  royaltyMode: RoyaltyMode;
  royaltyPerCycle: number;
  royaltyPerHour: number;
  currency: Currency;
  fuelPrice: number;
  fuelConsumptionPerHour: number;
  fuelPerCycle: number;
  fuelCalcMode: FuelCalcMode;
  shareMode: ShareMode;
  shareUnit: string;
}

export interface Contributor {
  id: string;
  name: string;
  phone: string;
  shares: number;
  notes: string;
  archived: boolean;
  createdAt: string;
}

export interface Turn {
  id: string;
  cycleId: string;
  contributorId: string;
  order: number;
  durationMin: number;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  fuelDue: number;
  fuelPaid: number;
  fuelPaidDate: string;
  royaltyDue: number;
  royaltyPaid: number;
  royaltyPaidDate: string;
  note: string;
  status: TurnStatus;
}

export interface Cycle {
  id: string;
  number: number;
  createdAt: string;
  workStart: string;
  workEnd: string;
  totalShares: number;
  totalDurationMin: number;
  fuelPriceSnapshot: number;
  royaltySnapshot: number;
  turns: Turn[];
  archived: boolean;
}

export interface OtherCharge {
  id: string;
  contributorId: string;
  label: string;
  amount: number;
  paid: number;
  date: string;
}

export interface HistoryEntry {
  id: string;
  at: string;
  text: string;
}

export interface AppState {
  pump: PumpSettings | null;
  contributors: Contributor[];
  cycles: Cycle[];
  otherCharges: OtherCharge[];
  history: HistoryEntry[];
}
