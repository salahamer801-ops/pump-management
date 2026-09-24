import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CirclePlay,
  Droplets,
  Fuel,
  Play,
  Square,
  Users,
} from "lucide-react";
import { useApp } from "../store";
import {
  currentTurn,
  latestActiveCycle,
  paymentStatus,
  remainingMinutes,
  findContributor,
  debtors,
} from "../selectors";
import { formatDuration } from "../calc";
import { formatMoney, formatNumber, todayLabel } from "../format";
import type { Turn } from "../types";
import { Button, Card, EmptyState, Pill } from "../components/ui";
import PaymentModal from "../components/PaymentModal";

export default function TodayScreen({
  onGoToCycles,
  onGoToContributors,
}: {
  onGoToCycles: () => void;
  onGoToContributors: () => void;
}) {
  const { state, actions } = useApp();
  const cycle = latestActiveCycle(state);
  const now = currentTurn(state);
  const [payTurn, setPayTurn] = useState<Turn | null>(null);
  const [payKind, setPayKind] = useState<"fuel" | "royalty">("fuel");

  if (!state.pump) return null;
  const pump = state.pump;

  const nowOwner = now ? findContributor(state, now.turn.contributorId) : null;
  const debtorsList = debtors(state);
  const royaltyDebtors = debtorsList.filter((d) => d.royaltyUnpaid > 0);

  return (
    <div className="space-y-4">
      {/* unpaid royalty warning */}
      {pump.hasRoyalty && royaltyDebtors.length > 0 && (
        <div className="flex w-full items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-right text-sm font-bold text-amber-800">
          <AlertTriangle size={18} className="shrink-0" />
          {royaltyDebtors.length === 1
            ? "يوجد رواسة غير مدفوعة لمساهم واحد"
            : `يوجد رواسة غير مدفوعة لـ ${royaltyDebtors.length} مساهمين`}
        </div>
      )}

      {/* live status card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-l from-emerald-600 to-emerald-500 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 pulse-dot" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
              </span>
              <span className="text-sm font-bold">
                {now?.turn.status === "in_progress"
                  ? "المضخة: نشطة — يُروى الآن"
                  : "المضخة: جاهزة"}
              </span>
            </div>
            <Pill tone="green" className="border-white/30 bg-white/20 text-white">
              {pump.name}
            </Pill>
          </div>

          {now && nowOwner ? (
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-xs text-emerald-100">صاحب الدور الآن</div>
                <div className="text-2xl font-black">{nowOwner.name}</div>
              </div>
              <div className="text-left">
                <div className="text-xs text-emerald-100">
                  {now.turn.status === "in_progress"
                    ? `بدأ: ${now.turn.actualStart || now.turn.plannedStart}`
                    : `المخطط: ${now.turn.plannedStart}`}
                </div>
                <div className="text-lg font-extrabold">
                  المتبقي: {formatDuration(remainingMinutes(now.turn))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-emerald-50">
              لا يوجد دور جارٍ الآن. أنشئ دياله لبدء التوزيع.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 text-sm text-gray-600">
          <CalendarDays size={16} className="text-emerald-600" />
          <span>{todayLabel()}</span>
          {cycle ? (
            <span className="mr-auto font-bold text-emerald-700">
              الدياله رقم {cycle.number}
            </span>
          ) : null}
        </div>
      </Card>

      {/* cycle schedule */}
      {cycle ? (
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-base font-extrabold text-gray-800">
              جدول اليوم
            </h2>
            <span className="text-xs font-semibold text-gray-400">
              إجمالي الحصص: {formatNumber(cycle.totalShares)} ·{" "}
              {formatDuration(cycle.totalDurationMin)}
            </span>
          </div>
          <div className="space-y-3">
            {cycle.turns.map((t) => {
              const c = findContributor(state, t.contributorId);
              if (!c) return null;
              const fuelStatus = paymentStatus(t.fuelPaid, t.fuelDue);
              const royaltyStatus = paymentStatus(t.royaltyPaid, t.royaltyDue);
              return (
                <Card key={t.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-black text-emerald-700">
                      {t.order + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-extrabold text-gray-900">
                          {c.name}
                        </span>
                        <StatusPill status={t.status} />
                      </div>
                      <div className="mt-0.5 text-xs text-gray-400">
                        {formatNumber(c.shares)} حصة ·{" "}
                        {formatDuration(t.durationMin)}
                      </div>
                    </div>
                    <div className="text-left text-xs text-gray-500">
                      <div>{t.plannedStart} ← {t.plannedEnd}</div>
                      {t.actualStart ? (
                        <div className="text-emerald-600">
                          فعلي: {t.actualStart}
                          {t.actualEnd ? ` ← ${t.actualEnd}` : ""}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* payments summary */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pump.energyType !== "solar" && (
                      <PayPill
                        icon={<Fuel size={12} />}
                        label="وقود"
                        status={fuelStatus}
                        paid={t.fuelPaid}
                        due={t.fuelDue}
                        currency={pump.currency}
                      />
                    )}
                    {pump.hasRoyalty && (
                      <PayPill
                        icon={<Droplets size={12} />}
                        label="رواسة"
                        status={royaltyStatus}
                        paid={t.royaltyPaid}
                        due={t.royaltyDue}
                        currency={pump.currency}
                      />
                    )}
                  </div>

                  {/* actions */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.status === "waiting" && (
                      <Button
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => actions.startTurn(t.id)}
                      >
                        <Play size={14} /> بدء الدور
                      </Button>
                    )}
                    {t.status === "in_progress" && (
                      <Button
                        variant="primary"
                        className="px-3 py-2 text-xs"
                        onClick={() => actions.endTurn(t.id)}
                      >
                        <Square size={14} /> إنهاء الدور
                      </Button>
                    )}
                    {pump.energyType !== "solar" && (
                      <Button
                        variant="outline"
                        className="px-3 py-2 text-xs"
                        onClick={() => {
                          setPayTurn(t);
                          setPayKind("fuel");
                        }}
                      >
                        <Fuel size={14} /> وقود
                      </Button>
                    )}
                    {pump.hasRoyalty && (
                      <Button
                        variant="outline"
                        className="px-3 py-2 text-xs"
                        onClick={() => {
                          setPayTurn(t);
                          setPayKind("royalty");
                        }}
                      >
                        <Droplets size={14} /> رواسة
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<Users size={26} />}
          title="لا توجد دياله بعد"
          description="أنشئ دياله لتوزيع ساعات الري تلقائيًا على المساهمين، أو أضف مساهمين أولًا."
          action={
            <div className="flex flex-col gap-2">
              <Button onClick={onGoToCycles}>
                <CirclePlay size={18} /> إنشاء دياله
              </Button>
              <Button variant="secondary" onClick={onGoToContributors}>
                إضافة مساهمين
              </Button>
            </div>
          }
        />
      )}

      {payTurn && (
        <PaymentModal
          open
          onClose={() => setPayTurn(null)}
          title={payKind === "fuel" ? "تسجيل دفع وقود" : "تسجيل دفع رواسة"}
          due={payKind === "fuel" ? payTurn.fuelDue : payTurn.royaltyDue}
          paid={payKind === "fuel" ? payTurn.fuelPaid : payTurn.royaltyPaid}
          currency={pump.currency}
          onSave={(amount, date) =>
            payKind === "fuel"
              ? actions.payFuel(payTurn.id, amount, date)
              : actions.payRoyalty(payTurn.id, amount, date)
          }
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Turn["status"] }) {
  if (status === "completed")
    return (
      <Pill tone="green">
        <CheckCircle2 size={12} /> مكتمل
      </Pill>
    );
  if (status === "in_progress")
    return (
      <Pill tone="blue">
        <CirclePlay size={12} /> جارٍ
      </Pill>
    );
  if (status === "postponed")
    return <Pill tone="amber">مؤجل</Pill>;
  return <Pill tone="gray">انتظار</Pill>;
}

function PayPill({
  icon,
  label,
  status,
  paid,
  due,
  currency,
}: {
  icon: React.ReactNode;
  label: string;
  status: "paid" | "partial" | "unpaid";
  paid: number;
  due: number;
  currency: "YER" | "SAR" | "USD";
}) {
  const tone = status === "paid" ? "green" : status === "partial" ? "amber" : "red";
  const text =
    status === "paid" ? "مدفوع" : status === "partial" ? "جزئي" : "لم يُدفَع";
  return (
    <Pill tone={tone}>
      {icon}
      {label}: {text}
      {due > 0 ? ` · ${formatMoney(paid, currency)} / ${formatMoney(due, currency)}` : ""}
    </Pill>
  );
}
