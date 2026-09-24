import { useMemo, useState } from "react";
import {
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  Layers,
  ListOrdered,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useApp } from "../../store";
import type { DialaDay } from "../../domain/types";
import {
  activeShareholders,
  currentDialaDay,
  currentRight,
  dayEntries,
  daySummary,
  isoRangeDays,
  nextDialaDay,
  personName,
  pumpWindow,
  scheduleRows,
  sortedDays,
  totalUnits,
} from "../../domain/rules";
import {
  addDaysISO,
  durationMin,
  formatDuration,
  isoToDisplay,
  isoToShort,
  isoToWeekday,
  todayISO,
  toHours,
  uid,
} from "../../domain/util";
import { formatNumber } from "../../format";
import { Button, Card, EmptyState, Field, Pill, TextInput, cx } from "../../components/ui";
import { DayStatusPill } from "./Dashboard";

export default function DialaScreen({ onOpenDay }: { onOpenDay: (id: string | null) => void }) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [date, setDate] = useState(todayISO());
  const [rangeFrom, setRangeFrom] = useState(todayISO());
  const [rangeTo, setRangeTo] = useState(addDaysISO(todayISO(), 6));
  const [showRange, setShowRange] = useState(false);

  const rows = useMemo(() => scheduleRows(state, pump), [state, pump]);
  const units = totalUnits(state, pump.id);
  const window = pumpWindow(pump);
  const days = sortedDays(state);
  const current = currentDialaDay(state);
  const next = nextDialaDay(state);

  const createDay = (targetDate: string, plan: boolean) => {
    if (state.days.some((d) => d.date === targetDate && !d.archived)) {
      const existing = state.days.find((d) => d.date === targetDate && !d.archived)!;
      onOpenDay(existing.id);
      return;
    }
    const id = uid("day");
    const day: DialaDay = {
      id,
      pumpId: pump.id,
      dialaNumber: state.counters.diala,
      date: targetDate,
      status: "draft",
      workStart: pump.workStart,
      workEnd: pump.workEnd,
      capacityMin: durationMin(pump.workStart, pump.workEnd),
      notes: "",
      openedBy: "manager",
      closedBy: "",
      closedAt: "",
      reopenedBy: "",
      reopenedAt: "",
      reopenReason: "",
      revision: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
    };
    actions.createDay(day, plan, []);
    onOpenDay(id);
  };

  const createRange = () => {
    const dates = isoRangeDays(rangeFrom, rangeTo);
    let number = state.counters.diala;
    for (const d of dates) {
      if (state.days.some((x) => x.date === d && !x.archived)) continue;
      actions.createDay(
        {
          id: uid("day"),
          pumpId: pump.id,
          dialaNumber: number,
          date: d,
          status: "scheduled",
          workStart: pump.workStart,
          workEnd: pump.workEnd,
          capacityMin: durationMin(pump.workStart, pump.workEnd),
          notes: "",
          openedBy: "manager",
          closedBy: "",
          closedAt: "",
          reopenedBy: "",
          reopenedAt: "",
          reopenReason: "",
          revision: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          archived: false,
        },
        true,
        []
      );
      number += 1;
    }
    setShowRange(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Layers size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">الديالة الحالية والقادمة</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DayMini label="الحالية" day={current} onOpen={onOpenDay} />
          <DayMini label="القادمة" day={next} onOpen={onOpenDay} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <CalendarPlus size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">إنشاء يوم فعلي</h2>
        </div>
        <Field label="التاريخ">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" onClick={() => createDay(date, true)}>
            <ListOrdered size={16} /> يوم من الجدول الأساسي
          </Button>
          <Button variant="outline" onClick={() => createDay(date, false)}>
            <Plus size={16} /> يوم فارغ
          </Button>
        </div>
        <button
          onClick={() => setShowRange((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-bold text-emerald-600"
        >
          <CalendarRange size={13} /> إنشاء مجموعة ديالات بتاريخ من/إلى
        </button>
        {showRange ? (
          <div className="space-y-2 rounded-2xl bg-gray-50 p-3 dark:bg-slate-700">
            <div className="grid grid-cols-2 gap-2">
              <Field label="من">
                <TextInput type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              </Field>
              <Field label="إلى">
                <TextInput type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
              </Field>
            </div>
            <Button className="w-full" onClick={createRange} disabled={rangeTo < rangeFrom}>
              إنشاء ({isoRangeDays(rangeFrom, rangeTo).length} يوم)
            </Button>
            <p className="text-[10px] text-gray-400">
              تُبنى كل الأيام من الجدول الأساسي، ويمكن تعديل كل يوم بشكل مستقل تمامًا.
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <ListOrdered size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">الجدول الأساسي (مرجعي)</h2>
          <span className="mr-auto text-[11px] text-gray-400">
            {activeShareholders(state, pump.id).length} مساهم · {formatNumber(units)} {pump.shareUnit} ·{" "}
            {toHours(window.capacityMin)} ساعة
          </span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="لا يوجد مساهمون أساسيون"
            description="الجدول الأساسي يُبنى من المساهمين الأساسيين وساعاتهم."
          />
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => {
              const right = currentRight(state, row.shareholder.id);
              return (
                <div
                  key={row.shareholder.id}
                  className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2 dark:bg-slate-700"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[11px] font-black text-emerald-700 dark:bg-slate-800">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-extrabold text-gray-800 dark:text-white">
                      {personName(state, row.shareholder.personId)}
                    </div>
                    {right ? (
                      <div className="text-[10px] font-bold text-amber-600">
                        صاحب الحق الحالي: {personName(state, right.holderPersonId)} (
                        {right.kind === "rent" ? "مستأجر" : "حق"})
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400">السهم بيد المساهم نفسه</div>
                    )}
                  </div>
                  <div className="text-left text-[11px] font-bold text-gray-500 dark:text-slate-300">
                    <div>
                      {formatNumber(row.units)} {pump.shareUnit}
                    </div>
                    <div>{formatDuration(row.derivedHoursMin)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
          الجدول الأساسي مرجعي فقط، واليوم الفعلي لا يغيّره. يمكن أن يختلف ترتيب اليوم الفعلي عن ترتيب الجدول.
        </p>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarRange size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">الأيام الفعلية ({days.length})</h2>
        </div>
        {days.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">لا توجد أيام مسجّلة بعد.</p>
        ) : (
          <div className="space-y-2">
            {days.map((day) => {
              const summary = daySummary(state, day, pump);
              const names = dayEntries(state, day.id)
                .slice(0, 4)
                .map((e) => personName(state, e.personId))
                .join(" · ");
              return (
                <div
                  key={day.id}
                  className="rounded-2xl border border-gray-100 px-3 py-3 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onOpenDay(day.id)}
                      className="min-w-0 flex-1 text-right"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-gray-800 dark:text-white">
                          ديالة {day.dialaNumber} — {isoToShort(day.date)}
                        </span>
                        <DayStatusPill status={day.status} />
                        {summary.issues > 0 ? <Pill tone="amber">{summary.issues} تحذير</Pill> : null}
                      </div>
                      <div className="truncate text-[11px] text-gray-400">
                        {isoToWeekday(day.date)} · {names || "—"}
                      </div>
                      <div className="text-[11px] font-bold text-gray-500 dark:text-slate-300">
                        {summary.persons} شخص · {formatDuration(summary.plannedMin)} /{" "}
                        {toHours(summary.capacityMin)} س
                        {summary.usageMin > 0 ? ` · استخدام ${formatDuration(summary.usageMin)}` : ""}
                      </div>
                    </button>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => onOpenDay(day.id)}
                        className="rounded-xl bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      >
                        فتح <ChevronLeft size={11} className="inline -mt-0.5" />
                      </button>
                      <button
                        onClick={() =>
                          actions.archiveDay(day.id, !day.archived)
                        }
                        className="rounded-xl bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-300"
                        aria-label="أرشفة اليوم"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setDate(day.date)}
                    className={cx(
                      "mt-2 text-[10px] font-bold",
                      date === day.date ? "text-emerald-600" : "text-gray-400 hover:text-emerald-600"
                    )}
                  >
                    تحديد هذا التاريخ لإنشاء/فتح يوم
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-extrabold text-gray-800 dark:text-white">دورة العمل اليومية</h2>
        <ol className="list-inside list-decimal space-y-1 text-[11px] text-gray-500 dark:text-slate-300">
          <li>تحديد التاريخ</li>
          <li>إضافة شخص (بحث أو اقتراح)</li>
          <li>إدخال البداية والنهاية أو الساعات</li>
          <li>إضافة الشخص التالي وتعديل الترتيب بحرية</li>
          <li>مراجعة التعارضات والتوقفات</li>
          <li>تسجيل الاستخدام الفعلي ثم إغلاق اليوم</li>
        </ol>
        <p className="mt-2 text-[10px] text-gray-400">
          رقم اليوم الظاهر: {isoToDisplay(date)}
        </p>
      </Card>
    </div>
  );
}

function DayMini({
  label,
  day,
  onOpen,
}: {
  label: string;
  day: DialaDay | null;
  onOpen: (id: string) => void;
}) {
  const { state } = useApp();
  const pump = state.pump!;
  if (!day) {
    return (
      <div className="rounded-2xl bg-gray-50 px-3 py-3 text-[11px] text-gray-400 dark:bg-slate-700">
        <div className="font-bold">{label}</div>
        <div className="mt-1">لا توجد</div>
      </div>
    );
  }
  const summary = daySummary(state, day, pump);
  return (
    <button
      onClick={() => onOpen(day.id)}
      className="rounded-2xl bg-emerald-50 px-3 py-3 text-right dark:bg-emerald-900/30"
    >
      <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300">{label}</div>
      <div className="mt-1 text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
        ديالة {day.dialaNumber}
      </div>
      <div className="text-[10px] text-emerald-700 dark:text-emerald-300">{isoToShort(day.date)}</div>
      <div className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
        {summary.persons} شخص · {formatDuration(summary.plannedMin)}
      </div>
    </button>
  );
}
