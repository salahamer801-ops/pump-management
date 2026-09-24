import type { AppState, Contributor, Cycle, Turn } from "./types";
import { timeToMinutes } from "./calc";

export function activeContributors(state: AppState): Contributor[] {
  return state.contributors.filter((c) => !c.archived);
}

export function activeCycles(state: AppState): Cycle[] {
  return state.cycles.filter((c) => !c.archived);
}

export function latestActiveCycle(state: AppState): Cycle | null {
  const list = activeCycles(state);
  if (list.length === 0) return null;
  return list[list.length - 1];
}

export function findContributor(
  state: AppState,
  id: string
): Contributor | undefined {
  return state.contributors.find((c) => c.id === id);
}

export type PaymentStatus = "paid" | "partial" | "unpaid";

export function paymentStatus(paid: number, due: number): PaymentStatus {
  if (due <= 0) return "paid";
  if (paid <= 0) return "unpaid";
  if (paid >= due) return "paid";
  return "partial";
}

export function currentTurn(state: AppState): { turn: Turn; cycle: Cycle } | null {
  const cycle = latestActiveCycle(state);
  if (!cycle) return null;

  // A turn explicitly in progress wins.
  const inProgress = cycle.turns.find((t) => t.status === "in_progress");
  if (inProgress) return { turn: inProgress, cycle };

  // Otherwise, the turn whose planned window contains the current time.
  const now = timeToMinutes(new Date().toTimeString().slice(0, 5));
  const scheduled = cycle.turns.find(
    (t) =>
      t.status === "waiting" &&
      timeToMinutes(t.plannedStart) <= now &&
      now < timeToMinutes(t.plannedEnd)
  );
  if (scheduled) return { turn: scheduled, cycle };

  // Fallback: the next waiting turn.
  const next = cycle.turns.find((t) => t.status === "waiting");
  if (next) return { turn: next, cycle };

  return null;
}

export function remainingMinutes(turn: Turn): number {
  if (turn.status === "in_progress" && turn.actualStart) {
    const start = timeToMinutes(turn.actualStart);
    const now = timeToMinutes(new Date().toTimeString().slice(0, 5));
    const elapsed = now >= start ? now - start : now - start + 24 * 60;
    return Math.max(0, turn.durationMin - elapsed);
  }
  return turn.durationMin;
}

export interface FinancialSummary {
  royaltyDue: number;
  royaltyPaid: number;
  fuelDue: number;
  fuelPaid: number;
  otherDue: number;
  otherPaid: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
}

export interface Debtor {
  contributor: Contributor;
  summary: FinancialSummary;
  royaltyUnpaid: number;
  fuelUnpaid: number;
}

export function debtors(state: AppState): Debtor[] {
  if (!state.pump) return [];
  return activeContributors(state)
    .map((contributor) => {
      const summary = contributorFinancialSummary(state, contributor.id);
      return {
        contributor,
        summary,
        royaltyUnpaid: summary.royaltyDue - summary.royaltyPaid,
        fuelUnpaid: summary.fuelDue - summary.fuelPaid,
      };
    })
    .filter((d) => d.summary.balance > 0)
    .sort((a, b) => b.summary.balance - a.summary.balance);
}

export interface ContributorCycleRow {
  cycle: Cycle;
  turn: Turn;
  durationMin: number;
  royaltyDue: number;
  royaltyPaid: number;
  fuelDue: number;
  fuelPaid: number;
}

export function contributorCycleRows(
  state: AppState,
  contributorId: string
): ContributorCycleRow[] {
  const rows: ContributorCycleRow[] = [];
  for (const cycle of state.cycles) {
    const turn = cycle.turns.find((t) => t.contributorId === contributorId);
    if (!turn) continue;
    rows.push({
      cycle,
      turn,
      durationMin: turn.durationMin,
      royaltyDue: turn.royaltyDue,
      royaltyPaid: turn.royaltyPaid,
      fuelDue: turn.fuelDue,
      fuelPaid: turn.fuelPaid,
    });
  }
  return rows;
}

export function contributorFinancialSummary(
  state: AppState,
  contributorId: string
): FinancialSummary {
  let royaltyDue = 0;
  let royaltyPaid = 0;
  let fuelDue = 0;
  let fuelPaid = 0;

  for (const cycle of state.cycles) {
    for (const t of cycle.turns) {
      if (t.contributorId !== contributorId) continue;
      royaltyDue += t.royaltyDue;
      royaltyPaid += t.royaltyPaid;
      fuelDue += t.fuelDue;
      fuelPaid += t.fuelPaid;
    }
  }

  const charges = state.otherCharges.filter(
    (c) => c.contributorId === contributorId
  );
  const otherDue = charges.reduce((s, c) => s + c.amount, 0);
  const otherPaid = charges.reduce((s, c) => s + c.paid, 0);

  const totalDue = royaltyDue + fuelDue + otherDue;
  const totalPaid = royaltyPaid + fuelPaid + otherPaid;

  return {
    royaltyDue,
    royaltyPaid,
    fuelDue,
    fuelPaid,
    otherDue,
    otherPaid,
    totalDue,
    totalPaid,
    balance: totalDue - totalPaid,
  };
}
