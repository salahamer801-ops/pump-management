import { useMemo, useState } from "react";
import { ChevronLeft, Percent, Plus, UserPlus, Users } from "lucide-react";
import { useApp } from "../store";
import { activeContributors } from "../selectors";
import {
  contributorHoursMin,
  formatDuration,
  fuelDueFor,
  royaltyDueFor,
  uid,
  workDurationMin,
} from "../calc";
import { formatMoney, formatNumber } from "../format";
import type { Contributor, PumpSettings } from "../types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  NumberInput,
  TextArea,
  TextInput,
} from "../components/ui";
import ContributorDetail from "./ContributorDetail";

const emptyForm = {
  name: "",
  phone: "",
  shares: 1,
  notes: "",
};

export default function ContributorsScreen() {
  const { state, actions } = useApp();
  const [view, setView] = useState<"list" | "shares">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contributor | null>(null);
  const [form, setForm] = useState(emptyForm);

  const pump = state.pump!;
  const contributors = activeContributors(state);

  const totalShares = useMemo(
    () => contributors.reduce((s, c) => s + c.shares, 0),
    [contributors]
  );

  // Live preview for the form being entered
  const preview = useMemo(() => {
    const baseTotal = editing
      ? totalShares - editing.shares + (Number(form.shares) || 0)
      : totalShares + (Number(form.shares) || 0);
    const shares = Number(form.shares) || 0;
    const fake: Contributor = { ...emptyForm, id: "", shares, archived: false, createdAt: "" };
    const durationMin = contributorHoursMin(fake, pump, baseTotal);
    return {
      durationMin,
      royalty: royaltyDueFor(fake, pump, baseTotal, durationMin),
      fuel: fuelDueFor(fake, pump, baseTotal, durationMin),
      total: baseTotal,
      percent: baseTotal > 0 ? (shares / baseTotal) * 100 : 0,
    };
  }, [form.shares, editing, totalShares, pump]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: Contributor) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, shares: c.shares, notes: c.notes });
    setOpen(true);
  };

  if (selectedId) {
    return (
      <ContributorDetail
        id={selectedId}
        onBack={() => setSelectedId(null)}
        onEdit={(c) => {
          openEdit(c);
          setSelectedId(null);
        }}
      />
    );
  }

  const save = () => {
    if (!form.name.trim()) return;
    if (editing) {
      actions.updateContributor({
        ...editing,
        name: form.name.trim(),
        phone: form.phone.trim(),
        shares: Number(form.shares) || 0,
        notes: form.notes,
      });
    } else {
      actions.addContributor({
        id: uid(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        shares: Number(form.shares) || 0,
        notes: form.notes,
        archived: false,
        createdAt: new Date().toISOString(),
      });
    }
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900">المساهمون</h1>
        <Button onClick={openAdd} className="px-4 py-2.5">
          <UserPlus size={18} /> إضافة مساهم
        </Button>
      </div>

      {/* tabs */}
      <div className="flex rounded-2xl bg-gray-100 p-1">
        <button
          onClick={() => setView("list")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
            view === "list" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"
          }`}
        >
          المساهمون ({contributors.length})
        </button>
        <button
          onClick={() => setView("shares")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${
            view === "shares" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"
          }`}
        >
          توزيع الحصص
        </button>
      </div>

      {contributors.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="لا يوجد مساهمون بعد"
          description="أضف المساهمين وحدد حصصهم، وستُحسب ساعاتهم ورواستهم ووقودهم تلقائيًا."
          action={
            <Button onClick={openAdd}>
              <Plus size={18} /> إضافة أول مساهم
            </Button>
          }
        />
      ) : view === "list" ? (
        <div className="space-y-3">
          {contributors.map((c) => {
            const durationMin = contributorHoursMin(c, pump, totalShares);
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="block w-full text-right"
              >
                <Card className="flex items-center gap-3 p-4 transition hover:border-emerald-200">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
                    <span className="text-base font-black">
                      {c.name.trim().charAt(0) || "؟"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-extrabold text-gray-900">
                      {c.name}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {formatNumber(c.shares)} حصة ·{" "}
                      {formatDuration(durationMin)} / يوم
                    </div>
                  </div>
                  <ChevronLeft size={18} className="text-gray-300" />
                </Card>
              </button>
            );
          })}
        </div>
      ) : (
        <SharesTable
          contributors={contributors}
          totalShares={totalShares}
          pump={pump}
        />
      )}

      {/* add / edit modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "تعديل مساهم" : "إضافة مساهم"}
      >
        <div className="space-y-4">
          <Field label="اسم المساهم *">
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: علي حسن"
            />
          </Field>
          <Field label="رقم الهاتف (اختياري)">
            <TextInput
              dir="ltr"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="7xxxxxxxx"
            />
          </Field>
          <Field
            label={`عدد الحصص (${pump.shareUnit})`}
            hint="يمكن استخدام كسور مثل 1.5 إذا كانت القاعدة تسمح بذلك"
          >
            <NumberInput
              value={form.shares}
              step="0.5"
              onChange={(e) => setForm({ ...form, shares: Number(e.target.value) })}
            />
          </Field>
          <Field label="ملاحظات">
            <TextArea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {/* instant preview */}
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-extrabold text-emerald-800">
              <Percent size={16} /> الحسبة الفورية
            </div>
            <div className="space-y-1 text-emerald-800">
              <div>إجمالي الحصص بعد الحفظ: {formatNumber(preview.total)}</div>
              <div>نسبته: {formatNumber(preview.percent)}%</div>
              <div>ساعاته يوميًا: {formatDuration(preview.durationMin)}</div>
              {pump.hasRoyalty && (
                <div>رواسته للدورة: {formatMoney(preview.royalty, pump.currency)}</div>
              )}
              {pump.energyType !== "solar" && (
                <div>وقوده للدورة: {formatMoney(preview.fuel, pump.currency)}</div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              إلغاء
            </Button>
            <Button onClick={save} disabled={!form.name.trim()} className="flex-1">
              حفظ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SharesTable({
  contributors,
  totalShares,
  pump,
}: {
  contributors: Contributor[];
  totalShares: number;
  pump: PumpSettings;
}) {
  const totalDurationMin = workDurationMin(pump.workStart, pump.workEnd);
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500">
        <span>المساهم</span>
        <span>الحصص</span>
        <span>الساعات/يوم</span>
        <span>النسبة</span>
      </div>
      {contributors.map((c) => {
        const durationMin = contributorHoursMin(c, pump, totalShares);
        const percent = totalShares > 0 ? (c.shares / totalShares) * 100 : 0;
        return (
          <div
            key={c.id}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-gray-50 px-4 py-3 text-sm"
          >
            <span className="truncate font-bold text-gray-800">{c.name}</span>
            <span className="text-gray-600">{formatNumber(c.shares)}</span>
            <span className="text-gray-600">{formatDuration(durationMin)}</span>
            <span className="font-bold text-emerald-700">
              {formatNumber(percent)}%
            </span>
          </div>
        );
      })}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-800">
        <span>الإجمالي</span>
        <span>{formatNumber(totalShares)}</span>
        <span>{formatDuration(totalDurationMin)}</span>
        <span>100%</span>
      </div>
    </Card>
  );
}
