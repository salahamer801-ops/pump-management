import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  Droplets,
  Link2,
  Plus,
  Scale,
  Search,
  UserRound,
} from "lucide-react";
import { useShareholder } from "../store";
import type { ShareholderTurn } from "../types";
import type { AppState, Person, PersonalRecord } from "../../domain/types";
import { appendPersonalRecord, readManagerState, readUserLink, saveUserLink } from "../../domain/storage";
import { durationMin, formatDuration, minutesToTime, timeToMinutes, todayISO, uid } from "../../domain/util";
import { formatMoney, formatNumber } from "../../format";
import { Button, Card, Field, Modal, NumberInput, Pill, StatCard, TextArea, TextInput, TimeInput, cx } from "../../components/ui";

/**
 * السجل الرسمي ودوري — يقرأ بيانات المسؤول (قراءة فقط) ويعرض الاختلاف
 * بين السجل الرسمي والسجل الشخصي (§30-33، §52).
 */
export default function OfficialScreen() {
  const { actions } = useShareholder();
  const [manager, setManager] = useState<AppState | null>(() => readManagerState());
  const [personId, setPersonId] = useState<string | null>(() => readUserLink());
  const [linkOpen, setLinkOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);

  useEffect(() => {
    setManager(readManagerState());
  }, []);

  const pump = manager?.pump ?? null;
  const currency = pump?.currency ?? "YER";
  const person: Person | null = useMemo(
    () => (manager && personId ? manager.persons.find((p) => p.id === personId) ?? null : null),
    [manager, personId]
  );

  const myData = useMemo(() => {
    if (!manager || !personId) return null;
    const days = manager.days.filter((d) => !d.archived);
    const entries = manager.entries.filter(
      (e) => !e.archived && (e.personId === personId || e.actualPersonId === personId)
    );
    const upcoming = entries
      .map((e) => ({ entry: e, day: days.find((d) => d.id === e.dayId) }))
      .filter((x) => x.day && x.day.date >= todayISO())
      .sort((a, b) => (a.day!.date < b.day!.date ? -1 : 1));
    const usages = manager.usages.filter((u) => u.personId === personId && u.status === "active");
    const totals = {
      minutes: usages.reduce((s, u) => s + u.minutes, 0),
      liters: usages.reduce((s, u) => s + u.fuelLiters, 0),
      fuel: usages.reduce((s, u) => s + u.fuelAmountDue, 0),
      royalty: usages.reduce((s, u) => s + u.royaltyAmountDue, 0),
    };
    const personal = manager.personalRecords.filter((p) => p.personId === personId && !p.archived);
    const rights = manager.rights.filter(
      (r) => r.pumpId === (pump?.id ?? "") && r.holderPersonId === personId
    );
    const shareholder = manager.shareholders.find((s) => s.personId === personId && !s.archived) ?? null;
    const balance = manager.transactions
      .filter((t) => t.personId === personId && t.status === "posted")
      .reduce((s, t) => s + (t.direction === "debit" ? t.amount : -t.amount), 0);

    const dates = Array.from(
      new Set<string>([...usages.map((u) => u.date), ...personal.map((p) => p.date)])
    ).sort((a, b) => (a < b ? 1 : -1));
    const compare = dates.map((date) => {
      const official = usages.filter((u) => u.date === date).reduce((s, u) => s + u.minutes, 0);
      const personalMin = personal.filter((p) => p.date === date).reduce((s, p) => s + p.minutes, 0);
      const diff = official - personalMin;
      const status =
        official > 0 && personalMin === 0
          ? "رسمي فقط"
          : personalMin > 0 && official === 0
            ? "شخصي فقط"
            : diff === 0
              ? "مطابق"
              : "مختلف";
      return { date, official, personalMin, diff, status };
    });

    return { upcoming, usages, totals, personal, rights, shareholder, balance, compare };
  }, [manager, personId, pump?.id]);

  if (!manager || !pump) {
    return (
      <Card className="space-y-2 p-5 text-center">
        <Droplets size={26} className="mx-auto text-emerald-500" />
        <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">لا يوجد سجل رسمي بعد</h2>
        <p className="text-[11px] leading-relaxed text-gray-500 dark:text-slate-300">
          لم يسجّل المسؤول بيانات المضخة على هذا الجهاز. سجلك الشخصي يعمل بشكل مستقل، وعند تسجيل المسؤول
          بياناته ستظهر هنا المقارنة بين سجلك وسجله.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">ارتباطي بالمضخة</h2>
          <button
            onClick={() => setLinkOpen(true)}
            className="mr-auto rounded-xl bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          >
            {person ? "تغيير" : "من أنا؟"}
          </button>
        </div>
        {person ? (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs font-extrabold text-gray-800 dark:text-white">
              <BadgeCheck size={14} className="text-emerald-600" /> {person.name}
              {myData?.shareholder ? (
                <Pill tone="green">
                  مساهم أساسي · {formatNumber(myData.shareholder.units)} {pump.shareUnit}
                </Pill>
              ) : null}
            </div>
            {myData?.rights.filter((r) => r.status === "active").length ? (
              <div className="flex flex-wrap gap-1">
                {myData.rights
                  .filter((r) => r.status === "active")
                  .map((r) => (
                    <Pill key={r.id} tone="amber">
                      {r.kind === "rent" ? "مستأجر" : "صاحب حق"} حتى {r.endedAt ?? "غير محدد"}
                    </Pill>
                  ))}
              </div>
            ) : null}
            <div className="text-[11px] text-gray-400">
              الرصيد الحالي:{" "}
              <span className={cx("font-bold", myData && myData.balance > 0 ? "text-red-600" : "text-emerald-600")}>
                {formatMoney(Math.abs(myData?.balance ?? 0), currency)}
                {myData && myData.balance > 0 ? " عليك" : ""}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-slate-300">
            حدّد من أنت من قائمة الأشخاص المسجّلين عند المسؤول لعرض دورك وسجلك الرسمي ومقارنته بسجلك الشخصي.
          </p>
        )}
      </Card>

      {person && myData ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="ساعاتي الرسمية"
              value={formatDuration(myData.totals.minutes)}
              icon={<CalendarClock size={13} />}
            />
            <StatCard
              label="ديزلي (لتر)"
              value={`${formatNumber(myData.totals.liters)}`}
              tone="blue"
              icon={<Droplets size={13} />}
            />
            <StatCard
              label="قيمة الديزل الرسمية"
              value={formatMoney(myData.totals.fuel, currency)}
              tone="gray"
            />
            <StatCard label="الرواسة الرسمية" value={formatMoney(myData.totals.royalty, currency)} tone="amber" />
          </div>

          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <CalendarClock size={16} className="text-emerald-600" />
              <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">دوري القادم</h2>
            </div>
            {myData.upcoming.length === 0 ? (
              <p className="text-xs text-gray-400">لا يوجد دور قادم مسجّل لك.</p>
            ) : (
              <div className="space-y-2">
                {myData.upcoming.slice(0, 4).map(({ entry, day }) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2 text-[11px] dark:bg-slate-700"
                  >
                    <div className="flex-1">
                      <div className="font-extrabold text-gray-800 dark:text-white">
                        {day!.date === todayISO() ? "اليوم" : day!.date} — ديالة {day!.dialaNumber}
                      </div>
                      <div className="text-gray-400">
                        {entry.startTime} → {entry.endTime} · {formatDuration(durationMin(entry.startTime, entry.endTime))}
                      </div>
                    </div>
                    <Pill tone={entry.status === "done" ? "green" : entry.status === "cancelled" ? "red" : "blue"}>
                      {entry.status === "done" ? "تم" : entry.status === "cancelled" ? "ملغى" : "قادم"}
                    </Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Scale size={16} className="text-emerald-600" />
              <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">
                سجلي الرسمي مقابل سجلي الشخصي
              </h2>
            </div>
            {myData.compare.length === 0 ? (
              <p className="text-xs text-gray-400">لا توجد أيام مسجّلة باسمك بعد.</p>
            ) : (
              <div className="space-y-2">
                {myData.compare.map((row) => (
                  <div
                    key={row.date}
                    className={cx(
                      "rounded-2xl border px-3 py-2 text-[11px]",
                      row.status === "مطابق"
                        ? "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/20"
                        : "border-amber-100 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-700 dark:text-slate-200">{row.date}</span>
                      <Pill tone={row.status === "مطابق" ? "green" : "amber"}>{row.status}</Pill>
                      <span className="mr-auto text-gray-500 dark:text-slate-300">
                        رسمي {formatDuration(row.official)} / شخصي {formatDuration(row.personalMin)}
                        {row.diff !== 0 ? ` (فرق ${formatDuration(Math.abs(row.diff))})` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
              النظام لا يحذف أي سجل ولا يحل الاختلاف تلقائيًا — يعرض السجلين، والتسوية تتم علنًا من شاشة المسؤول.
            </p>
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <ClipboardCheck size={16} className="text-emerald-600" />
              <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">سجلاتي الرسمية</h2>
              <button
                onClick={() => setRecordOpen(true)}
                className="mr-auto rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
              >
                <Plus size={12} className="inline -mt-0.5" /> تسجيل يومي
              </button>
            </div>
            {myData.usages.length === 0 ? (
              <p className="text-xs text-gray-400">لا توجد سجلات استخدام رسمية باسمك.</p>
            ) : (
              <div className="space-y-2">
                {myData.usages
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-2 rounded-2xl border border-gray-100 px-3 py-2 text-[11px] dark:border-slate-700"
                    >
                      <span className="flex-1 font-bold text-gray-700 dark:text-slate-200">
                        {u.date} · {u.startTime} → {u.endTime}
                      </span>
                      <span className="text-gray-500 dark:text-slate-300">{formatDuration(u.minutes)}</span>
                      <span className="text-gray-400">{formatNumber(u.fuelLiters)} لتر</span>
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {formatMoney(u.fuelAmountDue + u.royaltyAmountDue, currency)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </Card>

          {myData.personal.length > 0 ? (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-extrabold text-gray-800 dark:text-white">سجلي الشخصي (لا يعدّله المسؤول)</h2>
              <div className="space-y-2">
                {myData.personal
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl bg-sky-50 px-3 py-2 text-[11px] dark:bg-sky-900/20"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sky-800 dark:text-sky-200">{r.date}</span>
                        <span className="text-sky-700 dark:text-sky-300">{formatDuration(r.minutes)}</span>
                        <span className="mr-auto text-sky-700 dark:text-sky-300">
                          {formatNumber(r.dieselLiters)} لتر × {formatNumber(r.dieselPricePerLiter)}
                        </span>
                      </div>
                      {r.notes ? <div className="mt-1 text-[10px] text-sky-700/80">{r.notes}</div> : null}
                    </div>
                  ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {linkOpen ? (
        <Modal open onClose={() => setLinkOpen(false)} title="من أنا؟">
          <div className="space-y-3">
            <div className="relative">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث باسمك…"
                className="pr-11"
              />
            </div>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto">
              {manager.persons
                .filter((p) => !p.archived && (!query.trim() || p.name.includes(query.trim())))
                .map((p) => {
                  const shareholder = manager.shareholders.find((s) => s.personId === p.id && !s.archived);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPersonId(p.id);
                        saveUserLink(p.id);
                        setLinkOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 px-3 py-3 text-right hover:border-emerald-200 dark:border-slate-700"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <UserRound size={16} />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-gray-800 dark:text-white">{p.name}</span>
                        <span className="block text-[11px] text-gray-400">
                          {p.phone || "بلا رقم"} · {shareholder ? "مساهم أساسي" : "غير مسجّل كمساهم"}
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
            {personId ? (
              <button
                onClick={() => {
                  setPersonId(null);
                  saveUserLink(null);
                  setLinkOpen(false);
                }}
                className="w-full text-center text-[11px] font-bold text-red-500"
              >
                إلغاء الارتباط
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {recordOpen && personId ? (
        <DailyRecordModal
          personId={personId}
          personName={person?.name ?? ""}
          currency={currency}
          onClose={() => setRecordOpen(false)}
          onSaved={() => {
            setManager(readManagerState());
          }}
          addToMyBook={(turn) => actions.addTurn(turn)}
        />
      ) : null}
    </div>
  );
}

function DailyRecordModal({
  personId,
  personName,
  currency,
  onClose,
  onSaved,
  addToMyBook,
}: {
  personId: string;
  personName: string;
  currency: "YER" | "SAR" | "USD";
  onClose: () => void;
  onSaved: () => void;
  addToMyBook: (turn: ShareholderTurn) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("09:00");
  const [liters, setLiters] = useState(0);
  const [price, setPrice] = useState(0);
  const [royalty, setRoyalty] = useState(0);
  const [paid, setPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const minutes = durationMin(start, end);
  const dieselAmount = Math.round(liters * price);

  return (
    <Modal open onClose={onClose} title="تسجيل يومي في سجلي الشخصي">
      <div className="space-y-3">
        <p className="rounded-2xl bg-gray-50 px-3 py-2 text-[11px] text-gray-500 dark:bg-slate-700 dark:text-slate-300">
          السجل باسم <b>{personName}</b> — يُسجَّل كسجل شخصي مستقل، ولا يستطيع المسؤول تعديله.
        </p>
        <Field label="التاريخ">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="من">
            <TimeInput value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="إلى">
            <TimeInput value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          المدة: {formatDuration(minutes)} {timeToMinutes(end) <= timeToMinutes(start) ? "(يعبر منتصف الليل)" : ""}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="كمية الديزل (لتر)">
            <NumberInput value={liters} onChange={(e) => setLiters(Number(e.target.value))} />
          </Field>
          <Field label="سعر اللتر الذي دفعته">
            <NumberInput value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الرواسة المدفوعة">
            <NumberInput value={royalty} onChange={(e) => setRoyalty(Number(e.target.value))} />
          </Field>
          <Field label="المبلغ الذي دفعته">
            <NumberInput value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
          </Field>
        </div>
        <p className="text-[11px] text-gray-400">
          قيمة الديزل المحسوبة: {formatMoney(dieselAmount, currency)} — الإجمالي:{" "}
          {formatMoney(dieselAmount + royalty, currency)}
        </p>
        <Field label="ملاحظات">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
        <Button
          className="w-full"
          onClick={() => {
            const record: PersonalRecord = {
              id: uid("pr"),
              personId,
              pumpId: null,
              dayId: null,
              date,
              startTime: start,
              endTime: end,
              minutes,
              dieselLiters: liters,
              dieselPricePerLiter: price,
              dieselAmount,
              royaltyAmount: royalty,
              paidAmount: paid,
              debtAmount: Math.max(0, dieselAmount + royalty - paid),
              operationType: "usage",
              notes,
              matchStatus: "personal_only",
              archived: false,
              createdAt: new Date().toISOString(),
            };
            appendPersonalRecord(record, personName);
            addToMyBook({
              id: uid("t"),
              cycleId: "",
              pumpId: "",
              dayIndex: 0,
              date,
              hours: minutes / 60,
              startTime: start,
              endTime: end,
              dieselLiters: liters,
              dieselCost: dieselAmount,
              direction: null,
              lendUnit: null,
              lendQty: 0,
              lendCost: 0,
              royaltyPaid: royalty > 0,
              note: notes,
              createdAt: new Date().toISOString(),
            });
            onSaved();
            onClose();
          }}
          disabled={minutes <= 0}
        >
          حفظ في سجلي الشخصي
        </Button>
        <p className="text-[10px] text-gray-400">
          الوقت الحالي {minutesToTime(timeToMinutes(start) + minutes)} — يتم الرجوع للبيانات الرسمية للمقارنة.
        </p>
      </div>
    </Modal>
  );
}
