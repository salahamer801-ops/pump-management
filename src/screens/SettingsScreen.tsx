import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Database,
  Droplets,
  Fuel,
  Gauge,
  Info,
  Save,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import { useApp } from "../store";
import { formatDuration, workDurationMin } from "../calc";
import type { PumpSettings } from "../types";
import {
  Button,
  Card,
  Field,
  Modal,
  NumberInput,
  Select,
  TextArea,
  TextInput,
  TimeInput,
} from "../components/ui";

export default function SettingsScreen() {
  const { state, actions } = useApp();
  const pump = state.pump!;
  const [data, setData] = useState<PumpSettings>(pump);
  const [confirm, setConfirm] = useState<"reset" | "demo" | null>(null);

  const totalHours = useMemo(
    () => workDurationMin(data.workStart, data.workEnd),
    [data.workStart, data.workEnd]
  );

  const set = <K extends keyof PumpSettings>(key: K, value: PumpSettings[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const save = () => {
    actions.setPump({ ...data, name: data.name.trim() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900">الإعدادات</h1>
        <Button onClick={save} className="px-4 py-2.5">
          <Save size={16} /> حفظ التغييرات
        </Button>
      </div>

      <Section title="بيانات المضخة" icon={<Settings2 size={18} />}>
        <div className="space-y-4">
          <Field label="اسم المضخة">
            <TextInput value={data.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="نوع الطاقة">
            <Select
              value={data.energyType}
              onChange={(e) => set("energyType", e.target.value as PumpSettings["energyType"])}
            >
              <option value="diesel">ديزل</option>
              <option value="solar">طاقة شمسية</option>
              <option value="hybrid">شمسي + ديزل</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الآبار">
              <TextInput value={data.wells} onChange={(e) => set("wells", e.target.value)} />
            </Field>
            <Field label="المزرعة / المنطقة">
              <TextInput value={data.farm} onChange={(e) => set("farm", e.target.value)} />
            </Field>
          </div>
          <Field label="ملاحظات">
            <TextArea value={data.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="الدوام اليومي" icon={<Gauge size={18} />}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="البداية">
            <TimeInput value={data.workStart} onChange={(e) => set("workStart", e.target.value)} />
          </Field>
          <Field label="النهاية">
            <TimeInput value={data.workEnd} onChange={(e) => set("workEnd", e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-800">
          إجمالي ساعات الدوام: {formatDuration(totalHours)}
        </div>
      </Section>

      <Section title="الرواسة" icon={<Droplets size={18} />}>
        <Field label="هل يوجد رواسة؟">
          <Select
            value={data.hasRoyalty ? "yes" : "no"}
            onChange={(e) => set("hasRoyalty", e.target.value === "yes")}
          >
            <option value="yes">نعم</option>
            <option value="no">لا</option>
          </Select>
        </Field>
        {data.hasRoyalty && (
          <div className="mt-3 space-y-3">
            <Field label="طريقة الاحتساب">
              <Select
                value={data.royaltyMode}
                onChange={(e) => set("royaltyMode", e.target.value as PumpSettings["royaltyMode"])}
              >
                <option value="cycle">للدورة الكاملة</option>
                <option value="hour">لكل ساعة</option>
              </Select>
            </Field>
            {data.royaltyMode === "cycle" ? (
              <Field label="أجرة الرواسة للدورة الكاملة">
                <NumberInput
                  value={data.royaltyPerCycle || ""}
                  onChange={(e) => set("royaltyPerCycle", Number(e.target.value))}
                />
              </Field>
            ) : (
              <Field label="أجرة الرواسة لكل ساعة">
                <NumberInput
                  value={data.royaltyPerHour || ""}
                  onChange={(e) => set("royaltyPerHour", Number(e.target.value))}
                />
              </Field>
            )}
          </div>
        )}
        <div className="mt-3">
          <Field label="العملة">
            <Select
              value={data.currency}
              onChange={(e) => set("currency", e.target.value as PumpSettings["currency"])}
            >
              <option value="YER">ريال يمني (ر.ي)</option>
              <option value="SAR">ريال سعودي (ر.س)</option>
              <option value="USD">دولار أمريكي ($)</option>
            </Select>
          </Field>
        </div>
      </Section>

      {data.energyType !== "solar" && (
        <Section title="الوقود" icon={<Fuel size={18} />}>
          <div className="space-y-3">
            <Field label="سعر الوقود للتر">
              <NumberInput
                value={data.fuelPrice || ""}
                onChange={(e) => set("fuelPrice", Number(e.target.value))}
              />
            </Field>
            <Field label="طريقة الاحتساب">
              <Select
                value={data.fuelCalcMode}
                onChange={(e) => set("fuelCalcMode", e.target.value as PumpSettings["fuelCalcMode"])}
              >
                <option value="hour">حسب الساعات</option>
                <option value="cycle">للدورة الكاملة</option>
              </Select>
            </Field>
            {data.fuelCalcMode === "hour" ? (
              <Field label="استهلاك الوقود لكل ساعة (لتر)">
                <NumberInput
                  value={data.fuelConsumptionPerHour || ""}
                  onChange={(e) => set("fuelConsumptionPerHour", Number(e.target.value))}
                />
              </Field>
            ) : (
              <Field label="استهلاك الوقود للدورة الكاملة (لتر)">
                <NumberInput
                  value={data.fuelPerCycle || ""}
                  onChange={(e) => set("fuelPerCycle", Number(e.target.value))}
                />
              </Field>
            )}
          </div>
        </Section>
      )}

      <Section title="الحصص" icon={<Users size={18} />}>
        <div className="space-y-3">
          <Field label="قاعدة احتساب الحصة">
            <Select
              value={data.shareMode}
              onChange={(e) => set("shareMode", e.target.value as PumpSettings["shareMode"])}
            >
              <option value="whole">بالحصص الكاملة</option>
              <option value="fraction">بالكسور</option>
            </Select>
          </Field>
          <Field label="وحدة الحصة">
            <TextInput value={data.shareUnit} onChange={(e) => set("shareUnit", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="إدارة البيانات" icon={<Database size={18} />}>
        <p className="mb-3 text-xs text-gray-500">
          بياناتك محفوظة محليًا على جهازك (تعمل بدون إنترنت).
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => setConfirm("demo")}>
            تعبئة بيانات تجريبية
          </Button>
          <Button variant="danger" onClick={() => setConfirm("reset")}>
            <Trash2 size={16} /> مسح كل البيانات
          </Button>
        </div>
      </Section>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Info size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">من نحن</h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              مشروع تنظيم المضخات — نظام دفتر شخصي لإدارة حصص المياه الزراعية.
              برمجة وتطوير: المهندس/ عبدالملك عامر
            </p>
          </div>
        </div>
      </Card>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "demo" ? "تعبئة بيانات تجريبية" : "مسح كل البيانات"}
      >
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <p>
            {confirm === "demo"
              ? "سيتم استبدال البيانات الحالية ببيانات تجريبية للاستعراض."
              : "سيتم مسح كل البيانات نهائيًا ولا يمكن التراجع."}
          </p>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" onClick={() => setConfirm(null)} className="flex-1">
            إلغاء
          </Button>
          <Button
            variant={confirm === "demo" ? "primary" : "danger"}
            onClick={() => {
              if (confirm === "demo") actions.seedDemo();
              else actions.reset();
              setConfirm(null);
            }}
            className="flex-1"
          >
            تأكيد
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-extrabold text-gray-500">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          {icon}
        </span>
        {title}
      </div>
      {children}
    </Card>
  );
}
