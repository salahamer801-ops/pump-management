import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarPlus,
  Droplets,
  Fuel,
  Layers,
  Plus,
} from "lucide-react";
import { useApp } from "../store";
import { activeContributors, activeCycles } from "../selectors";
import { buildCycle, formatDuration, workDurationMin } from "../calc";
import { formatDate, formatMoney, formatNumber } from "../format";
import type { Contributor, Cycle, PumpSettings } from "../types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Pill,
  TimeInput,
} from "../components/ui";

export default function CyclesScreen() {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const cycles = activeCycles(state);
  const contributors = activeContributors(state);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workStart, setWorkStart] = useState(pump.workStart);
  const [workEnd, setWorkEnd] = useState(pump.workEnd);

  const nextNumber = useMemo(() => {
    const max = state.cycles.reduce((m, c) => Math.max(m, c.number), 0);
    return max + 1;
  }, [state.cycles]);

  const previewCycle = useMemo(() => {
    const tempPump: PumpSettings = { ...pump, workStart, workEnd };
    return buildCycle(tempPump, contributors, nextNumber);
  }, [pump, contributors, nextNumber, workStart, workEnd]);

  if (selectedId) {
    const cycle = state.cycles.find((c) => c.id === selectedId);
    if (!cycle) return null;
    return (
      <CycleDetail
        cycle={cycle}
        pump={pump}
        contributors={state.contributors}
        onBack={() => setSelectedId(null)}
        onArchive={() => {
          actions.archiveCycle(cycle.id);
          setSelectedId(null);
        }}
      />
    );
  }

  const openCreate = () => {
    setWorkStart(pump.workStart);
    setWorkEnd(pump.workEnd);
    setOpen(true);
  };

  const create = () => {
    actions.addCycle(previewCycle);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900">الدياله / الدورات</h1>
        <Button onClick={openCreate} className="px-4 py-2.5">
          <Plus size={18} /> دياله جديدة
        </Button>
      </div>

      <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-relaxed text-emerald-800">
        الدياله هي الخطة التنظيمية: من يملك متى؟ تُملأ ساعات الدوام تلقائيًا من
        إعدادات المضخة، ويُحسب توزيع الساعات والرواسة والوقود لكل مساهم.
      </p>

      {cycles.length === 0 ? (
        <EmptyState
          icon={<Layers size={26} />}
          title="لا توجد ديالات بعد"
          description={
            contributors.length === 0
              ? "أضف مساهمين أولًا، ثم أنشئ دياله لتوزيع الساعات تلقائيًا."
              : "أنشئ أول دياله وستُملأ الساعات تلقائيًا من إعدادات المضخة."
          }
          action={
            <Button onClick={openCreate} disabled={contributors.length === 0}>
              <CalendarPlus size={18} /> إنشاء دياله
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {cycles.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="block w-full text-right"
            >
              <Card className="p-4 transition hover:border-emerald-200">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Layers size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-gray-900">
                      الدياله رقم {c.number}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {formatDate(c.createdAt)} · {formatDuration(c.totalDurationMin)} ·{" "}
                      {formatNumber(c.totalShares)} حصة · {c.turns.length} مساهم
                    </div>
                  </div>
                  <Pill tone="green">نشطة</Pill>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* create modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={`دياله رقم ${nextNumber}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="بداية الدوام" hint="مُملأ من المضخة">
              <TimeInput
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
              />
            </Field>
            <Field label="نهاية الدوام" hint="مُملأ من المضخة">
              <TimeInput
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
              />
            </Field>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-800">
            إجمالي الساعات: {formatDuration(workDurationMin(workStart, workEnd))}
          </div>

          <DistributionTable cycle={previewCycle} contributors={contributors} pump={pump} />

          {contributors.length === 0 ? (
            <p className="text-center text-sm text-red-500">
              أضف مساهمين أولًا قبل إنشاء الدياله.
            </p>
          ) : null}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              إلغاء
            </Button>
            <Button
              onClick={create}
              disabled={contributors.length === 0}
              className="flex-1"
            >
              حفظ الدياله
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function turnShares(t: Cycle["turns"][number], cycle: Cycle): number {
  if (cycle.totalDurationMin <= 0) return 0;
  return (t.durationMin / cycle.totalDurationMin) * cycle.totalShares;
}

function contributorName(id: string, contributors: Contributor[]): string {
  return contributors.find((c) => c.id === id)?.name ?? "—";
}

function CycleDetail({
  cycle,
  pump,
  contributors,
  onBack,
  onArchive,
}: {
  cycle: Cycle;
  pump: PumpSettings;
  contributors: Contributor[];
  onBack: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-bold text-gray-500 hover:bg-gray-100"
        >
          <ArrowRight size={16} /> رجوع
        </button>
        <Button
          variant="danger"
          className="mr-auto px-3 py-2 text-xs"
          onClick={onArchive}
        >
          أرشفة الدياله
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900">
              الدياله رقم {cycle.number}
            </h2>
            <div className="mt-0.5 text-sm text-gray-500">
              {formatDate(cycle.createdAt)}
            </div>
          </div>
          <div className="text-left text-sm text-gray-500">
            <div>الدوام: {cycle.workStart} ← {cycle.workEnd}</div>
            <div>{formatDuration(cycle.totalDurationMin)}</div>
          </div>
        </div>
      </Card>

      <DistributionTable cycle={cycle} contributors={contributors} pump={pump} />
    </div>
  );
}

function DistributionTable({
  cycle,
  contributors,
  pump,
}: {
  cycle: Cycle;
  contributors: Contributor[];
  pump: PumpSettings;
}) {
  const showFuel = pump.energyType !== "solar";
  const showRoyalty = pump.hasRoyalty;
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1.3fr_auto_auto] gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500">
        <span>المساهم</span>
        <span>الحصص</span>
        <span>الساعات / الفترة</span>
      </div>
      {cycle.turns.map((t) => (
        <div
          key={t.id}
          className="grid grid-cols-[1.3fr_auto_auto] items-center gap-2 border-b border-gray-50 px-4 py-3 text-sm"
        >
          <span className="truncate font-bold text-gray-800">
            {contributorName(t.contributorId, contributors)}
          </span>
          <span className="text-gray-600">{formatNumber(turnShares(t, cycle))}</span>
          <span className="text-gray-600">
            {formatDuration(t.durationMin)}
            <span className="block text-xs text-gray-400">
              {t.plannedStart} ← {t.plannedEnd}
            </span>
            {(showFuel || showRoyalty) && (
              <span className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold">
                {showRoyalty && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                    <Droplets size={10} className="ml-0.5 inline" />
                    {formatMoney(t.royaltyDue, pump.currency)}
                  </span>
                )}
                {showFuel && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                    <Fuel size={10} className="ml-0.5 inline" />
                    {formatMoney(t.fuelDue, pump.currency)}
                  </span>
                )}
              </span>
            )}
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[1.3fr_auto_auto] gap-2 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-800">
        <span>الإجمالي</span>
        <span>{formatNumber(cycle.totalShares)}</span>
        <span>{formatDuration(cycle.totalDurationMin)}</span>
      </div>
    </Card>
  );
}
