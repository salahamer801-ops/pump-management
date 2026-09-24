import { useState } from "react";
import {
  ArrowRight,
  Archive,
  ArchiveRestore,
  Droplets,
  Fuel,
  Pencil,
  Wallet,
} from "lucide-react";
import { useApp } from "../store";
import {
  activeContributors,
  contributorFinancialSummary,
  findContributor,
  paymentStatus,
} from "../selectors";
import {
  contributorHoursMin,
  formatDuration,
  fuelDueFor,
  royaltyDueFor,
  workDurationMin,
} from "../calc";
import { formatMoney, formatNumber } from "../format";
import type { Contributor, Turn } from "../types";
import { Button, Card, Pill, StatCard } from "../components/ui";
import PaymentModal from "../components/PaymentModal";

export default function ContributorDetail({
  id,
  onBack,
  onEdit,
}: {
  id: string;
  onBack: () => void;
  onEdit: (c: Contributor) => void;
}) {
  const { state, actions } = useApp();
  const [payKind, setPayKind] = useState<"fuel" | "royalty" | null>(null);
  const pump = state.pump!;
  const c = findContributor(state, id);
  const active = activeContributors(state);
  const totalShares = active.reduce((s, x) => s + x.shares, 0);

  if (!c) return null;

  const durationMin = contributorHoursMin(c, pump, totalShares);
  const fullCycleDuration = workDurationMin(pump.workStart, pump.workEnd);
  const royaltyPerCycle = royaltyDueFor(c, pump, totalShares, fullCycleDuration);
  const fuelPerCycle = fuelDueFor(c, pump, totalShares, fullCycleDuration);
  const fin = contributorFinancialSummary(state, id);

  // Latest turn to which a "record payment" action applies.
  const latestTurn = latestTurnFor(state, id);
  const fuelStatus = paymentStatus(fin.fuelPaid, fin.fuelDue);
  const royaltyStatus = paymentStatus(fin.royaltyPaid, fin.royaltyDue);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-bold text-gray-500 hover:bg-gray-100"
        >
          <ArrowRight size={16} /> رجوع
        </button>
        <div className="mr-auto flex gap-2">
          <Button
            variant="outline"
            className="px-3 py-2 text-xs"
            onClick={() => onEdit(c)}
          >
            <Pencil size={14} /> تعديل
          </Button>
          <Button
            variant={c.archived ? "secondary" : "danger"}
            className="px-3 py-2 text-xs"
            onClick={() => actions.toggleArchiveContributor(c.id)}
          >
            {c.archived ? (
              <>
                <ArchiveRestore size={14} /> تفعيل
              </>
            ) : (
              <>
                <Archive size={14} /> أرشفة
              </>
            )}
          </Button>
        </div>
      </div>

      {/* identity */}
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
            <span className="text-xl font-black">{c.name.trim().charAt(0) || "؟"}</span>
          </div>
          <div>
            <div className="text-lg font-black text-gray-900">{c.name}</div>
            <div className="text-sm text-gray-500">
              {c.phone ? `📞 ${c.phone}` : "بدون رقم هاتف"} · مضخة {pump.name}
            </div>
          </div>
        </div>
        {c.notes ? (
          <p className="mt-3 rounded-2xl bg-gray-50 p-3 text-sm text-gray-600">
            {c.notes}
          </p>
        ) : null}
      </Card>

      {/* shares & auto-calculated */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-extrabold text-gray-500">
          الحصص والحسبة التلقائية
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="الحصص"
            value={formatNumber(c.shares)}
            hint={`${pump.shareUnit}`}
          />
          <StatCard
            label="نسبته"
            value={`${formatNumber(totalShares > 0 ? (c.shares / totalShares) * 100 : 0)}%`}
            hint={`من إجمالي ${formatNumber(totalShares)}`}
          />
          <StatCard
            label="ساعاته يوميًا"
            value={formatDuration(durationMin)}
            hint="من إعدادات الدوام"
          />
          <StatCard
            label="الميزان المائي"
            value={formatMoney(fin.balance, pump.currency)}
            tone={fin.balance > 0 ? "red" : "green"}
            hint="المتبقي عليه"
          />
        </div>
      </Card>

      {/* fuel + royalty summary */}
      <div className="space-y-3">
        {pump.energyType !== "solar" && (
          <ServiceCard
            icon={<Fuel size={20} />}
            title="الوقود"
            due={fin.fuelDue}
            paid={fin.fuelPaid}
            remaining={fin.fuelDue - fin.fuelPaid}
            status={fuelStatus}
            currency={pump.currency}
            action={
              <Button
                variant="secondary"
                className="px-3 py-2 text-xs"
                onClick={() => setPayKind("fuel")}
              >
                تسجيل دفع وقود
              </Button>
            }
          />
        )}
        {pump.hasRoyalty && (
          <ServiceCard
            icon={<Droplets size={20} />}
            title="الرواسة"
            due={fin.royaltyDue}
            paid={fin.royaltyPaid}
            remaining={fin.royaltyDue - fin.royaltyPaid}
            status={royaltyStatus}
            currency={pump.currency}
            action={
              <Button
                variant="secondary"
                className="px-3 py-2 text-xs"
                onClick={() => setPayKind("royalty")}
              >
                تسجيل دفع رواسة
              </Button>
            }
          />
        )}
      </div>

      {/* total financial */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-gray-500">
          <Wallet size={16} /> الحساب المالي الإجمالي
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="المستحق"
            value={formatMoney(fin.totalDue, pump.currency)}
            tone="gray"
          />
          <StatCard
            label="المدفوع"
            value={formatMoney(fin.totalPaid, pump.currency)}
            tone="green"
          />
          <StatCard
            label="المتبقي"
            value={formatMoney(fin.balance, pump.currency)}
            tone={fin.balance > 0 ? "red" : "green"}
          />
        </div>
        <div className="mt-3 text-xs text-gray-400">
          الرواسة للدورة: {formatMoney(royaltyPerCycle, pump.currency)}
          {pump.energyType !== "solar"
            ? ` · الوقود للدورة: ${formatMoney(fuelPerCycle, pump.currency)}`
            : ""}
        </div>
      </Card>

      {payKind && latestTurn && (
        <PaymentModal
          open
          onClose={() => setPayKind(null)}
          title={payKind === "fuel" ? "تسجيل دفع وقود" : "تسجيل دفع رواسة"}
          due={payKind === "fuel" ? latestTurn.fuelDue : latestTurn.royaltyDue}
          paid={payKind === "fuel" ? latestTurn.fuelPaid : latestTurn.royaltyPaid}
          currency={pump.currency}
          onSave={(amount, date) =>
            payKind === "fuel"
              ? actions.payFuel(latestTurn.id, amount, date)
              : actions.payRoyalty(latestTurn.id, amount, date)
          }
        />
      )}
    </div>
  );
}

function latestTurnFor(state: ReturnType<typeof useApp>["state"], contributorId: string): Turn | null {
  for (let i = state.cycles.length - 1; i >= 0; i--) {
    const cycle = state.cycles[i];
    if (cycle.archived) continue;
    const t = cycle.turns.find((x) => x.contributorId === contributorId);
    if (t) return t;
  }
  return null;
}

function ServiceCard({
  icon,
  title,
  due,
  paid,
  remaining,
  status,
  currency,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  due: number;
  paid: number;
  remaining: number;
  status: "paid" | "partial" | "unpaid";
  currency: "YER" | "SAR" | "USD";
  action: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-gray-900">{title}</span>
            <Pill
              tone={status === "paid" ? "green" : status === "partial" ? "amber" : "red"}
            >
              {status === "paid" ? "مدفوع" : status === "partial" ? "جزئي" : "لم يُدفَع"}
            </Pill>
          </div>
          <div className="mt-0.5 text-xs text-gray-400">
            المستحق {formatMoney(due, currency)} · المدفوع {formatMoney(paid, currency)} ·{" "}
            المتبقي {formatMoney(remaining, currency)}
          </div>
        </div>
        {action}
      </div>
    </Card>
  );
}
