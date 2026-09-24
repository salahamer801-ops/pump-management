import { useMemo, useState } from "react";
import { Banknote, Droplets, Fuel, Plus, Trash2, Wallet } from "lucide-react";
import { useApp } from "../store";
import {
  activeContributors,
  contributorFinancialSummary,
  findContributor,
  paymentStatus,
} from "../selectors";
import { uid } from "../calc";
import { formatDateTime, formatMoney, formatNumber } from "../format";
import type { Contributor, OtherCharge } from "../types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  NumberInput,
  Pill,
  Select,
  StatCard,
  TextInput,
} from "../components/ui";

type Tab = "overview" | "royalty" | "fuel" | "other";

export default function FinanceScreen() {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const contributors = activeContributors(state);
  const [tab, setTab] = useState<Tab>("overview");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    contributorId: "",
    label: "",
    amount: "",
    paid: "",
  });

  const tabs: { id: Tab; label: string; icon: React.ReactNode; hide?: boolean }[] = [
    { id: "overview", label: "نظرة عامة", icon: <Wallet size={15} /> },
    { id: "royalty", label: "الرواسة", icon: <Droplets size={15} />, hide: !pump.hasRoyalty },
    { id: "fuel", label: "الوقود", icon: <Fuel size={15} />, hide: pump.energyType === "solar" },
    { id: "other", label: "أخرى", icon: <Banknote size={15} /> },
  ];

  const flatTurns = useMemo(
    () =>
      state.cycles.flatMap((cycle) =>
        cycle.turns.map((t) => ({
          turn: t,
          cycle,
          contributor: findContributor(state, t.contributorId),
        }))
      ),
    [state]
  );

  const saveCharge = () => {
    if (!chargeForm.contributorId || !chargeForm.label.trim()) return;
    const charge: OtherCharge = {
      id: uid(),
      contributorId: chargeForm.contributorId,
      label: chargeForm.label.trim(),
      amount: Number(chargeForm.amount) || 0,
      paid: Number(chargeForm.paid) || 0,
      date: new Date().toISOString(),
    };
    actions.addCharge(charge);
    setChargeForm({ contributorId: "", label: "", amount: "", paid: "" });
    setChargeOpen(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-gray-900">الحساب المالي</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          كل الأرقام هنا محسوبة تلقائيًا من الرواسة والوقود والمصاريف — لا إدخال يدوي.
        </p>
      </div>

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1">
        {tabs
          .filter((t) => !t.hide)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition ${
                tab === t.id ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
      </div>

      {tab === "overview" && (
        <OverviewTab contributors={contributors} />
      )}

      {tab === "royalty" && (
        <MoneyTable
          rows={flatTurns
            .filter((r) => r.contributor)
            .map((r) => ({
              id: r.turn.id,
              name: r.contributor!.name,
              cycle: r.cycle.number,
              date: r.cycle.createdAt,
              due: r.turn.royaltyDue,
              paid: r.turn.royaltyPaid,
            }))}
          currency={pump.currency}
          emptyTitle="لا توجد سجلات رواسة بعد"
        />
      )}

      {tab === "fuel" && (
        <MoneyTable
          rows={flatTurns
            .filter((r) => r.contributor)
            .map((r) => ({
              id: r.turn.id,
              name: r.contributor!.name,
              cycle: r.cycle.number,
              date: r.cycle.createdAt,
              due: r.turn.fuelDue,
              paid: r.turn.fuelPaid,
            }))}
          currency={pump.currency}
          emptyTitle="لا توجد سجلات وقود بعد"
        />
      )}

      {tab === "other" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => setChargeOpen(true)}
              className="px-3 py-2 text-xs"
              disabled={contributors.length === 0}
            >
              <Plus size={14} /> إضافة مصروف/دين
            </Button>
          </div>
          {state.otherCharges.length === 0 ? (
            <EmptyState
              icon={<Banknote size={26} />}
              title="لا توجد مصاريف أخرى"
              description="أضف ديونًا سابقة أو مصاريف أخرى غير الرواسة والوقود."
            />
          ) : (
            state.otherCharges.map((ch) => {
              const c = findContributor(state, ch.contributorId);
              const status = paymentStatus(ch.paid, ch.amount);
              return (
                <Card key={ch.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-extrabold text-gray-900">
                        {c?.name ?? "—"}
                      </span>
                      <Pill
                        tone={status === "paid" ? "green" : status === "partial" ? "amber" : "red"}
                      >
                        {status === "paid" ? "مدفوع" : status === "partial" ? "جزئي" : "متبقي"}
                      </Pill>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {ch.label} · {formatDateTime(ch.date)}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      المستحق {formatMoney(ch.amount, pump.currency)} · المدفوع{" "}
                      {formatMoney(ch.paid, pump.currency)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => actions.deleteCharge(ch.id)}
                    aria-label="حذف"
                  >
                    <Trash2 size={16} />
                  </Button>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* add charge modal */}
      <Modal open={chargeOpen} onClose={() => setChargeOpen(false)} title="إضافة مصروف/دين آخر">
        <div className="space-y-4">
          <Field label="المساهم">
            <Select
              value={chargeForm.contributorId}
              onChange={(e) =>
                setChargeForm({ ...chargeForm, contributorId: e.target.value })
              }
            >
              <option value="">اختر مساهمًا…</option>
              {contributors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="البيان">
            <TextInput
              value={chargeForm.label}
              onChange={(e) => setChargeForm({ ...chargeForm, label: e.target.value })}
              placeholder="مثال: دين سابق / صيانة"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="المبلغ المستحق">
              <NumberInput
                value={chargeForm.amount}
                onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
              />
            </Field>
            <Field label="المدفوع">
              <NumberInput
                value={chargeForm.paid}
                onChange={(e) => setChargeForm({ ...chargeForm, paid: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setChargeOpen(false)} className="flex-1">
              إلغاء
            </Button>
            <Button onClick={saveCharge} className="flex-1">
              حفظ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function OverviewTab({ contributors }: { contributors: Contributor[] }) {
  const { state } = useApp();
  const pump = state.pump!;
  const rows = contributors.map((c) => ({
    contributor: c,
    fin: contributorFinancialSummary(state, c.id),
  }));
  const totals = rows.reduce(
    (acc, r) => ({
      due: acc.due + r.fin.totalDue,
      paid: acc.paid + r.fin.totalPaid,
    }),
    { due: 0, paid: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="إجمالي المستحق" value={formatMoney(totals.due, pump.currency)} tone="gray" />
        <StatCard label="إجمالي المدفوع" value={formatMoney(totals.paid, pump.currency)} tone="green" />
        <StatCard
          label="الرصيد المتبقي"
          value={formatMoney(totals.due - totals.paid, pump.currency)}
          tone={totals.due - totals.paid > 0 ? "red" : "green"}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wallet size={26} />}
          title="لا يوجد مساهمون بعد"
          description="أضف مساهمين لتظهر حساباتهم المالية هنا."
        />
      ) : (
        rows.map(({ contributor, fin }) => (
          <Card key={contributor.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-gray-900">{contributor.name}</div>
              <Pill tone={fin.balance > 0 ? "red" : "green"}>
                {fin.balance > 0 ? "عليه" : fin.balance < 0 ? "له" : "مسدد"}
              </Pill>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-gray-400">المستحق</div>
                <div className="font-bold text-gray-700">
                  {formatMoney(fin.totalDue, pump.currency)}
                </div>
              </div>
              <div>
                <div className="text-gray-400">المدفوع</div>
                <div className="font-bold text-emerald-600">
                  {formatMoney(fin.totalPaid, pump.currency)}
                </div>
              </div>
              <div>
                <div className="text-gray-400">المتبقي</div>
                <div className={`font-bold ${fin.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatMoney(fin.balance, pump.currency)}
                </div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function MoneyTable({
  rows,
  currency,
  emptyTitle,
}: {
  rows: { id: string; name: string; cycle: number; date: string; due: number; paid: number }[];
  currency: "YER" | "SAR" | "USD";
  emptyTitle: string;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={<Wallet size={26} />} title={emptyTitle} />;
  }
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1.3fr_auto_auto_auto] gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500">
        <span>المساهم / الدياله</span>
        <span>المستحق</span>
        <span>المدفوع</span>
        <span>المتبقي</span>
      </div>
      {rows.map((r) => {
        const remaining = r.due - r.paid;
        const status = paymentStatus(r.paid, r.due);
        return (
          <div
            key={r.id}
            className="grid grid-cols-[1.3fr_auto_auto_auto] items-center gap-2 border-b border-gray-50 px-4 py-3 text-sm"
          >
            <span>
              <span className="block truncate font-bold text-gray-800">{r.name}</span>
              <span className="text-xs text-gray-400">دياله {r.cycle}</span>
            </span>
            <span className="text-gray-600">{formatMoney(r.due, currency)}</span>
            <span className="text-gray-600">{formatMoney(r.paid, currency)}</span>
            <span>
              <Pill tone={status === "paid" ? "green" : status === "partial" ? "amber" : "red"}>
                {formatNumber(remaining)}
              </Pill>
            </span>
          </div>
        );
      })}
    </Card>
  );
}
