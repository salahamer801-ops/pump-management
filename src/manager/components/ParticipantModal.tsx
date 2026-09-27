/**
 * نافذة **إضافة مشارك في دوام اليوم** — خطوة واحدة لكل شخص.
 *
 * ما تجمعه في مكان واحد: الاسم (مع اقتراح أثناء الكتابة من كشف الديالة ثم المسجّلين) ·
 * من – إلى والمدة · سبب النقص عند تقليل النصيب · الديزل المستحق والمدفوع منه والنقص ·
 * الرواسة (نقد / أجل / جزء نقد وجزء أجل) · ملاحظات — و«حفظ وإضافة التالي» لتسلسل الإدخال.
 *
 * منع التعارض: أي تداخل مع صف/استخدام آخر أو خروج عن نافذة تشغيل اليوم يمنع الحفظ
 * (والمنع مطبَّق أيضًا في المخزن، لا في هذه النافذة وحدها).
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Droplets,
  Fuel,
  HandCoins,
  Plus,
  Timer,
  UserPlus,
} from "lucide-react";
import { useApp } from "../../store";
import {
  ROYALTY_MODE_OPTIONS,
  SHORTFALL_REASON_OPTIONS,
  baseShareMinFor,
  checkDaySpan,
  computeUsageDraft,
  currentRight,
  dayFreeGaps,
  daySpanRows,
  findPerson,
  pumpWindow,
  shareholderOfPerson,
  shortfallReasonLabel,
  stoppageMinutesInRange,
  suggestPeople,
} from "../../domain/rules";
import type {
  DayEntry,
  DialaDay,
  EntryRole,
  Person,
  RoyaltyPayMode,
  ShortfallReason,
  UsageType,
} from "../../domain/types";
import {
  formatDuration,
  minutesToTime,
  timeToMinutes,
  toHours,
  todayISO,
  uid,
} from "../../domain/util";
import { formatMoney, formatNumber } from "../../format";
import {
  Button,
  Field,
  Modal,
  NumberInput,
  Pill,
  Select,
  TextArea,
  TextInput,
  TimeInput,
  cx,
} from "../../components/ui";
import { roleLabel } from "../../components/PersonPicker";

interface Suggestion {
  person: Person;
  hint: string;
  fromRoster: boolean;
  usedToday: boolean;
  baseShareMin: number;
}

export default function ParticipantModal({
  day,
  actor,
  onClose,
}: {
  day: DialaDay;
  actor: string;
  onClose: () => void;
}) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const window = pumpWindow(pump, day);

  const gaps = useMemo(() => dayFreeGaps(state, day, pump), [state, day, pump]);
  const firstSlot = gaps[0] ?? null;
  const defaultStart = firstSlot?.startTime ?? window.start;
  const defaultEnd = firstSlot
    ? minutesToTime(timeToMinutes(firstSlot.startTime) + Math.min(60, Math.max(1, firstSlot.minutes)))
    : window.end;

  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<Person | null>(null);
  const [role, setRole] = useState<EntryRole>("shareholder");
  const [usageType, setUsageType] = useState<UsageType>("share");
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [paid, setPaid] = useState("");
  const [royaltyPayMode, setRoyaltyPayMode] = useState<RoyaltyPayMode>("credit");
  const [royaltyCash, setRoyaltyCash] = useState("");
  const [shortfallReason, setShortfallReason] = useState<ShortfallReason>("");
  const [shortfallNote, setShortfallNote] = useState("");
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  /* ------------------------------ الاقتراحات ------------------------------ */
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = query.trim().toLowerCase();
    const usedToday = new Set(daySpanRows(state, day, pump).map((r) => r.personId));
    const rosterIds = new Set<string>();
    const out: Suggestion[] = [];
    for (const row of state.roster.filter((r) => r.roundId === day.roundId && !r.archived)) {
      const p = findPerson(state, row.personId);
      if (!p || p.archived) continue;
      if (q && !p.name.toLowerCase().includes(q) && !p.phone.includes(q)) continue;
      rosterIds.add(p.id);
      out.push({
        person: p,
        hint: `${roleLabel(row.role)} · ${formatDuration(row.shareMin)} · ${p.phone || "لا رقم"}`,
        fromRoster: true,
        usedToday: usedToday.has(p.id),
        baseShareMin: row.shareMin,
      });
    }
    for (const s of suggestPeople(state, pump.id, query, 40)) {
      if (rosterIds.has(s.person.id) || s.person.archived) continue;
      if (out.length >= 40) break;
      out.push({
        person: s.person,
        hint: `${s.tags.length ? `${s.tags.join(" · ")} · ` : ""}${s.person.phone || "لا رقم"}`,
        fromRoster: false,
        usedToday: usedToday.has(s.person.id),
        baseShareMin: 0,
      });
    }
    return out;
  }, [query, state, day, pump]);

  /* -------------------------------- الأوقات ------------------------------- */
  const span = useMemo(
    () => checkDaySpan(state, day, pump, startTime, endTime),
    [state, day, pump, startTime, endTime]
  );
  /** المدة من طبقة القواعد (مصدر واحد) */
  const minutes = span.minutes;

  const stoppageMin = stoppageMinutesInRange(
    state,
    day.id,
    startTime,
    endTime,
    timeToMinutes(window.start),
    window.capacityMin
  );
  const draft = computeUsageDraft(pump, day, startTime, endTime, { personalFuelPrice: 0, stoppageMin });
  const price = draft.personalFuelPriceSnapshot > 0 ? draft.personalFuelPriceSnapshot : draft.fuelPriceSnapshot;
  const due = Math.round(draft.fuelAmountDue);
  const paidValue = paid.trim() === "" ? due : Math.max(0, Math.round(Number(paid.replace(",", ".")) || 0));
  const shortageAmount = Math.max(0, due - paidValue);
  const shortageLiters = price > 0 ? Math.round((shortageAmount / price) * 10) / 10 : 0;
  const dieselSettlement = due <= 0 || paidValue >= due - 1 ? "paid" : paidValue <= 0 ? "unpaid" : "shortage";

  const royaltyDue = Math.round(draft.royaltyAmountDue);
  const cashValue =
    royaltyPayMode === "cash"
      ? royaltyDue
      : royaltyPayMode === "credit"
        ? 0
        : royaltyCash.trim() === ""
          ? Math.round(royaltyDue / 2)
          : Math.max(0, Math.min(royaltyDue, Math.round(Number(royaltyCash.replace(",", ".")) || 0)));
  const deferredValue = Math.max(0, royaltyDue - cashValue);

  /* ------------------------------ سبب النقص ------------------------------ */
  const baseShareMin = person ? baseShareMinFor(state, day.roundId ?? null, person.id) : 0;
  const shortfallMin = baseShareMin > 0 ? Math.max(0, baseShareMin - minutes) : 0;
  const needReason = Boolean(person) && shortfallMin > 0;
  const reasonMissing = needReason && !shortfallReason;

  const allocated = useMemo(
    () => daySpanRows(state, day, pump).reduce((s, r) => s + r.minutes, 0),
    [state, day, pump]
  );
  const remaining = Math.max(0, window.capacityMin - allocated);

  /* -------------------------------- الحفظ -------------------------------- */
  const canSave = Boolean(person) && span.ok && !reasonMissing;

  const resetAfterSave = (nextStart: string) => {
    setPerson(null);
    setQuery("");
    setPaid("");
    setRoyaltyCash("");
    setRoyaltyPayMode("credit");
    setShortfallReason("");
    setShortfallNote("");
    setNotes("");
    setNewOpen(false);
    setNewName("");
    setNewPhone("");
    setStartTime(nextStart);
    setEndTime(minutesToTime(timeToMinutes(nextStart) + 60));
  };

  const save = (andNext: boolean) => {
    if (!person || !canSave) return;
    const shareholder = shareholderOfPerson(state, pump.id, person.id);
    const right = shareholder ? currentRight(state, shareholder.id, day.date) : null;
    const entry: DayEntry = {
      id: uid("en"),
      dayId: day.id,
      pumpId: pump.id,
      orderIndex: daySpanRows(state, day, pump).length,
      personId: person.id,
      role,
      shareholderId: shareholder?.id ?? null,
      rightId: right?.id ?? null,
      startTime,
      endTime,
      plannedMin: span.minutes,
      actualPersonId: null,
      usageId: null,
      status: "planned",
      postponeToDayId: null,
      reason: "",
      notes,
      shortfallReason,
      shortfallNote,
      createdAt: new Date().toISOString(),
      createdBy: actor,
      archived: false,
    };
    actions.saveEntry(entry, true, {
      actor,
      correctionReason: `إضافة مشارك في دوام اليوم — ${formatDuration(span.minutes)}`,
    });
    actions.recordUsage({
      dayId: day.id,
      entryId: entry.id,
      personId: person.id,
      shareholderId: shareholder?.id ?? null,
      rightHolderId: right?.holderPersonId ?? null,
      usageType,
      startTime,
      endTime,
      notes,
      dieselSettlement,
      dieselShortageLiters: dieselSettlement === "shortage" ? shortageLiters : 0,
      dieselPaidAmount: paidValue,
      royaltyPayMode,
      royaltyCashAmount: cashValue,
      royaltyDeferredAmount: deferredValue,
      shortfallReason,
      shortfallNote,
      settlementNote: [
        shortfallReason ? `سبب النقص: ${shortfallReasonLabel(shortfallReason)}` : "",
        shortfallNote,
        notes,
      ]
        .filter(Boolean)
        .join(" — "),
      overCapacityReason: "",
      personalFuelPrice: 0,
      actor,
    });
    setAdded((prev) => [...prev, `${person.name} (${startTime} → ${endTime})`]);
    if (andNext) resetAfterSave(endTime);
    else onClose();
  };

  return (
    <Modal open onClose={onClose} title="إضافة مشارك في دوام اليوم">
      <div className="space-y-3">
        {/* شريط نافذة اليوم */}
        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          نافذة تشغيل اليوم {window.start} → {window.end} ({toHours(window.capacityMin)} س) · الموزَّع{" "}
          {formatDuration(allocated)} · المتبقي {formatDuration(remaining)}
          {firstSlot ? ` · أول فراغ: ${firstSlot.startTime} → ${firstSlot.endTime}` : " · لا فراغ متبقٍ"}
        </div>

        {/* 1) الاسم */}
        {person ? (
          <div className="rounded-2xl border border-emerald-200 bg-white px-3 py-2 dark:border-emerald-900/40 dark:bg-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold text-gray-900 dark:text-white">{person.name}</span>
              <Pill tone="green">{roleLabel(role)}</Pill>
              {baseShareMin > 0 ? <Pill tone="blue">نصيبه في الكشف {formatDuration(baseShareMin)}</Pill> : null}
              <button
                className="mr-auto text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
                onClick={() => {
                  setPerson(null);
                  setQuery("");
                }}
              >
                تغيير الاسم
              </button>
            </div>
            {person.phone ? (
              <div className="mt-0.5 text-[11px] text-gray-400" dir="ltr">
                {person.phone}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <Field label="اسم المشارك" hint="اقتراحات فورية: مساهمو كشف الديالة أولًا، ثم المسجّلون">
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="اكتب أول حروف الاسم…"
                autoFocus
                data-testid="participant-name"
                aria-label="اسم المشارك"
              />
            </Field>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {suggestions.length === 0 ? (
                <p className="py-3 text-center text-xs text-gray-400">لا نتائج مطابقة — أضف الاسم كشخص جديد.</p>
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s.person.id}
                    onClick={() => {
                      setPerson(s.person);
                      setQuery(s.person.name);
                      setRole(s.fromRoster ? "shareholder" : "other");
                      setUsageType(s.fromRoster ? "share" : "guest");
                      const base = s.baseShareMin || baseShareMinFor(state, day.roundId ?? null, s.person.id) || 60;
                      const slot = gaps.find((g) => g.minutes >= Math.round(base)) ?? gaps[0] ?? null;
                      const start = slot ? slot.startTime : startTime;
                      const dur = Math.max(1, Math.min(Math.round(base), slot ? slot.minutes : Math.round(base)));
                      setStartTime(start);
                      setEndTime(minutesToTime(timeToMinutes(start) + dur));
                      setShortfallReason("");
                      setShortfallNote("");
                    }}
                    className={cx(
                      "flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-right transition",
                      s.fromRoster
                        ? "border-emerald-100 bg-emerald-50/50 hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-900/10"
                        : "border-gray-100 bg-white hover:border-emerald-200 dark:border-slate-700 dark:bg-slate-800"
                    )}
                    data-testid={`participant-suggest-${s.person.id}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-emerald-700 dark:bg-slate-800 dark:text-emerald-300">
                      {s.person.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-extrabold text-gray-800 dark:text-white">
                        {s.person.name}
                      </span>
                      <span className="block truncate text-[10px] text-gray-400">{s.hint}</span>
                    </span>
                    {s.fromRoster ? <Pill tone="blue">من الكشف</Pill> : null}
                    {s.usedToday ? <Pill tone="amber">له نصيب اليوم</Pill> : null}
                  </button>
                ))
              )}
            </div>
            <button
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
              onClick={() => {
                setNewName(query.trim());
                setNewOpen(true);
              }}
              data-testid="participant-new"
            >
              <UserPlus size={13} /> إضافة شخص جديد {query.trim() ? `«${query.trim()}»` : ""}
            </button>
          </>
        )}

        {/* 2) الأوقات */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="البداية">
            <TimeInput
              value={startTime}
              onChange={(e) => {
                const next = e.target.value;
                setStartTime(next);
                setEndTime(minutesToTime(timeToMinutes(next) + Math.max(1, minutes || 60)));
              }}
              data-testid="participant-start"
            />
          </Field>
          <Field label="النهاية">
            <TimeInput value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="participant-end" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2 text-[11px] font-bold dark:bg-slate-700">
          <Timer size={13} className="text-emerald-600" />
          المدة {formatDuration(minutes)}
          {span.crossesMidnight ? " · يعبر منتصف الليل" : ""}
          {gaps.slice(0, 3).map((g) => (
            <button
              key={`${g.from}-${g.to}`}
              onClick={() => {
                setStartTime(g.startTime);
                setEndTime(minutesToTime(timeToMinutes(g.startTime) + Math.min(60, g.minutes)));
              }}
              className="rounded-xl bg-white px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-slate-800 dark:text-emerald-300"
              title="اختر هذا الفراغ"
            >
              فراغ {g.startTime} → {g.endTime}
            </button>
          ))}
        </div>

        {person && span.errors.length > 0 ? (
          <div
            className="space-y-1 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
            data-testid="participant-conflict"
          >
            <div className="flex items-center gap-1">
              <AlertTriangle size={13} /> لا يمكن الحفظ — تعارض في بيانات التشغيل
            </div>
            {span.errors.map((err) => (
              <div key={err} className="font-normal">
                {err}
              </div>
            ))}
            {span.nextFree ? (
              <div className="font-normal">
                أقرب وقت متاح لمدة {formatDuration(minutes)}: {span.nextFree.startTime} → {span.nextFree.endTime}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 3) سبب النقص */}
        {needReason ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-900/20">
            <div className="text-[11px] font-extrabold text-amber-800 dark:text-amber-300">
              نقص عن نصيبه في الكشف بمقدار {formatDuration(shortfallMin)} — اختر السبب (إلزامي)
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SHORTFALL_REASON_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setShortfallReason(o.id)}
                  className={cx(
                    "rounded-xl border px-2.5 py-1 text-[11px] font-bold transition",
                    shortfallReason === o.id
                      ? "border-amber-400 bg-white text-amber-800"
                      : "border-amber-200 text-amber-700 dark:border-amber-900/40 dark:text-amber-300"
                  )}
                  data-testid={`shortfall-${o.id}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <TextInput
                value={shortfallNote}
                onChange={(e) => setShortfallNote(e.target.value)}
                placeholder="تفصيل السبب (اختياري) — مثال: أخذ سلفة وسدّدها لاحقًا"
                aria-label="تفصيل سبب النقص"
              />
            </div>
          </div>
        ) : null}

        {/* 4) الديزل */}
        <div className="rounded-2xl bg-gray-50 p-3 dark:bg-slate-700/50">
          <div className="flex items-center gap-1 text-[11px] font-extrabold text-gray-700 dark:text-slate-200">
            <Fuel size={13} className="text-amber-600" /> الديزل
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] dark:text-slate-200">
            <span className="text-gray-500 dark:text-slate-300">المستحق</span>
            <span className="text-left font-bold" dir="ltr">
              {formatMoney(due, pump.currency)} · {draft.fuelLiters} لتر
            </span>
            <span className="text-gray-500 dark:text-slate-300">النقص</span>
            <span className={cx("text-left font-bold", shortageAmount > 0 ? "text-red-600" : "text-emerald-700")} dir="ltr">
              {formatMoney(shortageAmount, pump.currency)} · {shortageLiters} لتر
            </span>
            <span className="text-gray-500 dark:text-slate-300">حالة التسديد</span>
            <span className="text-left font-bold">
              {dieselSettlement === "paid" ? "مسدد" : dieselSettlement === "shortage" ? "نقص" : "غير مسدد"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="min-w-[120px] flex-1">
              <Field label="المدفوع فعلًا من هذا الشخص">
                <NumberInput
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  placeholder={String(due)}
                  aria-label="المدفوع من الديزل"
                  data-testid="participant-diesel-paid"
                />
              </Field>
            </div>
            <Button variant="secondary" className="px-3 py-2 text-[11px]" onClick={() => setPaid(String(due))}>
              <Check size={13} /> دفع الكامل
            </Button>
            <Button variant="outline" className="px-3 py-2 text-[11px]" onClick={() => setPaid("0")}>
              لم يدفع
            </Button>
          </div>
        </div>

        {/* 5) الرواسة */}
        <div className="rounded-2xl bg-gray-50 p-3 dark:bg-slate-700/50">
          <div className="flex items-center gap-1 text-[11px] font-extrabold text-gray-700 dark:text-slate-200">
            <HandCoins size={13} className="text-emerald-600" /> الرواسة — المستحق{" "}
            {formatMoney(royaltyDue, pump.currency)}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {ROYALTY_MODE_OPTIONS.map((o) => (
              <button
                key={o.id}
                title={o.action}
                onClick={() => setRoyaltyPayMode(o.id)}
                className={cx(
                  "rounded-2xl border px-2 py-2 text-[11px] font-bold transition",
                  royaltyPayMode === o.id
                    ? o.id === "cash"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                      : "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-gray-200 text-gray-500 dark:border-slate-600 dark:text-slate-300"
                )}
                data-testid={`royalty-${o.id}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {royaltyPayMode === "partial" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="المدفوع نقدًا">
                <NumberInput
                  value={royaltyCash}
                  onChange={(e) => setRoyaltyCash(e.target.value)}
                  placeholder={String(Math.round(royaltyDue / 2))}
                  aria-label="المدفوع نقدًا من الرواسة"
                />
              </Field>
              <div className="flex items-end pb-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                الباقي أجلًا: {formatMoney(deferredValue, pump.currency)}
              </div>
            </div>
          ) : null}
        </div>

        {/* 6) نوع الاستخدام والصفة والملاحظات */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="صفته">
            <Select value={role} onChange={(e) => setRole(e.target.value as EntryRole)}>
              <option value="shareholder">مساهم أساسي</option>
              <option value="right_holder">صاحب حق</option>
              <option value="tenant">مستأجر</option>
              <option value="guest">ضيف / ليس له سهم</option>
              <option value="other">أخرى</option>
            </Select>
          </Field>
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
        </div>
        <Field label="ملاحظات">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>

        {added.length > 0 ? (
          <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
            أُضيف في هذا اليوم: {added.slice(-3).join(" · ")}
            {added.length > 3 ? ` (+${added.length - 3})` : ""}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="px-3" onClick={onClose}>
            إغلاق
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            disabled={!canSave}
            onClick={() => save(true)}
            data-testid="participant-save-next"
          >
            <Droplets size={16} /> حفظ وإضافة التالي
          </Button>
          <Button className="flex-1" disabled={!canSave} onClick={() => save(false)} data-testid="participant-save">
            <Plus size={16} /> حفظ
          </Button>
        </div>
        {reasonMissing ? (
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
            اختر سبب النقص قبل الحفظ — السبب يُحفظ مع المشارك للمراجعة.
          </p>
        ) : null}
        <p className="text-[10px] leading-relaxed text-gray-400">
          يُحفظ الصف والاستخدام في خطوة واحدة، والحركات المالية (استحقاق/سداد) تُسجَّل تلقائيًا حسب المدفوع
          وحالة الرواسة. الأوقات يجب أن تبقى متسلسلة داخل نافذة اليوم بلا أي تداخل.
        </p>
      </div>

      {newOpen ? (
        <Modal open onClose={() => setNewOpen(false)} title="شخص جديد">
          <div className="space-y-3">
            <Field label="الاسم">
              <TextInput
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                data-testid="participant-new-name"
                aria-label="اسم الشخص الجديد"
              />
            </Field>
            <Field label="الهاتف (اختياري)">
              <TextInput
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                dir="ltr"
                placeholder="7XXXXXXXX"
                data-testid="participant-new-phone"
                aria-label="هاتف الشخص الجديد"
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setNewOpen(false)}>
                إلغاء
              </Button>
              <Button
                className="flex-1"
                disabled={!newName.trim()}
                onClick={() => {
                  const p: Person = {
                    id: uid("pr"),
                    name: newName.trim(),
                    phone: newPhone.trim(),
                    nationalId: "",
                    notes: "أُضيف من دوام اليوم الفعلي",
                    guest: false,
                    archived: false,
                    createdAt: todayISO(),
                    createdBy: actor,
                  };
                  actions.savePerson(p, true);
                  setPerson(p);
                  setQuery(p.name);
                  setRole("other");
                  setUsageType("guest");
                  setNewOpen(false);
                }}
                data-testid="participant-new-save"
              >
                <UserPlus size={16} /> إضافة واختيار
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </Modal>
  );
}

/** وسيلة عرض مساعدة: عدد لترات النقص بصيغة مقروءة */
export function shortageLitersLabel(liters: number): string {
  return `${formatNumber(liters)} لتر`;
}
