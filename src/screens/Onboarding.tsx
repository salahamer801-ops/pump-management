import { useMemo, useState } from "react";
import { Check, Droplets, Fuel, Gauge, LogOut, Settings2, Users } from "lucide-react";
import { useApp } from "../store";
import { workDurationMin, formatDuration } from "../calc";
import type { PumpSettings } from "../types";
import {
  Button,
  Field,
  NumberInput,
  Select,
  TextArea,
  TextInput,
  TimeInput,
} from "../components/ui";

const STEPS = [
  "المضخة",
  "الدوام",
  "الرواسة",
  "الوقود",
  "الحصص",
];

const empty: PumpSettings = {
  name: "",
  energyType: "diesel",
  wells: "",
  farm: "",
  notes: "",
  workStart: "06:00",
  workEnd: "02:00",
  hasRoyalty: true,
  royaltyMode: "cycle",
  royaltyPerCycle: 100000,
  royaltyPerHour: 0,
  currency: "YER",
  fuelPrice: 1200,
  fuelConsumptionPerHour: 6,
  fuelPerCycle: 120,
  fuelCalcMode: "hour",
  shareMode: "fraction",
  shareUnit: "حصة",
};

export default function Onboarding({ onLogout }: { onLogout?: () => void }) {
  const { actions } = useApp();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<PumpSettings>(empty);

  const totalHours = useMemo(
    () => workDurationMin(data.workStart, data.workEnd),
    [data.workStart, data.workEnd]
  );

  const set = <K extends keyof PumpSettings>(key: K, value: PumpSettings[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const canNext = () => {
    if (step === 0 && !data.name.trim()) return false;
    return true;
  };

  const finish = () => {
    actions.setPump(data);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6">
      {onLogout && (
        <div className="mb-2 flex justify-end">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
          >
            <LogOut size={16} /> خروج
          </button>
        </div>
      )}
      <div className="mb-2 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-600/30">
          <Droplets size={30} />
        </div>
        <h1 className="text-2xl font-black text-gray-900">مشروع تنظيم المضخات</h1>
        <p className="mt-1 text-sm text-gray-500">
          سجّل مضختك مرة واحدة، وسيُحسب الباقي تلقائيًا
        </p>
      </div>

      {/* progress */}
      <div className="mb-6 mt-4 flex items-center justify-center gap-1.5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold transition ${
                i < step
                  ? "bg-emerald-500 text-white"
                  : i === step
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                    : "bg-gray-100 text-gray-400"
              }`}
              aria-label={label}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </button>
            {i < STEPS.length - 1 ? (
              <div
                className={`h-0.5 w-4 rounded ${i < step ? "bg-emerald-500" : "bg-gray-200"}`}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex-1 animate-fade-up">
        {step === 0 && (
          <div className="space-y-4">
            <StepIcon icon={<Settings2 size={22} />} title="بيانات المضخة الأساسية" />
            <Field label="اسم المضخة *">
              <TextInput
                value={data.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="مثال: مضخة العليا"
              />
            </Field>
            <Field label="نوع الطاقة">
              <Select
                value={data.energyType}
                onChange={(e) =>
                  set("energyType", e.target.value as PumpSettings["energyType"])
                }
              >
                <option value="diesel">ديزل</option>
                <option value="solar">طاقة شمسية</option>
                <option value="hybrid">شمسي + ديزل</option>
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="الآبار">
                <TextInput
                  value={data.wells}
                  onChange={(e) => set("wells", e.target.value)}
                  placeholder="بئر الحافة"
                />
              </Field>
              <Field label="المزرعة / المنطقة">
                <TextInput
                  value={data.farm}
                  onChange={(e) => set("farm", e.target.value)}
                  placeholder="وادي الحمراء"
                />
              </Field>
            </div>
            <Field label="ملاحظات">
              <TextArea
                value={data.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="أي تفاصيل إضافية عن المضخة"
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <StepIcon icon={<Gauge size={22} />} title="إعدادات الدوام اليومي" />
            <p className="text-sm text-gray-500">
              ستُملأ هذه الأوقات تلقائيًا في كل دياله جديدة.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="بداية الدوام">
                <TimeInput
                  value={data.workStart}
                  onChange={(e) => set("workStart", e.target.value)}
                />
              </Field>
              <Field label="نهاية الدوام">
                <TimeInput
                  value={data.workEnd}
                  onChange={(e) => set("workEnd", e.target.value)}
                />
              </Field>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4 text-center">
              <div className="text-sm font-semibold text-emerald-700">
                إجمالي ساعات الدوام اليومي
              </div>
              <div className="mt-1 text-2xl font-black text-emerald-800">
                {formatDuration(totalHours)}
              </div>
              <div className="text-xs text-emerald-600">
                (تُحسب تلقائيًا من البداية والنهاية)
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <StepIcon icon={<Droplets size={22} />} title="إعدادات الرواسة" />
            <Field label="هل يوجد رواسة للمضخة؟">
              <Select
                value={data.hasRoyalty ? "yes" : "no"}
                onChange={(e) => set("hasRoyalty", e.target.value === "yes")}
              >
                <option value="yes">نعم، يوجد رواسة</option>
                <option value="no">لا يوجد</option>
              </Select>
            </Field>

            {data.hasRoyalty && (
              <>
                <Field label="طريقة احتساب الرواسة">
                  <Select
                    value={data.royaltyMode}
                    onChange={(e) =>
                      set("royaltyMode", e.target.value as PumpSettings["royaltyMode"])
                    }
                  >
                    <option value="cycle">للدورة الكاملة</option>
                    <option value="hour">لكل ساعة تشغيل</option>
                  </Select>
                </Field>
                {data.royaltyMode === "cycle" ? (
                  <Field
                    label="أجرة الرواسة للدورة الكاملة"
                    hint="تُوزَّع على المساهمين حسب نصيبهم من الحصص"
                  >
                    <NumberInput
                      value={data.royaltyPerCycle || ""}
                      onChange={(e) => set("royaltyPerCycle", Number(e.target.value))}
                    />
                  </Field>
                ) : (
                  <Field label="أجرة الرواسة لكل ساعة تشغيل">
                    <NumberInput
                      value={data.royaltyPerHour || ""}
                      onChange={(e) => set("royaltyPerHour", Number(e.target.value))}
                    />
                  </Field>
                )}
              </>
            )}

            <Field label="العملة (تُستخدَم في كل المبالغ)">
              <Select
                value={data.currency}
                onChange={(e) =>
                  set("currency", e.target.value as PumpSettings["currency"])
                }
              >
                <option value="YER">ريال يمني (ر.ي)</option>
                <option value="SAR">ريال سعودي (ر.س)</option>
                <option value="USD">دولار أمريكي ($)</option>
              </Select>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <StepIcon icon={<Fuel size={22} />} title="إعدادات الوقود" />
            {data.energyType === "solar" ? (
              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
                مضختك شمسية، لذلك سيتم إخفاء كل حقول الوقود تلقائيًا في التطبيق.
              </div>
            ) : (
              <>
                <Field label="سعر الوقود الافتراضي للتر">
                  <NumberInput
                    value={data.fuelPrice || ""}
                    onChange={(e) => set("fuelPrice", Number(e.target.value))}
                  />
                </Field>
                <Field label="طريقة احتساب تكلفة الوقود">
                  <Select
                    value={data.fuelCalcMode}
                    onChange={(e) =>
                      set("fuelCalcMode", e.target.value as PumpSettings["fuelCalcMode"])
                    }
                  >
                    <option value="hour">حسب ساعات التشغيل</option>
                    <option value="cycle">للدورة الكاملة</option>
                  </Select>
                </Field>
                {data.fuelCalcMode === "hour" ? (
                  <Field
                    label="استهلاك الوقود لكل ساعة (لتر)"
                    hint="يُقدَّر به نصيب كل مساهم من الوقود"
                  >
                    <NumberInput
                      value={data.fuelConsumptionPerHour || ""}
                      onChange={(e) =>
                        set("fuelConsumptionPerHour", Number(e.target.value))
                      }
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
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <StepIcon icon={<Users size={22} />} title="إعدادات الحصص" />
            <Field label="قاعدة احتساب الحصة">
              <Select
                value={data.shareMode}
                onChange={(e) =>
                  set("shareMode", e.target.value as PumpSettings["shareMode"])
                }
              >
                <option value="whole">بالحصص الكاملة</option>
                <option value="fraction">بالكسور (مثل 1.5 حصة)</option>
              </Select>
            </Field>
            <Field label="وحدة الحصة">
              <TextInput
                value={data.shareUnit}
                onChange={(e) => set("shareUnit", e.target.value)}
                placeholder="حصة / سهم / طن"
              />
            </Field>
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">
              بعد اكتمال الإعداد سيكون تطبيقك جاهزًا: عند إضافة مساهمين تُحسب
              حصصهم وساعاتهم ورواستهم ووقودهم تلقائيًا، وعند إنشاء دياله تُملأ
              ساعات الدوام تلقائيًا.
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1">
            السابق
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => canNext() && setStep((s) => s + 1)}
            disabled={!canNext()}
            className="flex-1"
          >
            التالي
          </Button>
        ) : (
          <Button onClick={finish} className="flex-1">
            <Check size={18} /> إتمام الإعداد
          </Button>
        )}
      </div>
    </div>
  );
}

function StepIcon({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        {icon}
      </div>
      <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>
    </div>
  );
}
