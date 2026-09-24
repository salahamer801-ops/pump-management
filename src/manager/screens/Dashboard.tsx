import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  Coins,
  Droplets,
  Gauge,
  Layers,
  Timer,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { useApp } from "../../store";
import type { AppState } from "../../domain/types";
import type { ManagerTab } from "../ManagerApp";
import {
  activeShareholders,
  comparePerson,
  currentDialaDay,
  dayEntries,
  daySummary,
  debtors,
  nextDialaDay,
  openIssues,
  personName,
  pumpFinancials,
  pumpWindow,
  scheduleRows,
  totalUnits,
} from "../../domain/rules";
import { formatDuration, hijriDate, isoToDisplay, isoToShort, toHours, todayISO } from "../../domain/util";
import { formatMoney, formatNumber } from "../../format";
import { Button, Card, EmptyState, Pill, StatCard } from "../../components/ui";

export default function Dashboard({
  onOpenDay,
  onGoTab,
}: {
  onOpenDay: (dayId: string | null) => void;
  onGoTab: (tab: ManagerTab) => void;
}) {
  const { state } = useApp();
  const pump = state.pump!;

  const stats = useMemo(() => {
    const today = todayISO();
    const current = currentDialaDay(state);
    const next = nextDialaDay(state);
    const days = state.days.filter((d) => !d.archived);
    const allUsages = state.usages.filter((u) => u.status === "active");
    const usageMin = allUsages.reduce((s, u) => s + u.minutes, 0);
    const runMin = state.fuelRecords
      .filter((f) => !f.archived)
      .reduce((s, f) => s + f.hoursRun * 60, 0);
    const stoppageMin = state.stoppages
      .filter((s) => !s.archived)
      .reduce((s, st) => s + st.minutes, 0);
    const differences = state.persons
      .filter((p) => !p.archived)
      .reduce((s, p) => s + comparePerson(state, p.id).differences, 0);
    const issues = days.flatMap((d) => openIssues(state, d, pump).map((i) => ({ day: d, issue: i })));
    return {
      today,
      current,
      next,
      days,
      usageMin,
      runMin,
      stoppageMin,
      differences,
      issues,
      debts: debtors(state),
      financials: pumpFinancials(state),
      schedule: scheduleRows(state, pump),
      units: totalUnits(state, pump.id),
      shareholders: activeShareholders(state, pump.id).length,
    };
  }, [state, pump]);

  const currentSummary = stats.current ? daySummary(state, stats.current, pump) : null;
  const window = pumpWindow(pump);

  const alerts: { text: string; tone: "red" | "amber" | "blue"; day?: string }[] = [];
  if (stats.issues.length > 0) {
    alerts.push({
      text: `${stats.issues.length} تعارض/تحذير في الأيام الفعلية بحاجة إلى مراجعة.`,
      tone: "amber",
      day: stats.issues[0].day.date,
    });
  }
  if (stats.debts.length > 0) {
    alerts.push({
      text: `${stats.debts.length} شخص عليهم مبالغ غير مسددة — إجمالي ${formatMoney(
        stats.debts.reduce((s, d) => s + d.balance, 0),
        pump.currency
      )}.`,
      tone: "red",
    });
  }
  if (stats.differences > 0) {
    alerts.push({
      text: `${stats.differences} حالة اختلاف بين السجل الرسمي والسجل الشخصي للمستخدمين.`,
      tone: "blue",
    });
  }
  if (state.stoppages.filter((s) => !s.archived).length > 0) {
    alerts.push({
      text: `إجمالي ساعات التوقف: ${formatDuration(stats.stoppageMin)}.`,
      tone: "amber",
    });
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-l from-emerald-600 to-emerald-500 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Gauge size={16} /> {pump.name}
            </div>
            <Pill tone="green" className="border-white/30 bg-white/20 text-white">
              {window.start} → {window.end} · {toHours(window.capacityMin)} س
            </Pill>
          </div>
          <div className="mt-3 text-xs text-emerald-50">{isoToDisplay(stats.today)}</div>
          <div className="text-xs text-emerald-100">{hijriDate(stats.today)}</div>

          {stats.current ? (
            <div className="mt-4">
              <div className="text-xs text-emerald-50">الديالة الحالية</div>
              <div className="flex items-end justify-between">
                <div className="text-2xl font-black">
                  ديالة {stats.current.dialaNumber}
                  {currentSummary ? ` · ${currentSummary.persons} شخص` : ""}
                </div>
                <div className="text-left text-xs">
                  <div>{isoToShort(stats.current.date)}</div>
                  <div className="text-base font-extrabold">
                    {formatDuration(currentSummary?.plannedMin || 0)} / {toHours(window.capacityMin)} س
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1 bg-white/15 text-white"
                  variant="ghost"
                  onClick={() => onOpenDay(stats.current!.id)}
                >
                  <CalendarClock size={16} /> فتح اليوم الفعلي
                </Button>
                <Button
                  className="flex-1 bg-white text-emerald-700"
                  variant="ghost"
                  onClick={() => onGoTab("diala")}
                >
                  <CalendarPlus size={16} /> يوم جديد
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-emerald-50">لا يوجد يوم فعلي مسجّل بعد.</p>
              <Button className="mt-3 bg-white text-emerald-700" variant="ghost" onClick={() => onGoTab("diala")}>
                <CalendarPlus size={16} /> إنشاء يوم فعلي
              </Button>
            </div>
          )}
        </div>
      </Card>

      {stats.next ? (
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-900/30">
            <CalendarClock size={18} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-gray-400">الديالة القادمة</div>
            <div className="text-sm font-extrabold text-gray-800 dark:text-white">
              ديالة {stats.next.dialaNumber} — {isoToShort(stats.next.date)}
            </div>
          </div>
          <button
            onClick={() => onOpenDay(stats.next!.id)}
            className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
          >
            فتح
          </button>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="ساعات الاستخدام المسجلة"
          value={formatDuration(stats.usageMin)}
          hint={`${state.usages.filter((u) => u.status === "active").length} عملية استخدام`}
          icon={<Timer size={14} />}
        />
        <StatCard
          label="ساعات تشغيل المضخة"
          value={formatDuration(stats.runMin)}
          hint={`استهلاك ${stats.financials.fuelLiters} لتر`}
          tone="blue"
          icon={<Droplets size={14} />}
        />
        <StatCard
          label="المساهمون الأساسيون"
          value={`${stats.shareholders}`}
          hint={`${formatNumber(stats.units)} ${pump.shareUnit}`}
          icon={<Users size={14} />}
          tone="gray"
        />
        <StatCard
          label="ساعات التوقف"
          value={formatDuration(stats.stoppageMin)}
          hint={`${state.stoppages.filter((s) => !s.archived).length} توقف مسجّل`}
          tone="amber"
          icon={<Wrench size={14} />}
        />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Coins size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">ملخص الحسابات</h2>
          <button
            className="mr-auto text-xs font-bold text-emerald-600"
            onClick={() => onGoTab("finance")}
          >
            التفاصيل
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-gray-50 px-2 py-3 dark:bg-slate-700">
            <div className="text-[10px] font-bold text-gray-400">إجمالي الاستحقاق</div>
            <div className="mt-1 text-sm font-extrabold text-gray-800 dark:text-white">
              {formatMoney(stats.financials.charging, pump.currency)}
            </div>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-2 py-3 dark:bg-emerald-900/30">
            <div className="text-[10px] font-bold text-emerald-600">المسدَّد</div>
            <div className="mt-1 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
              {formatMoney(stats.financials.collected, pump.currency)}
            </div>
          </div>
          <div className="rounded-2xl bg-amber-50 px-2 py-3 dark:bg-amber-900/30">
            <div className="text-[10px] font-bold text-amber-600">المتبقي</div>
            <div className="mt-1 text-sm font-extrabold text-amber-700 dark:text-amber-300">
              {formatMoney(stats.financials.outstanding, pump.currency)}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-gray-400">
          <div>رواسة مستحقة: {formatMoney(stats.financials.operatorDue, pump.currency)}</div>
          <div>مدفوع للرواس: {formatMoney(stats.financials.operatorPaid, pump.currency)}</div>
          <div>نقص ديزل: {stats.financials.fuelShortage} لتر</div>
        </div>
      </Card>

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={
                "flex items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-bold " +
                (a.tone === "red"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                  : a.tone === "amber"
                    ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
                    : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300")
              }
            >
              <AlertTriangle size={14} className="shrink-0" />
              <span className="flex-1">{a.text}</span>
              {a.day ? (
                <button
                  className="rounded-xl bg-white/70 px-2 py-1 text-[10px] dark:bg-slate-800"
                  onClick={() => onGoTab("reports")}
                >
                  مراجعة
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Layers size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">الجدول الأساسي (مرجعي)</h2>
          <button className="mr-auto text-xs font-bold text-emerald-600" onClick={() => onGoTab("people")}>
            إدارة
          </button>
        </div>
        {stats.schedule.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="لا يوجد مساهمون أساسيون"
            description="سجّل المساهم الأساسي أولًا، ثم أنشئ اليوم الفعلي."
            action={
              <Button variant="secondary" onClick={() => onGoTab("people")}>
                تسجيل مساهمين
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {stats.schedule.slice(0, 6).map((row) => (
              <div
                key={row.shareholder.id}
                className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2 dark:bg-slate-700"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[11px] font-black text-emerald-700 dark:bg-slate-800">
                  {row.order + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-gray-800 dark:text-white">
                    {personName(state, row.shareholder.personId)}
                  </div>
                  {(row.holderId ?? "") !== row.shareholder.personId ? (
                    <div className="text-[10px] text-amber-600">
                      صاحب الحق الحالي: {row.holderName}
                    </div>
                  ) : null}
                </div>
                <div className="text-[11px] font-bold text-gray-500 dark:text-slate-300">
                  {formatNumber(row.units)} {pump.shareUnit} · {formatDuration(row.derivedHoursMin)}
                </div>
              </div>
            ))}
            {stats.schedule.length > 6 ? (
              <p className="text-center text-[11px] text-gray-400">
                + {stats.schedule.length - 6} مساهمين آخرين
              </p>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">آخر الأيام الفعلية</h2>
          <button className="mr-auto text-xs font-bold text-emerald-600" onClick={() => onGoTab("diala")}>
            الكل
          </button>
        </div>
        {stats.days.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">لا توجد أيام مسجّلة.</p>
        ) : (
          <div className="space-y-2">
            {stats.days
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .slice(0, 5)
              .map((day) => {
                const s = daySummary(state, day, pump);
                const holders = dayEntries(state, day.id)
                  .slice(0, 3)
                  .map((e) => personName(state, e.personId))
                  .join(" · ");
                return (
                  <button
                    key={day.id}
                    onClick={() => onOpenDay(day.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 px-3 py-3 text-right hover:border-emerald-200 dark:border-slate-700"
                  >
                    <div className="flex-1">
                      <div className="text-xs font-extrabold text-gray-800 dark:text-white">
                        ديالة {day.dialaNumber} — {isoToShort(day.date)}
                      </div>
                      <div className="truncate text-[11px] text-gray-400">{holders || "—"}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-[11px] font-bold text-gray-500 dark:text-slate-300">
                        {s.persons} شخص · {formatDuration(s.plannedMin)}
                      </div>
                      <DayStatusPill status={day.status} />
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </Card>
    </div>
  );
}

export function DayStatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: "green" | "amber" | "blue" | "gray" | "red"; label: string }> = {
    scheduled: { tone: "gray", label: "مجدول" },
    draft: { tone: "amber", label: "مسودة" },
    in_progress: { tone: "blue", label: "جارٍ التنفيذ" },
    completed: { tone: "green", label: "مكتمل" },
    closed: { tone: "green", label: "مغلق" },
    revised: { tone: "amber", label: "معدّل" },
  };
  const item = map[status] ?? { tone: "gray" as const, label: status };
  return <Pill tone={item.tone}>{item.label}</Pill>;
}

export function dayOwnerLabel(state: AppState, entryId: string): string {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) return "—";
  return personName(state, entry.actualPersonId ?? entry.personId);
}
