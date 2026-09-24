import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Droplets,
  Lock,
  LockOpen,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Timer,
  Trash2,
  UserCheck,
  Wrench,
} from "lucide-react";
import { useApp } from "../../store";
import type {
  ConflictKind,
  DayEntry,
  DayStatus,
  EntryRole,
  Stoppage,
  StoppageKind,
  UsageType,
} from "../../domain/types";
import {
  computeUsageDraft,
  currentRight,
  dayByDate,
  dayEntries,
  dayIssues,
  daySummary,
  entryMinutes,
  findPerson,
  openIssues,
  personName,
  pumpWindow,
  shareholderOfPerson,
  usageTypeLabel,
} from "../../domain/rules";
import {
  addDaysISO,
  durationMin,
  formatDuration,
  isoToDisplay,
  isOvernight,
  minutesToTime,
  nowTime,
  timeToMinutes,
  toHours,
  todayISO,
  uid,
} from "../../domain/util";
import { formatMoney, formatNumber } from "../../format";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Pill,
  Select,
  TextArea,
  TextInput,
  TimeInput,
  cx,
} from "../../components/ui";
import PersonPicker, { roleLabel } from "../../components/PersonPicker";
import { DayStatusPill } from "./Dashboard";

const STATUS_FLOW: { id: DayStatus; label: string }[] = [
  { id: "scheduled", label: "مجدول" },
  { id: "draft", label: "مسودة" },
  { id: "in_progress", label: "جارٍ التنفيذ" },
  { id: "completed", label: "مكتمل" },
  { id: "closed", label: "مغلق" },
];

