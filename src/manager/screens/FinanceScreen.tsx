import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Banknote,
  CircleDollarSign,
  Fuel,
  HandCoins,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Tractor,
  Undo2,
  Wallet,
} from "lucide-react";
import { useApp } from "../../store";
import type { OperatorRecord, Transaction, TxKind, FuelRecord } from "../../domain/types";
import {
  debtors,
  findPerson,
  operatorPaidFor,
  personBalance,
  personName,
  personTransactions,
  pumpFinancials,
  txKindLabel,
} from "../../domain/rules";
import { durationMin, formatDuration, isoToShort, sum, todayISO, uid } from "../../domain/util";
import { formatMoney, formatNumber } from "../../format";
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
  TextArea,
  TextInput,
  TimeInput,
  cx,
} from "../../components/ui";
import PersonPicker from "../../components/PersonPicker";

type Tab = "accounts" | "fuel" | "operator";

export default function FinanceScreen() {
  const { state } = useApp();
  const pump = state.pump!;
  const [tab, setTab] = useState<Tab>("accounts");
  const [txModal, setTxModal] = useState<{ personId: string | null; kind: TxKind } | null>(null);
  const [statementFor, setStatementFor] = useState<string | null>(null);

  const financials = useMemo(() => pumpFinancials(state), [state]);
  const debtorList = useMemo(() => debtors(state), [state]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="إجمالي الاستحقاق"
          value={formatMoney(financials.charging, pump.currency)}
          icon={<Receipt size={13} />}
          tone="gray"
        />
        <StatCard
          label="المسدَّد"
          value={formatMoney(financials.collected, pump.currency)}
          icon={<Banknote size={13} />}
        />
        <StatCard
          label="المتبقي"
          value={formatMoney(financials.outstanding, pump.currency)}
          tone="amber"
          icon={<HandCoins size={13} />}
        />
      </div>

      <div className="flex gap-2">
        {(
          [
            { id: "accounts", label: "الحسابات" },
            { id: "fuel", label: "الديزل" },
            { id: "operator", label: "الرواسة" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              "flex-1 rounded-2xl border px-3 py-2 text-xs font-bold transition",
              tab === t.id
                ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30"
                : "border-gray-200 text-gray-500 dark:border-slate-600 dark:text-slate-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "accounts" ? (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wallet size={16} className="text-emerald-600" />
            <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">أرصدة الأشخاص</h2>
            <button
              onClick={() => setTxModal({ personId: null, kind: "payment" })}
              className="mr-auto rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
            >
              <Plus size={12} className="inline -mt-0.5" /> حركة مالية
            </button>
          </div>

          {state.persons.filter((p) => !p.archived).length === 0 ? (
            <EmptyState icon={<Wallet size={24} />} title="لا يوجد أشخاص" />
          ) : (
            <div className="space-y-2">
              {state.persons
                .filter((p) => !p.archived)
                .map((p) => ({ person: p, balance: personBalance(state, p.id) }))
                .sort((a, b) => b.balance.balance - a.balance.balance)
                .map(({ person, balance }) => (
                  <div
                    key={person.id}
                    className="rounded-2xl border border-gray-100 px-3 py-3 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-extrabold text-gray-800 dark:text-white">
                          {person.name}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          عليه {formatMoney(balance.debit, pump.currency)} · دفع{" "}
                          {formatMoney(balance.credit, pump.currency)}
                        </div>
                      </div>
                      <div
                        className={cx(
                          "text-sm font-extrabold",
                          balance.balance > 0
                            ? "text-red-600 dark:text-red-400"
                            : balance.balance < 0
                              ? "text-sky-600 dark:text-sky-400"
                              : "text-emerald-600"
                        )}
                      >
                        {formatMoney(Math.abs(balance.balance), pump.currency)}
                        {balance.balance < 0 ? " له" : balance.balance > 0 ? " عليه" : ""}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setTxModal({ personId: person.id, kind: "payment" })}
                        className="rounded-xl bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      >
                        <Banknote size={12} className="inline -mt-0.5" /> دفعة
                      </button>
                      <button
                        onClick={() => setTxModal({ personId: person.id, kind: "debt" })}
                        className="rounded-xl bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      >
                        <CircleDollarSign size={12} className="inline -mt-0.5" /> دين / سلفة
                      </button>
                      <button
                        onClick={() => setStatementFor(person.id)}
                        className="rounded-xl bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-600 dark:bg-slate-700 dark:text-slate-200"
                      >
                        كشف الحساب
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {debtorList.length > 0 ? (
            <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {debtorList.length} شخص عليهم مبالغ غير مسددة بإجمالي{" "}
              {formatMoney(sum(debtorList.map((d) => d.balance)), pump.currency)}.
            </p>
          ) : null}
        </Card>
      ) : null}

      {tab === "fuel" ? <FuelSection /> : null}
      {tab === "operator" ? <OperatorSection /> : null}

      {txModal ? (
        <TransactionModal
          kind={txModal.kind}
          personId={txModal.personId}
          onClose={() => setTxModal(null)}
        />
      ) : null}

      {statementFor ? (
        <StatementModal personId={statementFor} onClose={() => setStatementFor(null)} />
      ) : null}
    </div>
  );
}

function FuelSection() {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [open, setOpen] = useState(false);
  const records = state.fuelRecords.filter((r) => !r.archived);
  const totals = pumpFinancials(state);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Fuel size={16} className="text-emerald-600" />
        <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">سجل استهلاك الديزل</h2>
        <button
          onClick={() => setOpen(true)}
          className="mr-auto rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
        >
          <Plus size={12} className="inline -mt-0.5" /> تسجيل
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
        <div className="rounded-2xl bg-gray-50 px-2 py-2 dark:bg-slate-700">
          <div className="text-gray-400">إجمالي اللترات</div>
          <div className="text-sm text-gray-800 dark:text-white">{formatNumber(totals.fuelLiters)}</div>
        </div>
        <div className="rounded-2xl bg-gray-50 px-2 py-2 dark:bg-slate-700">
          <div className="text-gray-400">النقص</div>
          <div className="text-sm text-amber-600">{formatNumber(totals.fuelShortage)}</div>
        </div>
        <div className="rounded-2xl bg-gray-50 px-2 py-2 dark:bg-slate-700">
          <div className="text-gray-400">استهلاك/ساعة</div>
          <div className="text-sm text-gray-800 dark:text-white">{pump.fuelConsumptionPerHour}</div>
        </div>
      </div>

      {records.length === 0 ? (
        <p className="py-3 text-center text-xs text-gray-400">لا توجد سجلات ديزل.</p>
      ) : (
        <div className="space-y-2">
          {records
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2 text-[11px] dark:bg-slate-700"
              >
                <div className="flex-1">
                  <div className="font-extrabold text-gray-800 dark:text-white">
                    {isoToShort(r.date)} · {formatNumber(r.liters)} لتر
                  </div>
                  <div className="text-gray-400">
                    {r.hoursRun} ساعة تشغيل · {r.litersPerHour} لتر/ساعة
                    {r.shortageLiters > 0 ? ` · نقص ${r.shortageLiters} لتر` : ""}
                  </div>
                </div>
                <button
                  onClick={() => actions.archiveFuel(r.id, true)}
                  className="rounded-lg bg-white p-1.5 text-red-500 dark:bg-slate-800"
                  aria-label="أرشفة سجل الديزل"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
        </div>
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
        المسؤول يسجّل الاستهلاك وساعات التشغيل والنقص — ولا يفرض على المستخدم سعرًا ماليًا للديزل.
      </p>

      {open ? <FuelModal onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

function FuelModal({ onClose }: { onClose: () => void }) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [date, setDate] = useState(todayISO());
  const [hoursRun, setHoursRun] = useState(0);
  const [litersPerHour, setLitersPerHour] = useState(pump.fuelConsumptionPerHour);
  const [shortage, setShortage] = useState(0);
  const [price, setPrice] = useState(pump.fuelPrice);
  const [notes, setNotes] = useState("");
  const liters = Math.round(hoursRun * litersPerHour * 10) / 10;

  return (
    <Modal open onClose={onClose} title="تسجيل استهلاك ديزل">
      <div className="space-y-3">
        <Field label="التاريخ">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ساعات التشغيل">
            <NumberInput value={hoursRun} onChange={(e) => setHoursRun(Number(e.target.value))} />
          </Field>
          <Field label="لتر / ساعة">
            <NumberInput value={litersPerHour} onChange={(e) => setLitersPerHour(Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الكمية المحسوبة (لتر)">
            <TextInput value={liters} readOnly dir="ltr" className="text-left" />
          </Field>
          <Field label="النقص (لتر)">
            <NumberInput value={shortage} onChange={(e) => setShortage(Number(e.target.value))} />
          </Field>
        </div>
        <Field label="سعر اللتر المرجعي">
          <NumberInput value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>
        <Field label="ملاحظات">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
        <Button
          className="w-full"
          onClick={() => {
            const record: FuelRecord = {
              id: uid("fr"),
              pumpId: pump.id,
              dayId: null,
              date,
              hoursRun,
              litersPerHour,
              liters,
              shortageLiters: shortage,
              fuelPrice: price,
              notes,
              createdAt: new Date().toISOString(),
              createdBy: "manager",
              archived: false,
            };
            actions.saveFuel(record, true);
            onClose();
          }}
        >
          حفظ السجل
        </Button>
      </div>
    </Modal>
  );
}

function OperatorSection() {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [open, setOpen] = useState(false);
  const records = state.operatorRecords.filter((r) => !r.archived);
  const totalDue = sum(records.map((r) => r.dueAmount));
  const totalPaid = sum(records.map((r) => operatorPaidFor(state, r.id)));

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Tractor size={16} className="text-emerald-600" />
        <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">أجور الرواسة</h2>
        <button
          onClick={() => setOpen(true)}
          className="mr-auto rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
        >
          <Plus size={12} className="inline -mt-0.5" /> تسجيل
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
        <div className="rounded-2xl bg-gray-50 px-2 py-2 dark:bg-slate-700">
          <div className="text-gray-400">المستحق</div>
          <div className="text-sm text-gray-800 dark:text-white">{formatMoney(totalDue, pump.currency)}</div>
        </div>
        <div className="rounded-2xl bg-gray-50 px-2 py-2 dark:bg-slate-700">
          <div className="text-gray-400">المدفوع</div>
          <div className="text-sm text-emerald-700 dark:text-emerald-300">
            {formatMoney(totalPaid, pump.currency)}
          </div>
        </div>
        <div className="rounded-2xl bg-gray-50 px-2 py-2 dark:bg-slate-700">
          <div className="text-gray-400">المتبقي</div>
          <div className="text-sm text-amber-600">{formatMoney(totalDue - totalPaid, pump.currency)}</div>
        </div>
      </div>

      {records.length === 0 ? (
        <p className="py-3 text-center text-xs text-gray-400">لا توجد سجلات رواسة.</p>
      ) : (
        <div className="space-y-2">
          {records
            .slice()
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((r) => {
              const paid = operatorPaidFor(state, r.id);
              return (
                <div key={r.id} className="rounded-2xl border border-gray-100 px-3 py-3 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-extrabold text-gray-800 dark:text-white">
                        {r.operatorName} — {isoToShort(r.date)}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {r.startTime} → {r.endTime} · {formatDuration(r.minutes)} · {r.hourlyWage}/ساعة
                      </div>
                    </div>
                    <div className="text-left text-[11px] font-bold">
                      <div className="text-gray-800 dark:text-white">
                        مستحق {formatMoney(r.dueAmount, pump.currency)}
                      </div>
                      <div className={paid >= r.dueAmount ? "text-emerald-600" : "text-amber-600"}>
                        مدفوع {formatMoney(paid, pump.currency)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {paid < r.dueAmount ? (
                      <button
                        onClick={() =>
                          actions.addTransaction({
                            id: uid("tx"),
                            pumpId: pump.id,
                            kind: "operators",
                            direction: "credit",
                            personId: null,
                            shareholderId: null,
                            dayId: r.dayId,
                            usageId: null,
                            operatorRecordId: r.id,
                            fuelRecordId: null,
                            amount: r.dueAmount - paid,
                            date: todayISO(),
                            reason: `دفع أجر رواسة ${r.operatorName}`,
                            status: "posted",
                            correctsTxId: null,
                            notes: "",
                            source: "manager",
                            createdAt: new Date().toISOString(),
                            createdBy: "manager",
                          })
                        }
                        className="rounded-xl bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      >
                        <Banknote size={12} className="inline -mt-0.5" /> دفع المتبقي
                      </button>
                    ) : (
                      <Pill tone="green">مسدَّد بالكامل</Pill>
                    )}
                    <button
                      onClick={() => actions.archiveOperator(r.id, true)}
                      className="rounded-xl bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-300"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
      <p className="mt-2 text-[10px] text-gray-400">
        تغيير أجر الرواسة مستقبلًا لا يعيد حساب السجلات القديمة — كل سجل يحتفظ بالأجر وقت تسجيله.
      </p>

      {open ? <OperatorModal onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

function OperatorModal({ onClose }: { onClose: () => void }) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [name, setName] = useState(pump.operatorName || "الرواس");
  const [wage, setWage] = useState(pump.operatorHourlyWage);
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState(pump.operatorStart || "06:00");
  const [end, setEnd] = useState(pump.operatorEnd || "18:00");
  const minutes = durationMin(start, end);
  const due = Math.round((minutes / 60) * wage);

  return (
    <Modal open onClose={onClose} title="تسجيل رواسة">
      <div className="space-y-3">
        <Field label="اسم الرواس">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="أجر الساعة">
            <NumberInput value={wage} onChange={(e) => setWage(Number(e.target.value))} />
          </Field>
          <Field label="التاريخ">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="بداية الدوام">
            <TimeInput value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="نهاية الدوام">
            <TimeInput value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          المدة {formatDuration(minutes)} · الأجر المستحق {formatMoney(due, pump.currency)}
        </div>
        <Button
          className="w-full"
          onClick={() => {
            const record: OperatorRecord = {
              id: uid("op"),
              pumpId: pump.id,
              dayId: null,
              date,
              operatorName: name,
              hourlyWage: wage,
              startTime: start,
              endTime: end,
              minutes,
              dueAmount: due,
              notes: "",
              createdAt: new Date().toISOString(),
              createdBy: "manager",
              archived: false,
            };
            actions.saveOperator(record, true);
            onClose();
          }}
        >
          حفظ السجل
        </Button>
      </div>
    </Modal>
  );
}

function TransactionModal({
  kind,
  personId,
  onClose,
}: {
  kind: TxKind;
  personId: string | null;
  onClose: () => void;
}) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [kindState, setKindState] = useState<TxKind>(kind);
  const [person, setPerson] = useState<string | null>(personId);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [picking, setPicking] = useState(false);

  const direction: Transaction["direction"] =
    kindState === "payment" ? "credit" : kindState === "debt" || kindState === "loan" || kindState === "advance" ? "debit" : "debit";

  return (
    <Modal open onClose={onClose} title="حركة مالية">
      <div className="space-y-3">
        <Field label="نوع الحركة">
          <Select value={kindState} onChange={(e) => setKindState(e.target.value as TxKind)}>
            <option value="payment">دفعة (سداد)</option>
            <option value="debt">دين</option>
            <option value="loan">سلفة</option>
            <option value="advance">ساعات مقدمة</option>
            <option value="postpone_fee">أجر تأجيل</option>
            <option value="other">أخرى</option>
          </Select>
        </Field>

        <Field label="الشخص" hint="يمكن تسجيل حركة بدون شخص (مثل مصاريف المضخة)">
          <button
            onClick={() => setPicking(true)}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-right text-sm font-bold text-gray-800 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            {person ? personName(state, person) : "بدون شخص محدد"}
          </button>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="المبلغ">
            <NumberInput value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="التاريخ">
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <Field label="السبب / البيان">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: دفعة نقدية" />
        </Field>
        <Field label="ملاحظات">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>

        <p className="rounded-2xl bg-gray-50 px-3 py-2 text-[11px] text-gray-500 dark:bg-slate-700 dark:text-slate-300">
          {direction === "credit"
            ? "هذه الحركة تُسجَّل كدفعة (تخفيض المتبقي على الشخص)."
            : "هذه الحركة تُسجَّل كمبلغ مستحق على الشخص."}
        </p>

        <Button
          className="w-full"
          disabled={amount <= 0}
          onClick={() => {
            actions.addTransaction({
              id: uid("tx"),
              pumpId: pump.id,
              kind: kindState,
              direction,
              personId: person,
              shareholderId: null,
              dayId: null,
              usageId: null,
              operatorRecordId: null,
              fuelRecordId: null,
              amount,
              date,
              reason: reason || txKindLabel(kindState),
              status: "posted",
              correctsTxId: null,
              notes,
              source: "manager",
              createdAt: new Date().toISOString(),
              createdBy: "manager",
            });
            onClose();
          }}
        >
          <BadgeDollarSign size={16} /> حفظ الحركة
        </Button>
      </div>

      {picking ? (
        <PersonPicker
          open
          onClose={() => setPicking(false)}
          pumpId={pump.id}
          title="اختيار الشخص"
          onSelect={(p) => setPerson(p.id)}
        />
      ) : null}
    </Modal>
  );
}

function StatementModal({ personId, onClose }: { personId: string; onClose: () => void }) {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const person = findPerson(state, personId);
  const list = personTransactions(state, personId);
  const balance = personBalance(state, personId);
  const [correctId, setCorrectId] = useState<string | null>(null);
  const target = list.find((t) => t.id === correctId) ?? null;
  const [newAmount, setNewAmount] = useState(target?.amount ?? 0);
  const [reason, setReason] = useState("");

  return (
    <Modal open onClose={onClose} title={`كشف حساب — ${person?.name ?? ""}`}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Pill tone="red">عليه {formatMoney(balance.debit, pump.currency)}</Pill>
          <Pill tone="green">دفع {formatMoney(balance.credit, pump.currency)}</Pill>
          <Pill tone={balance.balance > 0 ? "amber" : "blue"}>
            الصافي {formatMoney(Math.abs(balance.balance), pump.currency)}
          </Pill>
        </div>

        {list.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">لا توجد حركات مالية.</p>
        ) : (
          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
            {list.map((t) => (
              <div key={t.id} className="rounded-2xl border border-gray-100 px-3 py-2 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Pill tone={t.direction === "debit" ? "red" : "green"}>
                    {t.direction === "debit" ? "عليه" : "دفع"}
                  </Pill>
                  <span className="flex-1 text-[11px] font-bold text-gray-700 dark:text-slate-200">
                    {txKindLabel(t.kind)} · {t.reason}
                  </span>
                  <span className="text-xs font-extrabold text-gray-800 dark:text-white">
                    {formatMoney(t.amount, pump.currency)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                  <span>{isoToShort(t.date)}</span>
                  {t.correctsTxId ? <Pill tone="blue">تصحيح</Pill> : null}
                  {t.notes ? <span className="truncate">{t.notes}</span> : null}
                  <button
                    onClick={() => {
                      setCorrectId(t.id);
                      setNewAmount(t.amount);
                    }}
                    className="mr-auto text-blue-600"
                  >
                    <Pencil size={11} className="inline -mt-0.5" /> تصحيح
                  </button>
                  <button
                    onClick={() => actions.voidTransaction(t.id, "إلغاء من كشف الحساب", "manager")}
                    className="text-red-500"
                  >
                    <Undo2 size={11} className="inline -mt-0.5" /> إلغاء
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-gray-400">
          تصحيح أي حركة يُسجَّل كقيد فرق جديد (الأصل يبقى كما هو) — لا تُحذف الدفعة الأصلية أبدًا.
        </p>
      </div>

      {target ? (
        <Modal open onClose={() => setCorrectId(null)} title="تصحيح حركة مالية">
          <div className="space-y-3">
            <div className="rounded-2xl bg-gray-50 px-3 py-2 text-[11px] dark:bg-slate-700">
              الأصل: {formatMoney(target.amount, pump.currency)} · {target.reason}
            </div>
            <Field label="المبلغ الصحيح">
              <NumberInput value={newAmount} onChange={(e) => setNewAmount(Number(e.target.value))} />
            </Field>
            <Field label="السبب">
              <TextArea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </Field>
            <p className="rounded-2xl bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              سيُسجَّل قيد تصحيح بمقدار {formatMoney(newAmount - target.amount, pump.currency)} ليصبح الصافي{" "}
              {formatMoney(newAmount, pump.currency)}.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                actions.correctTransaction(target.id, newAmount, reason, "manager");
                setCorrectId(null);
              }}
            >
              تسجيل التصحيح
            </Button>
          </div>
        </Modal>
      ) : null}
    </Modal>
  );
}
