import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  BarChart3,
  Bell,
  FileBarChart,
  History,
  Layers,
  Users,
  Wallet,
} from "lucide-react";
import { useApp } from "../store";
import {
  activeContributors,
  activeCycles,
  contributorCycleRows,
  contributorFinancialSummary,
  debtors,
  findContributor,
} from "../selectors";
import { contributorHoursMin, formatDuration, workDurationMin } from "../calc";
import { formatDateTime, formatMoney, formatNumber } from "../format";
import {
  Button,
  Card,
  EmptyState,
  Pill,
  Select,
  StatCard,
} from "../components/ui";

type Tab = "overview" | "debts" | "contributor" | "archive" | "history";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "نظرة عامة", icon: <BarChart3 size={15} /> },
  { id: "debts", label: "الديون", icon: <AlertTriangle size={15} /> },
  { id: "contributor", label: "تقرير مساهم", icon: <FileBarChart size={15} /> },
  { id: "archive", label: "الأرشيف", icon: <Archive size={15} /> },
  { id: "history", label: "السجل", icon: <History size={15} /> },
];

export default function ReportsScreen() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-gray-900">التقارير</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          نظرة شاملة على الحصص والميزان المائي والديون والسجل.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-2 text-xs font-bold transition ${
              tab === t.id ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "debts" && <DebtsTab />}
      {tab === "contributor" && <ContributorReportTab />}
      {tab === "archive" && <ArchiveTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}

