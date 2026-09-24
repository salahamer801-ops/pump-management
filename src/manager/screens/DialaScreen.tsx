import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarPlus,
  Layers,
  ListOrdered,
  Sparkles,
  Users,
} from "lucide-react";
import { useApp } from "../../store";
import type { DialaDay, DialaRound } from "../../domain/types";
import {
  activeShareholders,
  currentDialaDay,
  currentRight,
  dayByDate,
  dayOrdinal,
  daySummary,
  dialaDayTitle,
  dialaRounds,
  nextDialaDay,
  personName,
  pumpWindow,
  roundDates,
  roundDays,
  roundEndDate,
  scheduleRows,
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
import {
  Button,
  Card,
  EmptyState,
  Field,
  NumberInput,
  Pill,
  TextInput,
  cx,
} from "../../components/ui";
import { DayStatusPill } from "./Dashboard";


const DAY_PRESETS = [3, 5, 7, 10, 15, 30];

export default function DialaScreen({ onOpenDay }: { onOpenDay: (id: string | null) => void }) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [startDate, setStartDate] = useState(todayISO());
  const [days, setDays] = useState(7);
  const [notes, setNotes] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [created, setCreated] = useState<{ round: DialaRound; firstDate: string } | null>(null);

  const rows = useMemo(() => scheduleRows(state, pump), [state, pump]);
  const units = totalUnits(state, pump.id);
  const window = pumpWindow(pump);
  const rounds = useMemo(() => dialaRounds(state, showArchived), [state, showArchived]);
  const archivedCount = state.rounds.filter((r) => r.archived).length;
  const current = currentDialaDay(state);
  const next = nextDialaDay(state);

  const daysCount = Math.floor(Number(days) || 0);
  const validDays = daysCount >= 1 && daysCount <= 400;
  const endDate = startDate && validDays ? roundEndDate(startDate, daysCount) : "";
  const plannedDates = useMemo(
    () => (startDate && validDays ? roundDates(startDate, daysCount) : []),
    [startDate, validDays, daysCount]
  );
  const takenDates = plannedDates.filter((d) => state.days.some((x) => !x.archived && x.date === d));
  const freshCount = plannedDates.length - takenDates.length;

  const createRound = () => {
    if (!startDate || !validDays || freshCount === 0) return;
    const round: DialaRound = {
      id: uid("rnd"),
      pumpId: pump.id,
      number: state.counters.round,
      startDate,
      days: daysCount,
      endDate: roundEndDate(startDate, daysCount),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      createdBy: "manager",
      archived: false,
    };
    actions.createRound(round, plannedDates);
    setCreated({ round, firstDate: plannedDates.find((d) => !takenDates.includes(d)) ?? plannedDates[0] });
    setNotes("");
    // تجهيز النموذج للديالة التالية: اليوم الذي يلي تاريخ النهاية مباشرة
    setStartDate(addDaysISO(round.endDate, 1));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Layers size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">اليوم الحالي والقادم</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DayMini label="الحالي" day={current} onOpen={onOpenDay} />
          <DayMini label="القادم" day={next} onOpen={onOpenDay} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <CalendarPlus size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">إضافة ديالة</h2>
        </div>
        <p className="text-[11px] leading-relaxed text-gray-400">
          حدّد يوم بداية الديالة وعدد أيامها (المدة / مرحلة الدوران)، ويُحسب تاريخ نهاية الديالة تلقائيًا.
        </p>

        <Field label="يوم بداية الديالة">
          <TextInput
            type="date"
            dir="ltr"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCreated(null);
            }}
            aria-label="يوم بداية الديالة"
          />
        </Field>

        <Field label="عدد أيام الديالة">
          <NumberInput
            min={1}
            max={400}
            value={days || ""}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setCreated(null);
            }}
            aria-label="عدد أيام الديالة"
          />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          {DAY_PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => {
                setDays(n);
                setCreated(null);
              }}
              className={cx(
                "rounded-full border px-3 py-1 text-[11px] font-bold transition",
                daysCount === n
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 text-gray-500 hover:border-emerald-200 dark:border-slate-600 dark:text-slate-300"
              )}
            >
              {n} أيام
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-emerald-50 px-3 py-3 dark:bg-emerald-900/30">
          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
            تاريخ نهاية الديالة (محسوب)
          </div>
          <div className="mt-0.5 text-base font-black text-emerald-800 dark:text-emerald-200">
            {endDate ? isoToDisplay(endDate) : "—"}
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
            {endDate ? `${isoToWeekday(endDate)} · ${daysCount} يوم` : "أدخل يوم البداية وعدد الأيام"}
          </div>
        </div>

        <Field label="ملاحظات الديالة (اختياري)" hint="مثال: المدة الأولى، أو مرحلة دوران معيّنة">
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" />
        </Field>

        {!validDays ? (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 dark:bg-red-900/20 dark:text-red-300">
            أدخل عدد أيام صحيح (من 1 إلى 400).
          </p>
        ) : freshCount === 0 ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            كل أيام هذه المدة مسجّلة بالفعل — اختر يوم بداية مختلفًا أو غيّر عدد الأيام.
          </p>
        ) : (
          <p className="rounded-2xl bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500 dark:bg-slate-700 dark:text-slate-300">
            سيُنشأ {freshCount} يوم جاهز من الجدول الأساسي
            {takenDates.length > 0 ? ` · ${takenDates.length} يوم مسجّل مسبقًا سيُترك كما هو` : ""}
          </p>
        )}

        <Button className="w-full" onClick={createRound} disabled={!validDays || freshCount === 0}>
          <CalendarPlus size={18} /> إضافة الديالة ({validDays ? freshCount : 0} يوم)
        </Button>

        {created ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-900/40 dark:bg-emerald-900/20">
            <Sparkles size={16} className="text-emerald-600 dark:text-emerald-300" />
            <span className="flex-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
              ديالة {created.round.number}: من {isoToShort(created.round.startDate)} إلى{" "}
              {isoToShort(created.round.endDate)} — {created.round.days} يوم
            </span>
            <button
              onClick={() => {
                const first = dayByDate(state, created.firstDate);
                setCreated(null);
                onOpenDay(first?.id ?? null);
              }}
              className="rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-slate-800 dark:text-emerald-300"
            >
              ابدأ من اليوم الأول
            </button>
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Layers size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">
            الديالات ({rounds.length})
          </h2>
          {archivedCount > 0 ? (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="mr-auto text-[11px] font-bold text-emerald-600"
            >
              {showArchived ? "إخفاء المؤرشفة" : `عرض المؤرشفة (${archivedCount})`}
            </button>
          ) : null}
        </div>

        {rounds.length === 0 ? (
          <EmptyState
            icon={<Layers size={24} />}
            title="لا توجد ديالات مسجّلة"
            description="أضف ديالة بتحديد يوم البداية وعدد الأيام، وسيُحسب تاريخ النهاية تلقائيًا."
          />
        ) : (
          <div className="space-y-3">
            {rounds.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                onOpenDay={onOpenDay}
                onArchive={() => actions.archiveRound(round.id, !round.archived)}
              />
            ))}
          </div>
        )}
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
        <h2 className="mb-2 text-sm font-extrabold text-gray-800 dark:text-white">دورة العمل</h2>
        <ol className="list-inside list-decimal space-y-1 text-[11px] text-gray-500 dark:text-slate-300">
          <li>حدّد يوم بداية الديالة وعدد أيامها — يُحسب تاريخ النهاية تلقائيًا</li>
          <li>تُنشأ أيام الديالة جاهزة من الجدول الأساسي: اليوم الأول، الثاني… حتى آخر يوم</li>
          <li>لا يوجد يوم خارج الديالة — أي يوم تُنشئه من شاشة اليوم الفعلي ينتمي إلى ديالته</li>
          <li>بعد آخر يوم تنتهي الديالة، ويعود الدوران من جديد بديالة تالية من اليوم الأول</li>
          <li>افتح اليوم الفعلي وأضف الأشخاص وعدّل الترتيب بحرية</li>
          <li>سجّل الاستخدام الفعلي والتوقفات، واقرأ التعارضات</li>
          <li>أغلق اليوم عند الانتهاء — والتعديل اللاحق يحتاج إعادة فتح موثّقة</li>
        </ol>
      </Card>
    </div>
  );
}