export default function ActualDayScreen({
  dayId,
  onChangeDay,
}: {
  dayId: string | null;
  onChangeDay: (id: string | null) => void;
}) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [date, setDate] = useState(() => {
    const d = dayId ? state.days.find((x) => x.id === dayId) : null;
    return d?.date ?? todayISO();
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<DayEntry | null>(null);
  const [usageEntry, setUsageEntry] = useState<DayEntry | null>(null);
  const [stoppageOpen, setStoppageOpen] = useState(false);
  const [ackIssue, setAckIssue] = useState<{ key: string; kind: ConflictKind; message: string } | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [actorName, setActorName] = useState("المسؤول");

  useEffect(() => {
    if (!dayId) return;
    const d = state.days.find((x) => x.id === dayId);
    if (d) setDate(d.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId]);

  const day = useMemo(() => dayByDate(state, date), [state, date]);
  const entries = useMemo(() => (day ? dayEntries(state, day.id) : []), [state, day]);
  const window = pumpWindow(pump, day);
  const summary = day ? daySummary(state, day, pump) : null;
  const issues = day ? openIssues(state, day, pump) : [];
  const allIssues = day ? dayIssues(state, day, pump) : [];
  const stoppages = state.stoppages.filter((s) => (day ? s.dayId === day.id : false) && !s.archived);

  const changeDate = (next: string) => {
    setDate(next);
    const target = dayByDate(state, next);
    onChangeDay(target?.id ?? null);
  };

  const createDay = () => {
    const dialaNumber = state.counters.diala;
    const id = uid("day");
    actions.createDay(
      {
        id,
        pumpId: pump.id,
        dialaNumber,
        date,
        status: "draft",
        workStart: pump.workStart,
        workEnd: pump.workEnd,
        capacityMin: durationMin(pump.workStart, pump.workEnd),
        notes: "",
        openedBy: actorName,
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
      entries.length === 0,
      []
    );
    onChangeDay(id);
  };

  if (!day) {
    return (
      <div className="space-y-4">
        <DaySelector date={date} onChange={changeDate} />
        <EmptyState
          icon={<CalendarPlus size={26} />}
          title={`لا يوجد يوم فعلي بتاريخ ${isoToDisplay(date)}`}
          description="يمكنك إنشاء اليوم الفعلي الآن — يُبنى مبدئيًا من الجدول الأساسي ثم تعدّله بحرية كاملة كما حدث فعلًا."
          action={
            <Button onClick={createDay}>
              <CalendarPlus size={18} /> إنشاء يوم فعلي
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DaySelector date={date} onChange={changeDate} />

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <ClipboardList size={18} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-gray-900 dark:text-white">
              ديالة {day.dialaNumber} — {isoToDisplay(day.date)}
            </div>
            <div className="text-[11px] text-gray-400">
              إجمالي {formatNumber(state.shareholders.filter((s) => !s.archived).length)} مساهم مسجّل ·{" "}
              {day.revision > 0 ? `أُعيد فتح اليوم ${day.revision} مرة` : "لم يُعد فتحه"}
            </div>
          </div>
          <DayStatusPill status={day.status} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="بداية التشغيل">
            <TimeInput
              value={day.workStart}
              onChange={(e) => actions.updateDay(day.id, { workStart: e.target.value })}
              aria-label="بداية تشغيل المضخة"
            />
          </Field>
          <Field label="نهاية التشغيل">
            <TimeInput
              value={day.workEnd}
              onChange={(e) => actions.updateDay(day.id, { workEnd: e.target.value })}
              aria-label="نهاية تشغيل المضخة"
            />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <MiniStat label="الأشخاص" value={`${summary?.persons ?? 0}`} />
          <MiniStat label="ساعات اليوم" value={formatDuration(summary?.plannedMin ?? 0)} />
          <MiniStat
            label={summary && summary.overMin > 0 ? "تجاوز" : "متبقٍ"}
            value={formatDuration(summary && summary.overMin > 0 ? summary.overMin : summary?.remainingMin ?? 0)}
            tone={summary && summary.overMin > 0 ? "red" : "green"}
          />
          <MiniStat
            label="تعارضات"
            value={`${issues.length}`}
            tone={issues.length > 0 ? "amber" : "green"}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_FLOW.filter((s) => s.id !== "closed").map((s) => (
            <button
              key={s.id}
              onClick={() => actions.setDayStatus(day.id, s.id, actorName)}
              className={cx(
                "rounded-full border px-3 py-1 text-[11px] font-bold transition",
                day.status === s.id
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 text-gray-500 hover:border-emerald-200 dark:border-slate-600 dark:text-slate-300"
              )}
            >
              {s.label}
            </button>
          ))}
          {day.status === "closed" ? (
            <Button variant="secondary" className="px-3 py-1 text-[11px]" onClick={() => setReopenOpen(true)}>
              <LockOpen size={14} /> إعادة فتح اليوم
            </Button>
          ) : (
            <Button
              variant="outline"
              className="px-3 py-1 text-[11px]"
              onClick={() => actions.closeDay(day.id, actorName)}
            >
              <Lock size={14} /> إغلاق اليوم
            </Button>
          )}
        </div>
        {day.status === "closed" ? (
          <p className="mt-2 rounded-2xl bg-gray-50 px-3 py-2 text-[11px] text-gray-500 dark:bg-slate-700 dark:text-slate-300">
            أُغلق اليوم بواسطة {day.closedBy || "المسؤول"} — أي تعديل لاحق يحتاج إعادة فتح موثّقة.
          </p>
        ) : null}
      </Card>

      {issues.length > 0 ? (
        <Card className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">
              تحقق قبل الحفظ ({issues.length})
            </h2>
          </div>
          {issues.map((issue) => (
            <div
              key={issue.key}
              className={cx(
                "rounded-2xl border px-3 py-2 text-[11px] leading-relaxed",
                issue.severity === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                  : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
              )}
            >
              <div className="flex items-start gap-2">
                <span className="flex-1 font-bold">{issue.message}</span>
                <button
                  onClick={() =>
                    setAckIssue({ key: issue.key, kind: issue.kind as ConflictKind, message: issue.message })
                  }
                  className="rounded-xl bg-white/80 px-2 py-1 text-[10px] font-bold dark:bg-slate-800"
                >
                  تجاوز بسبب
                </button>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-400">
            النظام لا يحذف أي سجل تلقائيًا — يعرض المشكلة ويطلب سبب التجاوز ويحفظه في سجل التدقيق.
          </p>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Timer size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">ترتيب اليوم الفعلي</h2>
          <span className="mr-auto text-[11px] text-gray-400">
            {formatDuration(summary?.plannedMin ?? 0)} من {toHours(window.capacityMin)} ساعة
          </span>
        </div>

        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">
            لا يوجد أشخاص في هذا اليوم بعد — أضف شخصًا أو استرجع الجدول الأساسي.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <EntryRow
                key={entry.id}
                index={index}
                entry={entry}
                isFirst={index === 0}
                isLast={index === entries.length - 1}
                onEdit={() => setEditEntry(entry)}
                onUsage={() => setUsageEntry(entry)}
              />
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="flex-1" onClick={() => setPickerOpen(true)}>
            <Plus size={18} /> إضافة شخص
          </Button>
          <Button
            variant="outline"
            onClick={() => actions.deriveEntries(day.id)}
            title="بناء ترتيب اليوم من الجدول الأساسي"
          >
            <RefreshCcw size={16} /> استرجاع الجدول الأساسي
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-gray-400">
          ترتيب اليوم الفعلي لا يغيّر الجدول الأساسي. كل تعديل يُحفظ فورًا مع تسجيله في سجل التدقيق.
        </p>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Wrench size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">التوقفات</h2>
          <button
            onClick={() => setStoppageOpen(true)}
            className="mr-auto rounded-xl bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          >
            + تسجيل توقف
          </button>
        </div>
        {stoppages.length === 0 ? (
          <p className="text-xs text-gray-400">لا توجد توقفات مسجّلة لهذا اليوم.</p>
        ) : (
          <div className="space-y-2">
            {stoppages.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
              >
                <span className="flex-1">
                  {s.reason || stoppageLabel(s.kind)} · {s.startTime} → {s.endTime} ({formatDuration(s.minutes)})
                </span>
                <button
                  onClick={() => actions.archiveStoppage(s.id, true)}
                  className="rounded-lg bg-white/70 p-1 text-amber-700 dark:bg-slate-800"
                  aria-label="أرشفة التوقف"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {allIssues.length > issues.length ? (
        <p className="px-2 text-[10px] text-gray-400">
          يوجد {allIssues.length - issues.length} تحذير تم تجاوزه بسبب موثّق — يمكنك رؤية السبب في سجل التدقيق.
        </p>
      ) : null}

      <PersonPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        pumpId={pump.id}
        title="إضافة شخص إلى اليوم الفعلي"
        onSelect={(person, role) => {
          const last = entries[entries.length - 1];
          const startMin = last ? timeToMinutes(last.endTime) : timeToMinutes(day.workStart);
          const shareholder = shareholderOfPerson(state, pump.id, person.id);
          const fallbackMin = shareholder?.baseHoursMin || 60;
          const entry: DayEntry = {
            id: uid("en"),
            dayId: day.id,
            pumpId: pump.id,
            orderIndex: entries.length,
            personId: person.id,
            role: role as EntryRole,
            shareholderId: shareholder?.id ?? null,
            rightId: null,
            startTime: minutesToTime(startMin),
            endTime: minutesToTime(startMin + fallbackMin),
            plannedMin: fallbackMin,
            actualPersonId: null,
            usageId: null,
            status: "planned",
            postponeToDayId: null,
            reason: "",
            notes: "",
            createdAt: new Date().toISOString(),
            createdBy: "manager",
            archived: false,
          };
          actions.saveEntry(entry, true);
        }}
      />

      {editEntry ? (
        <EntryEditor entry={editEntry} onClose={() => setEditEntry(null)} pumpId={pump.id} />
      ) : null}

      {usageEntry ? (
        <UsageModal
          entry={usageEntry}
          dayId={day.id}
          onClose={() => setUsageEntry(null)}
          actor={actorName}
        />
      ) : null}

      {stoppageOpen ? (
        <StoppageModal dayId={day.id} date={day.date} onClose={() => setStoppageOpen(false)} />
      ) : null}

      <Modal open={!!ackIssue} onClose={() => setAckIssue(null)} title="تجاوز التعارض بسبب موثّق">
        <AckForm
          message={ackIssue?.message ?? ""}
          onSubmit={(reason) => {
            if (!ackIssue) return;
            actions.ackConflict({
              id: uid("ack"),
              pumpId: pump.id,
              dayId: day.id,
              kind: ackIssue.kind,
              key: ackIssue.key,
              reason,
              byUser: actorName,
              at: new Date().toISOString(),
            });
            setAckIssue(null);
          }}
        />
      </Modal>

      <Modal open={reopenOpen} onClose={() => setReopenOpen(false)} title="إعادة فتح اليوم">
        <AckForm
          message="إعادة الفتح تُسجَّل باسمك مع التاريخ والوقت والسبب، وتظهر كل التعديلات اللاحقة في سجل التدقيق."
          onSubmit={(reason) => {
            actions.reopenDay(day.id, actorName, reason);
            setReopenOpen(false);
          }}
          label="سبب إعادة الفتح"
        />
      </Modal>

      <Card className="p-3">
        <Field label="اسمك في السجلات (المسؤول)">
          <TextInput value={actorName} onChange={(e) => setActorName(e.target.value)} />
        </Field>
      </Card>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "green",
}: {
  label: string;
  value: string;
  tone?: "green" | "red" | "amber" | "gray";
}) {
  return (
    <div className="rounded-2xl bg-gray-50 px-2 py-2 dark:bg-slate-700">
      <div className="text-[10px] font-bold text-gray-400">{label}</div>
      <div
        className={cx(
          "mt-0.5 text-xs font-extrabold",
          tone === "green" && "text-emerald-700 dark:text-emerald-300",
          tone === "red" && "text-red-600 dark:text-red-400",
          tone === "amber" && "text-amber-600 dark:text-amber-400",
          tone === "gray" && "text-gray-700 dark:text-slate-200"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DaySelector({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  return (
    <Card className="flex items-center gap-2 p-3">
      <button
        onClick={() => onChange(addDaysISO(date, -1))}
        className="rounded-xl bg-gray-100 p-2 text-gray-600 dark:bg-slate-700 dark:text-slate-200"
        aria-label="اليوم السابق"
      >
        <ChevronRight size={16} />
      </button>
      <div className="flex-1">
        <input
          type="date"
          value={date}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-xs font-bold text-gray-700 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          aria-label="تاريخ اليوم الفعلي"
        />
      </div>
      <button
        onClick={() => onChange(addDaysISO(date, 1))}
        className="rounded-xl bg-gray-100 p-2 text-gray-600 dark:bg-slate-700 dark:text-slate-200"
        aria-label="اليوم التالي"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={() => onChange(todayISO())}
        className="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      >
        اليوم
      </button>
    </Card>
  );
}

function EntryRow({
  index,
  entry,
  isFirst,
  isLast,
  onEdit,
  onUsage,
}: {
  index: number;
  entry: DayEntry;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onUsage: () => void;
}) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const person = findPerson(state, entry.personId);
  const actual = entry.actualPersonId ? findPerson(state, entry.actualPersonId) : null;
  const minutes = entryMinutes(entry);
  const overnight = entry.startTime && entry.endTime && isOvernight(entry.startTime, entry.endTime);
  const usage = entry.usageId ? state.usages.find((u) => u.id === entry.usageId) : null;

  return (
    <div className="rounded-2xl border border-gray-100 p-3 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
              {person?.name ?? "—"}
            </span>
            <Pill tone={entry.role === "shareholder" ? "green" : entry.role === "tenant" ? "amber" : "gray"}>
              {roleLabel(entry.role)}
            </Pill>
            {usage ? (
              <Pill tone="blue">
                <CheckCircle2 size={11} /> {usageTypeLabel(usage.usageType)}
              </Pill>
            ) : null}
          </div>
          <div className="mt-0.5 text-[11px] text-gray-400">
            {entry.startTime} → {entry.endTime} · {formatDuration(minutes)}
            {overnight ? " · يعبر منتصف الليل" : ""}
          </div>
          {actual && actual.id !== entry.personId ? (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-amber-600">
              <UserCheck size={11} /> المستخدم الفعلي: {actual.name}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <div className="flex gap-1">
            <button
              onClick={() => actions.moveEntry(entry.id, -1)}
              disabled={isFirst}
              className="rounded-lg bg-gray-100 p-1.5 text-gray-600 disabled:opacity-30 dark:bg-slate-700 dark:text-slate-200"
              aria-label="تقديم الشخص"
            >
              <ArrowUp size={13} />
            </button>
            <button
              onClick={() => actions.moveEntry(entry.id, 1)}
              disabled={isLast}
              className="rounded-lg bg-gray-100 p-1.5 text-gray-600 disabled:opacity-30 dark:bg-slate-700 dark:text-slate-200"
              aria-label="تأخير الشخص"
            >
              <ArrowDown size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          onClick={onUsage}
          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
        >
          <PlayCircle size={13} className="inline -mt-0.5" /> {usage ? "تعديل الاستخدام" : "تسجيل الاستخدام الفعلي"}
        </button>
        <button
          onClick={onEdit}
          className="rounded-xl bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-600 dark:bg-slate-700 dark:text-slate-200"
        >
          <Pencil size={12} className="inline -mt-0.5" /> تعديل
        </button>
        <button
          onClick={() => actions.removeEntry(entry.id)}
          className="rounded-xl bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-300"
        >
          <Trash2 size={12} className="inline -mt-0.5" /> إزالة
        </button>
        {entry.actualPersonId && entry.actualPersonId !== entry.personId ? (
          <span className="rounded-xl bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            حامل الحق مختلف عن المستخدم
          </span>
        ) : null}
        {usage ? (
          <span className="rounded-xl bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
            {usage.fuelLiters} لتر · {formatMoney(usage.fuelAmountDue, pump.currency)} ديزل ·{" "}
            {formatMoney(usage.royaltyAmountDue, pump.currency)} رواسة
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EntryEditor({
  entry,
  onClose,
  pumpId,
}: {
  entry: DayEntry;
  onClose: () => void;
  pumpId: string;
}) {
  const { state, actions } = useApp();
  const [form, setForm] = useState<DayEntry>(entry);
  const [picking, setPicking] = useState<"person" | "actual" | null>(null);
  const minutes = durationMin(form.startTime, form.endTime);

  const set = <K extends keyof DayEntry>(key: K, value: DayEntry[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal open onClose={onClose} title="تعديل صف اليوم الفعلي">
      <div className="space-y-3">
        <Field label="الشخص صاحب الدور">
          <button
            onClick={() => setPicking("person")}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-right text-sm font-bold text-gray-800 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            {personName(state, form.personId)}
          </button>
        </Field>

        <Field label="صفته">
          <Select value={form.role} onChange={(e) => set("role", e.target.value as EntryRole)}>
            <option value="shareholder">مساهم أساسي</option>
            <option value="right_holder">صاحب حق</option>
            <option value="tenant">مستأجر</option>
            <option value="guest">ضيف / ليس له سهم</option>
            <option value="other">أخرى</option>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="البداية">
            <TimeInput
              value={form.startTime}
              onChange={(e) => {
                const start = e.target.value;
                setForm((f) => ({
                  ...f,
                  startTime: start,
                  endTime: minutesToTime(timeToMinutes(start) + (f.plannedMin || minutes || 60)),
                }));
              }}
            />
          </Field>
          <Field label="النهاية">
            <TimeInput
              value={form.endTime}
              onChange={(e) => {
                const end = e.target.value;
                setForm((f) => ({
                  ...f,
                  endTime: end,
                  plannedMin: durationMin(f.startTime, end),
                }));
              }}
            />
          </Field>
        </div>

        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          المدة: {formatDuration(minutes)} {isOvernight(form.startTime, form.endTime) ? "(يعبر منتصف الليل)" : ""}
        </div>

        <Field label="المستخدم الفعلي (إن اختلف عن صاحب الدور)" hint="اتركه فارغًا إذا أخذ صاحب الدور الماء بنفسه">
          <button
            onClick={() => setPicking("actual")}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-right text-sm font-bold text-gray-800 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            {form.actualPersonId ? personName(state, form.actualPersonId) : "نفس صاحب الدور"}
          </button>
        </Field>
        {form.actualPersonId ? (
          <button
            onClick={() => set("actualPersonId", null)}
            className="text-[11px] font-bold text-red-500"
          >
            إزالة المستخدم الفعلي
          </button>
        ) : null}

        <Field label="حالة الصف">
          <Select value={form.status} onChange={(e) => set("status", e.target.value as DayEntry["status"])}>
            <option value="planned">مخطط</option>
            <option value="done">تم</option>
            <option value="postponed">مؤجل</option>
            <option value="cancelled">ملغى</option>
          </Select>
        </Field>

        <Field label="سبب التأجيل / الإلغاء">
          <TextInput value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="اختياري" />
        </Field>
        <Field label="ملاحظات">
          <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
        </Field>

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              actions.saveEntry({ ...form, plannedMin: minutes }, false);
              onClose();
            }}
          >
            <ShieldCheck size={16} /> حفظ التعديل
          </Button>
        </div>
      </div>

      {picking ? (
        <PersonPicker
          open
          onClose={() => setPicking(null)}
          pumpId={pumpId}
          title={picking === "person" ? "اختيار صاحب الدور" : "اختيار المستخدم الفعلي"}
          onSelect={(person) => {
            if (picking === "person") {
              const right = state.rights.find(
                (r) => r.holderPersonId === person.id && r.pumpId === pumpId && r.status === "active"
              );
              const shareholder = shareholderOfPerson(state, pumpId, person.id);
              setForm((f) => ({
                ...f,
                personId: person.id,
                shareholderId: shareholder?.id ?? f.shareholderId,
                rightId: right?.id ?? null,
                role: right ? (right.kind === "rent" ? "tenant" : "right_holder") : shareholder ? "shareholder" : "guest",
              }));
            } else {
              setForm((f) => ({ ...f, actualPersonId: person.id }));
            }
          }}
        />
      ) : null}
    </Modal>
  );
}

function UsageModal({
  entry,
  dayId,
  onClose,
  actor,
}: {
  entry: DayEntry;
  dayId: string;
  onClose: () => void;
  actor: string;
}) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const day = state.days.find((d) => d.id === dayId)!;
  const existing = entry.usageId ? state.usages.find((u) => u.id === entry.usageId) : null;
  const [startTime, setStartTime] = useState(existing?.startTime ?? entry.startTime ?? nowTime());
  const [endTime, setEndTime] = useState(existing?.endTime ?? entry.endTime ?? minutesToTime(timeToMinutes(nowTime()) + 60));
  const [personId, setPersonId] = useState(existing?.personId ?? entry.actualPersonId ?? entry.personId);
  const [usageType, setUsageType] = useState<UsageType>(existing?.usageType ?? "share");
  const [charge, setCharge] = useState(true);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [reason, setReason] = useState("");
  const [picking, setPicking] = useState(false);

  const draft = computeUsageDraft(pump, day, startTime, endTime);
  const shareholder = shareholderOfPerson(state, pump.id, personId);
  const right = shareholder ? currentRight(state, shareholder.id, day.date) : null;

  return (
    <Modal open onClose={onClose} title={existing ? "تعديل الاستخدام الفعلي" : "تسجيل الاستخدام الفعلي"}>
      <div className="space-y-3">
        <Field label="المستخدم الفعلي (من أخذ الماء فعلًا)">
          <button
            onClick={() => setPicking(true)}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-right text-sm font-bold text-gray-800 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            {personName(state, personId)}
          </button>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="البداية">
            <TimeInput value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="النهاية">
            <TimeInput value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-50 p-3 text-[11px] dark:bg-slate-700">
          <SnapRow label="المدة" value={`${formatDuration(draft.minutes)}${draft.crossesMidnight ? " (يعبر منتصف الليل)" : ""}`} />
          <SnapRow label="الاستهلاك" value={`${draft.fuelLiters} لتر`} />
          <SnapRow label="سعر اللتر (مرجعي)" value={`${draft.fuelPriceSnapshot}`} />
          <SnapRow label="قيمة الديزل" value={formatMoney(draft.fuelAmountDue, pump.currency)} />
          <SnapRow label="الرواسة" value={formatMoney(draft.royaltyAmountDue, pump.currency)} />
          <SnapRow
            label="المسؤول عن التكلفة"
            value={findPerson(state, personId)?.name ?? "—"}
          />
          <div className="col-span-2 text-[10px] leading-relaxed text-gray-400">
            هذه القيم تُحفظ داخل عملية الاستخدام (Snapshot) — أي تغيير في سعر الديزل أو الرواسة لاحقًا لا يعيد
            حساب هذه العملية.
          </div>
        </div>

        <Field label="نوع الاستخدام">
          <Select value={usageType} onChange={(e) => setUsageType(e.target.value as UsageType)}>
            <option value="share">حصة أساسية</option>
            <option value="rental">تأجير</option>
            <option value="loan">إعارة / سلفة</option>
            <option value="purchase">شراء ساعات</option>
            <option value="extra">ساعات إضافية</option>
            <option value="guest">ضيف</option>
          </Select>
        </Field>

        <label className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-3 dark:bg-slate-700">
          <span className="text-xs font-bold text-gray-700 dark:text-slate-200">
            تسجيل التكلفة كدين على المستخدم الفعلي
          </span>
          <input
            type="checkbox"
            checked={charge}
            onChange={(e) => setCharge(e.target.checked)}
            className="h-5 w-5 accent-emerald-600"
          />
        </label>

        <Field label="ملاحظات">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>

        {draft.minutes > 0 ? null : (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600">
            تأكد من وقت البداية والنهاية — المدة الحالية صفر.
          </p>
        )}

        <Field label="سبب تجاوز ساعات التشغيل (إن وُجد تجاوز)">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تأخر تشغيل المضخة" />
        </Field>

        <div className="flex gap-2">
          {existing ? (
            <Button
              variant="danger"
              onClick={() => {
                actions.voidUsage(existing.id, reason || "إلغاء من شاشة اليوم", actor);
                onClose();
              }}
            >
              <Trash2 size={16} /> إلغاء الاستخدام
            </Button>
          ) : null}
          <Button
            className="flex-1"
            onClick={() => {
              if (existing) actions.voidUsage(existing.id, "تعديل السجل", actor);
              actions.recordUsage({
                dayId,
                entryId: entry.id,
                personId,
                shareholderId: shareholder?.id ?? entry.shareholderId,
                rightHolderId: right?.holderPersonId ?? null,
                usageType,
                startTime,
                endTime,
                notes,
                charge,
                overCapacityReason: reason,
                actor,
              });
              onClose();
            }}
            disabled={draft.minutes <= 0}
          >
            <Droplets size={16} /> {existing ? "حفظ كسجل جديد" : "تسجيل الاستخدام"}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400">
          عند التعديل يُلغى السجل القديم ويُسجَّل سجل جديد — لا يُحذف التاريخ.
        </p>
      </div>

      {picking ? (
        <PersonPicker
          open
          onClose={() => setPicking(false)}
          pumpId={pump.id}
          title="من أخذ الماء فعليًا؟"
          onSelect={(person) => setPersonId(person.id)}
        />
      ) : null}
    </Modal>
  );
}

function SnapRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-400">{label}</div>
      <div className="font-extrabold text-gray-700 dark:text-slate-200">{value}</div>
    </div>
  );
}

function StoppageModal({
  dayId,
  date,
  onClose,
}: {
  dayId: string;
  date: string;
  onClose: () => void;
}) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [kind, setKind] = useState<StoppageKind>("breakdown");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("08:00");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const minutes = durationMin(startTime, endTime);

  return (
    <Modal open onClose={onClose} title="تسجيل توقف">
      <div className="space-y-3">
        <Field label="نوع التوقف">
          <Select value={kind} onChange={(e) => setKind(e.target.value as StoppageKind)}>
            <option value="breakdown">عطل</option>
            <option value="rain">مطر</option>
            <option value="fuel_shortage">نقص الوقود</option>
            <option value="planned">مخطط</option>
            <option value="unplanned">غير مخطط</option>
            <option value="temporary">مؤقت</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="من">
            <TimeInput value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="إلى">
            <TimeInput value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
          المدة: {formatDuration(minutes)}
        </p>
        <Field label="السبب">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب التوقف" />
        </Field>
        <Field label="ملاحظات">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
        <Button
          className="w-full"
          onClick={() => {
            const stoppage: Stoppage = {
              id: uid("st"),
              pumpId: pump.id,
              dayId,
              date,
              startTime,
              endTime,
              minutes,
              kind,
              reason: reason || stoppageLabel(kind),
              notes,
              createdAt: new Date().toISOString(),
              createdBy: "manager",
              archived: false,
            };
            actions.saveStoppage(stoppage, true);
            onClose();
          }}
          disabled={minutes <= 0}
        >
          حفظ التوقف
        </Button>
      </div>
    </Modal>
  );
}

function stoppageLabel(kind: StoppageKind): string {
  const map: Record<StoppageKind, string> = {
    breakdown: "عطل",
    rain: "مطر",
    fuel_shortage: "نقص الوقود",
    planned: "توقف مخطط",
    unplanned: "توقف غير مخطط",
    temporary: "توقف مؤقت",
  };
  return map[kind];
}

function AckForm({
  message,
  onSubmit,
  label = "سبب التجاوز",
}: {
  message: string;
  onSubmit: (reason: string) => void;
  label?: string;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-800">{message}</p>
      <Field label={label}>
        <TextArea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus />
      </Field>
      <Button className="w-full" onClick={() => onSubmit(reason)} disabled={!reason.trim()}>
        تأكيد وحفظ السبب
      </Button>
    </div>
  );
}