function OverviewTab() {
  const { state } = useApp();
  const pump = state.pump!;
  const contributors = activeContributors(state);
  const cycles = activeCycles(state);
  const totalShares = contributors.reduce((s, c) => s + c.shares, 0);
  const totalDurationMin = workDurationMin(pump.workStart, pump.workEnd);

  const totals = contributors.reduce(
    (acc, c) => {
      const fin = contributorFinancialSummary(state, c.id);
      acc.due += fin.totalDue;
      acc.paid += fin.totalPaid;
      return acc;
    },
    { due: 0, paid: 0 }
  );

  const inProgress = cycles.some((c) => c.turns.some((t) => t.status === "in_progress"));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="المساهمون" value={contributors.length} icon={<Users size={16} />} />
        <StatCard label="إجمالي الحصص" value={formatNumber(totalShares)} icon={<Users size={16} />} />
        <StatCard
          label="ساعات الدوام"
          value={formatDuration(totalDurationMin)}
          icon={<Wallet size={16} />}
        />
        <StatCard
          label="الدور الجاري"
          value={inProgress ? "يعمل الآن" : "لا يوجد"}
          tone={inProgress ? "blue" : "gray"}
          icon={<Layers size={16} />}
        />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-gray-500">
          <Wallet size={16} /> ملخص مالي
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="المستحق" value={formatMoney(totals.due, pump.currency)} tone="gray" />
          <StatCard label="المدفوع" value={formatMoney(totals.paid, pump.currency)} tone="green" />
          <StatCard
            label="المتبقي"
            value={formatMoney(totals.due - totals.paid, pump.currency)}
            tone={totals.due - totals.paid > 0 ? "red" : "green"}
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-gray-500">
          <Layers size={16} /> الديالات
        </div>
        {cycles.length === 0 ? (
          <p className="text-sm text-gray-400">لا توجد ديالات بعد.</p>
        ) : (
          <div className="space-y-2">
            {cycles.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3"
              >
                <div className="text-sm font-bold text-gray-700">
                  الدياله رقم {c.number}
                </div>
                <div className="text-xs text-gray-400">
                  {formatNumber(c.totalShares)} حصة · {formatDuration(c.totalDurationMin)} ·{" "}
                  {c.turns.length} مساهم
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function DebtsTab() {
  const { state } = useApp();
  const pump = state.pump!;
  const list = debtors(state);

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<Bell size={26} />}
        title="لا توجد ديون"
        description="كل المستحقات مسددة — لا توجد تحذيرات."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
        <AlertTriangle size={18} className="shrink-0" />
        {list.length} {list.length === 1 ? "مساهم عليه ديون" : "مساهمين عليهم ديون"}
      </div>
      {list.map(({ contributor, summary, royaltyUnpaid, fuelUnpaid }) => (
        <Card key={contributor.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="font-extrabold text-gray-900">{contributor.name}</div>
            <Pill tone="red">
              {formatMoney(summary.balance, pump.currency)}
            </Pill>
          </div>
          <div className="mt-2 space-y-1 text-xs text-gray-500">
            {pump.hasRoyalty && royaltyUnpaid > 0 && (
              <div>
                رواسة غير مدفوعة:{" "}
                <span className="font-bold text-red-600">
                  {formatMoney(royaltyUnpaid, pump.currency)}
                </span>
              </div>
            )}
            {pump.energyType !== "solar" && fuelUnpaid > 0 && (
              <div>
                وقود غير مدفوع:{" "}
                <span className="font-bold text-amber-600">
                  {formatMoney(fuelUnpaid, pump.currency)}
                </span>
              </div>
            )}
            {summary.otherDue - summary.otherPaid > 0 && (
              <div>
                مصاريف أخرى غير مدفوعة:{" "}
                <span className="font-bold text-gray-700">
                  {formatMoney(summary.otherDue - summary.otherPaid, pump.currency)}
                </span>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ContributorReportTab() {
  const { state } = useApp();
  const pump = state.pump!;
  const contributors = activeContributors(state);
  const [id, setId] = useState(contributors[0]?.id ?? "");

  const contributor = findContributor(state, id);
  const rows = useMemo(
    () => (id ? contributorCycleRows(state, id) : []),
    [state, id]
  );

  if (contributors.length === 0) {
    return (
      <EmptyState
        icon={<Users size={26} />}
        title="لا يوجد مساهمون"
        description="أضف مساهمين لعرض تقاريرهم."
      />
    );
  }

  const totalShares = contributors.reduce((s, c) => s + c.shares, 0);
  const durationMin = contributor ? contributorHoursMin(contributor, pump, totalShares) : 0;
  const fin = contributor ? contributorFinancialSummary(state, contributor.id) : null;
  const usedMin = rows.reduce((s, r) => s + r.durationMin, 0);
  const waterBalanceMin = rows.length * durationMin - usedMin;

  return (
    <div className="space-y-4">
      <Field>
        <Select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">اختر مساهمًا…</option>
          {contributors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      {contributor && fin && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="الحصص"
              value={formatNumber(contributor.shares)}
              hint={`${pump.shareUnit}`}
            />
            <StatCard
              label="ساعاته/يوم"
              value={formatDuration(durationMin)}
              hint="حسب إعدادات المضخة"
            />
            <StatCard
              label="الساعات المستحقة"
              value={formatDuration(rows.length * durationMin)}
              hint={`عبر ${rows.length} دياله`}
            />
            <StatCard
              label="الميزان المائي"
              value={formatDuration(waterBalanceMin)}
              tone={waterBalanceMin >= 0 ? "green" : "red"}
              hint={waterBalanceMin >= 0 ? "فائض" : "عجز"}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="المستحق"
              value={formatMoney(fin.totalDue, pump.currency)}
              tone="gray"
            />
            <StatCard
              label="المدفوع"
              value={formatMoney(fin.totalPaid, pump.currency)}
              tone="green"
            />
            <StatCard
              label="المتبقي"
              value={formatMoney(fin.balance, pump.currency)}
              tone={fin.balance > 0 ? "red" : "green"}
            />
          </div>

          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500">
              <span>الدياله</span>
              <span>الساعات</span>
              <span>الرواسة</span>
              <span>الوقود</span>
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                لا توجد سجلات دورات لهذا المساهم.
              </p>
            ) : (
              rows.map((r) => (
                <div
                  key={r.turn.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-gray-50 px-4 py-3 text-sm"
                >
                  <span className="font-bold text-gray-800">دياله {r.cycle.number}</span>
                  <span className="text-gray-600">{formatDuration(r.durationMin)}</span>
                  <span className="text-gray-600">
                    {formatMoney(r.royaltyDue, pump.currency)}
                  </span>
                  <span className="text-gray-600">
                    {pump.energyType !== "solar"
                      ? formatMoney(r.fuelDue, pump.currency)
                      : "—"}
                  </span>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function ArchiveTab() {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const archivedContributors = state.contributors.filter((c) => c.archived);
  const archivedCycles = state.cycles.filter((c) => c.archived);

  if (archivedContributors.length === 0 && archivedCycles.length === 0) {
    return (
      <EmptyState
        icon={<Archive size={26} />}
        title="الأرشيف فارغ"
        description="عند أرشفة مساهم أو دياله سيظهر هنا بدلًا من حذفه نهائيًا."
      />
    );
  }

  return (
    <div className="space-y-4">
      {archivedContributors.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-sm font-extrabold text-gray-500">
            مساهمون مؤرشفون
          </h3>
          <div className="space-y-2">
            {archivedContributors.map((c) => (
              <Card key={c.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-800">{c.name}</div>
                  <div className="text-xs text-gray-400">
                    {formatNumber(c.shares)} {pump.shareUnit}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={() => actions.toggleArchiveContributor(c.id)}
                >
                  <ArchiveRestore size={14} /> استعادة
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {archivedCycles.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-sm font-extrabold text-gray-500">
            ديالات مؤرشفون
          </h3>
          <div className="space-y-2">
            {archivedCycles.map((c) => (
              <Card key={c.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-800">الدياله رقم {c.number}</div>
                  <div className="text-xs text-gray-400">
                    {formatNumber(c.totalShares)} حصة · {c.turns.length} مساهم
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={() => actions.restoreCycle(c.id)}
                >
                  <ArchiveRestore size={14} /> استعادة
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryTab() {
  const { state } = useApp();
  if (state.history.length === 0) {
    return (
      <EmptyState
        icon={<History size={26} />}
        title="لا يوجد سجل بعد"
        description="ستظهر هنا كل العمليات المهمة (إضافة، دفع، أرشفة…)."
      />
    );
  }
  return (
    <Card className="divide-y divide-gray-50">
      {state.history.map((h) => (
        <div key={h.id} className="flex items-start gap-3 px-4 py-3">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-gray-700">{h.text}</div>
            <div className="text-xs text-gray-400">{formatDateTime(h.at)}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <label className="block">{children}</label>;
}