function RoundCard({
  round,
  onOpenDay,
  onArchive,
}: {
  round: DialaRound;
  onOpenDay: (id: string | null) => void;
  onArchive: () => void;
}) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const days = roundDays(state, round.id);
  const done = days.filter((d) => d.status === "closed" || d.status === "completed").length;
  const todayIndex = roundDates(round.startDate, round.days).indexOf(todayISO()) + 1;

  const openOrCreateDay = (date: string) => {
    const existing = state.days.find((d) => !d.archived && d.date === date);
    if (existing) {
      onOpenDay(existing.id);
      return;
    }
    const id = uid("day");
    actions.createDay(
      {
        id,
        pumpId: pump.id,
        dialaNumber: round.number,
        roundId: round.id,
        date,
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
      },
      true,
      []
    );
    onOpenDay(id);
  };

  return (
    <div
      className={cx(
        "rounded-2xl border px-3 py-3",
        round.archived
          ? "border-dashed border-gray-200 opacity-70 dark:border-slate-600"
          : "border-gray-100 dark:border-slate-700"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-extrabold text-gray-800 dark:text-white">
              ديالة {round.number}
            </span>
            <Pill tone={done === round.days && round.days > 0 ? "green" : "gray"}>
              {done} من {round.days} أيام منتهية
            </Pill>
            {todayIndex > 0 ? (
              <Pill tone="blue">اليوم {dayOrdinal(todayIndex)} من الديالة</Pill>
            ) : null}
            {round.archived ? <Pill tone="amber">مؤرشفة</Pill> : null}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            من {isoToDisplay(round.startDate)} إلى {isoToDisplay(round.endDate)} · {round.days} يوم — من اليوم الأول إلى
            اليوم {dayOrdinal(round.days)}، ثم يعود الدوران بديالة جديدة
            {round.notes ? ` · ${round.notes}` : ""}
          </div>
        </div>
        <button
          onClick={onArchive}
          className={cx(
            "rounded-xl p-1.5",
            round.archived
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300"
          )}
          aria-label={round.archived ? `استرجاع ديالة ${round.number}` : `أرشفة ديالة ${round.number}`}
          title={round.archived ? "استرجاع الديالة" : "أرشفة الديالة وأيامها"}
        >
          {round.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-7">
        {Array.from({ length: round.days }, (_, i) => {
          const date = addDaysISO(round.startDate, i);
          const day = state.days.find((d) => !d.archived && d.date === date) ?? null;
          const summary = day ? daySummary(state, day, pump) : null;
          return (
            <button
              key={date}
              onClick={() => openOrCreateDay(date)}
              title={
                day
                  ? `اليوم ${dayOrdinal(i + 1)} للديالة ${round.number} — ${isoToDisplay(date)} · ${statusLabel(day.status)}${
                      summary ? ` · ${summary.persons} شخص` : ""
                    }`
                  : `إنشاء اليوم ${dayOrdinal(i + 1)} للديالة ${round.number} — ${isoToDisplay(date)}`
              }
              aria-label={`اليوم ${dayOrdinal(i + 1)} للديالة ${round.number}`}
              className={cx(
                "rounded-xl border px-1 py-1.5 text-center text-[10px] font-bold transition",
                day ? chipTone(day.status) : "border-dashed border-gray-200 text-gray-400 dark:border-slate-600 dark:text-slate-400"
              )}
            >
              <span className="block">اليوم {dayOrdinal(i + 1)}</span>
              <span className="block text-[9px] font-normal opacity-70">{isoToShort(date)}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-gray-400">
        {days.length === 0
          ? "لا توجد أيام مسجّلة بعد — اضغط على أي يوم لإنشائه من الجدول الأساسي."
          : `أيام هذه الديالة المسجّلة: ${days.length} من ${round.days} — اضغط على أي يوم لفتحه أو إنشائه.`}
      </p>
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
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300">{label}</span>
        <DayStatusPill status={day.status} />
      </div>
      <div className="mt-1 text-xs font-extrabold text-emerald-800 dark:text-emerald-200">
        {dialaDayTitle(state, day)}
      </div>
      <div className="text-[10px] text-emerald-700 dark:text-emerald-300">{isoToShort(day.date)}</div>
      <div className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
        {summary.persons} شخص · {formatDuration(summary.plannedMin)}
      </div>
    </button>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    scheduled: "مجدول",
    draft: "مسودة",
    in_progress: "جارٍ التنفيذ",
    completed: "مكتمل",
    closed: "مغلق",
    revised: "معدّل",
  };
  return map[status] ?? status;
}

function chipTone(status: string): string {
  const map: Record<string, string> = {
    scheduled: "border-gray-200 bg-gray-50 text-gray-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300",
    draft:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300",
    in_progress:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300",
    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300",
    closed:
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    revised:
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  };
  return map[status] ?? map.scheduled;
}
