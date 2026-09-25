/**
 * أساسيو هذا اليوم — قائمة **مستقلة لهذا اليوم وحده**.
 * القاعدة: لا تُقرأ ولا تُعدَّل أي قائمة إلا بمعرّف يومها؛ إضافة شخص أو حذفه هنا
 * لا يمسّ أي يوم آخر في الديالة أو خارجها. والقائمة تُبنى يدويًا — لا تعبئة تلقائية.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ClipboardCopy, Copy, Plus, Trash2, UserRound, Wand2 } from "lucide-react";
import { useApp } from "../../store";
import {
  dayNumberInRound,
  dayOrdinal,
  rosterRows,
  roundOfDay,
  type RosterRow,
} from "../../domain/rules";
import type { DialaDay, Person } from "../../domain/types";
import { durationMin, formatDuration, isoToShort, minutesToTime, timeToMinutes, toHours } from "../../domain/util";
import { Button, Card, Field, Modal, NumberInput, Pill, Select, TextArea, TextInput, cx } from "../../components/ui";
import PersonPicker from "../../components/PersonPicker";

type ShareUnit = "hour" | "min";

export default function DayRosterPanel({ day, actor }: { day: DialaDay; actor: string }) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<Person | null>(null);
  const [newShare, setNewShare] = useState("1");
  const [newUnit, setNewUnit] = useState<ShareUnit>("hour");
  const [removeTarget, setRemoveTarget] = useState<RosterRow | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");

  const rows = useMemo(() => rosterRows(state, day.id), [state, day.id]);
  const totalMin = rows.reduce((sum, r) => sum + (r.shareMin || 0), 0);
  const capacityMin = durationMin(day.workStart, day.workEnd);
  const round = roundOfDay(state, day);
  const dayNo = dayNumberInRound(state, day);
  const startBase = timeToMinutes(day.workStart);

  /** الأيام التي يمكن نسخ قائمتها (غير هذا اليوم، ولها أساسيون) */
  const copyCandidates = useMemo(
    () =>
      state.days
        .filter((d) => !d.archived && d.id !== day.id)
        .map((d) => ({ day: d, count: rosterRows(state, d.id).length }))
        .filter((x) => x.count > 0)
        .sort((a, b) => (a.day.date > b.day.date ? -1 : 1))
        .slice(0, 40),
    [state, day.id]
  );

  const toMinutes = (value: string, unit: ShareUnit) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(unit === "hour" ? n * 60 : n);
  };

  const addPending = () => {
    if (!pending) return;
    actions.saveRosterMember(day.id, pending.id, toMinutes(newShare, newUnit), { actor });
    setPending(null);
  };

  const confirmRemove = () => {
    if (!removeTarget) return;
    actions.removeRosterMember(removeTarget.member.id, {
      reason: removeReason.trim() || "إزالة من أساسيي هذا اليوم",
      actor,
    });
    setRemoveTarget(null);
    setRemoveReason("");
  };

  return (
    <Card className="p-4" data-testid="day-roster">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <UserRound size={16} className="text-emerald-600" />
        <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">
          أساسيو هذا اليوم{round ? ` — اليوم ${dayOrdinal(dayNo)} من ديالة ${round.number}` : ""}
        </h2>
        <span className="mr-auto text-[11px] text-gray-400">
          {rows.length} شخص · {formatDuration(totalMin)} من {toHours(capacityMin)} ساعة
        </span>
      </div>

      <p className="rounded-2xl bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500 dark:bg-slate-700 dark:text-slate-300">
        هذه القائمة تخصّ <b>هذا اليوم وحده</b>: حذف أي شخص منها لا يمسّ أي يوم آخر، وكل يوم جديد يبدأ فارغًا.
        حصص اليوم تُبنى بالترتيب من بداية التشغيل ({day.workStart}).
      </p>

      {totalMin > capacityMin ? (
        <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          مجموع الحصص {formatDuration(totalMin)} يتجاوز نافذة اليوم ({formatDuration(capacityMin)}) — لا يُمنع،
          لكن النقص في توزيع الوقت سيظهر في التحقق أدناه.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-400" data-testid="roster-empty">
          لا يوجد أساسيون في هذا اليوم بعد — أضف من تريد، والقائمة خاصة بهذا اليوم وحده.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((row, index) => {
            const before = rows.slice(0, index).reduce((s, r) => s + (r.shareMin || 0), 0);
            const from = minutesToTime(startBase + before);
            const to = minutesToTime(startBase + before + (row.shareMin || 0));
            return (
              <div
                key={row.member.id}
                className="rounded-2xl border border-gray-100 p-3 dark:border-slate-700"
                data-testid={`roster-row-${row.member.id}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-extrabold text-gray-900 dark:text-white">
                        {row.name}
                      </span>
                      {row.isShareholder ? <Pill tone="green">مساهم في المضخة</Pill> : <Pill tone="gray">شخص مسجّل</Pill>}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-400">
                      {row.phone || "لا يوجد رقم"} · {from} → {to}
                    </div>
                  </div>
                  <ShareCell
                    row={row}
                    onSave={(min) => actions.saveRosterMember(day.id, row.personId, min, { actor })}
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => actions.moveRosterMember(day.id, row.member.id, -1, actor)}
                      disabled={index === 0}
                      aria-label={`تقديم ${row.name}`}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-slate-700"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => actions.moveRosterMember(day.id, row.member.id, 1, actor)}
                      disabled={index === rows.length - 1}
                      aria-label={`تأخير ${row.name}`}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-slate-700"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setRemoveTarget(row);
                        setRemoveReason("");
                      }}
                      aria-label={`إزالة ${row.name} من هذا اليوم`}
                      data-testid={`roster-remove-${row.member.id}`}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="flex-1" onClick={() => setPickerOpen(true)} data-testid="roster-add">
          <Plus size={18} /> إضافة إلى أساسيي هذا اليوم
        </Button>
        <Button
          variant="outline"
          disabled={rows.length === 0}
          onClick={() => actions.applyRosterToDay(day.id, { actor })}
          title="بناء ترتيب اليوم من أساسيي هذا اليوم"
          data-testid="roster-build"
        >
          <Wand2 size={16} /> بناء ترتيب اليوم
        </Button>
        <Button
          variant="ghost"
          disabled={copyCandidates.length === 0}
          onClick={() => {
            setCopyFrom(copyCandidates[0]?.day.id ?? "");
            setCopyOpen(true);
          }}
          title="نسخ قائمة يوم آخر إلى هذا اليوم"
        >
          <ClipboardCopy size={16} /> نسخ قائمة يوم آخر
        </Button>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
        «بناء ترتيب اليوم» يضيف/يحدّث صفوف المخطط حسب هذه القائمة — ولا يحذف أي صف فيه استخدام مسجّل.
      </p>

      <PersonPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        pumpId={pump.id}
        title="إضافة إلى أساسيي هذا اليوم"
        onSelect={(person) => {
          setPickerOpen(false);
          setPending(person);
          setNewShare(newUnit === "hour" ? "1" : "60");
        }}
      />

      <Modal open={Boolean(pending)} onClose={() => setPending(null)} title="حصة الشخص في هذا اليوم">
        {pending ? (
          <div className="space-y-4">
            <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              {pending.name} — {pending.phone || "لا يوجد رقم"}
            </p>
            <Field label="الحصة في هذا اليوم" hint="تُضاف لترتيب اليوم من بداية التشغيل">
              <div className="flex gap-2">
                <NumberInput
                  value={newShare}
                  onChange={(e) => setNewShare(e.target.value)}
                  inputMode="decimal"
                  min={0}
                  aria-label="حصة الشخص في هذا اليوم"
                  data-testid="roster-share-input"
                />
                <Select
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value as ShareUnit)}
                  aria-label="وحدة الحصة"
                  className="w-28"
                >
                  <option value="hour">ساعات</option>
                  <option value="min">دقائق</option>
                </Select>
              </div>
            </Field>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPending(null)}>
                إلغاء
              </Button>
              <Button className="flex-1" onClick={addPending} data-testid="roster-confirm-add">
                إضافة إلى اليوم
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(removeTarget)} onClose={() => setRemoveTarget(null)} title="إزالة من أساسيي هذا اليوم">
        {removeTarget ? (
          <div className="space-y-4">
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
              إزالة <b>{removeTarget.name}</b> من يوم {isoToShort(day.date)} فقط. لا تتغيّر أي قائمة في يوم آخر،
              ولا يُحذف أي سجل — الإزالة ناعمة ويُسجَّل السبب في سجل التدقيق.
            </p>
            <Field label="سبب الإزالة">
              <TextArea
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder="مثال: لا يحتاج دوره هذا اليوم"
                data-testid="roster-reason-input"
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRemoveTarget(null)}>
                إلغاء
              </Button>
              <Button variant="danger" className="flex-1" onClick={confirmRemove} data-testid="roster-confirm-remove">
                <Trash2 size={16} /> إزالة من هذا اليوم
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={copyOpen} onClose={() => setCopyOpen(false)} title="نسخ قائمة يوم آخر إلى هذا اليوم">
        <div className="space-y-4">
          <Field label="اليوم المصدر" hint="يُضاف من ليس موجودًا في هذا اليوم فقط — لا يُحذف أحد">
            <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} data-testid="copy-from">
              {copyCandidates.map((c) => (
                <option key={c.day.id} value={c.day.id}>
                  {isoToShort(c.day.date)} · {c.count} شخص
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCopyOpen(false)}>
              إلغاء
            </Button>
            <Button
              className="flex-1"
              disabled={!copyFrom}
              onClick={() => {
                actions.copyRoster(copyFrom, day.id, actor);
                setCopyOpen(false);
              }}
              data-testid="copy-confirm"
            >
              <Copy size={16} /> نسخ القائمة
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/** خانة الحصة: تُكتب ساعات أو دقائق وتُحفظ بالدقائق */
function ShareCell({
  row,
  onSave,
}: {
  row: RosterRow;
  onSave: (shareMin: number) => void;
}) {
  const [unit, setUnit] = useState<ShareUnit>(row.shareMin % 60 === 0 && row.shareMin >= 60 ? "hour" : "min");
  const [value, setValue] = useState(() => (row.shareMin % 60 === 0 && row.shareMin >= 60 ? String(toHours(row.shareMin)) : String(Math.round(row.shareMin))));

  useEffect(() => {
    const whole = row.shareMin % 60 === 0 && row.shareMin >= 60;
    setValue(whole ? String(toHours(row.shareMin)) : String(Math.round(row.shareMin)));
  }, [row.shareMin]);

  const commitValue = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    const min = Math.round(unit === "hour" ? n * 60 : n);
    if (min !== row.shareMin) onSave(min);
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <label className="sr-only" htmlFor={`share-${row.member.id}`}>
        حصة {row.name}
      </label>
      <TextInput
        id={`share-${row.member.id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commitValue}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        inputMode="decimal"
        className={cx("w-16 px-2 py-1.5 text-center text-xs font-bold")}
        aria-label={`حصة ${row.name}`}
        data-testid={`roster-share-${row.member.id}`}
      />
      <select
        value={unit}
        onChange={(e) => {
          setUnit(e.target.value as ShareUnit);
          commitValue();
        }}
        aria-label={`وحدة حصة ${row.name}`}
        className="rounded-xl border border-gray-200 bg-gray-50 px-1.5 py-1.5 text-[11px] font-bold text-gray-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      >
        <option value="hour">ساعة</option>
        <option value="min">دقيقة</option>
      </select>
    </div>
  );
}
