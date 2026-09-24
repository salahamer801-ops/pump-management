import { useState } from "react";
import { Droplets, LogIn, ShieldCheck, UserRound } from "lucide-react";
import type { SessionMode } from "../session";
import { Button, Field, TextInput } from "../components/ui";
import { cx } from "../components/ui";

export default function LoginScreen({
  onLogin,
}: {
  onLogin: (mode: SessionMode, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<SessionMode>("shareholder");

  const submit = () => {
    if (!name.trim()) return;
    onLogin(mode, name.trim());
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8">
      <div className="mb-8 mt-4 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-xl shadow-emerald-600/30">
          <Droplets size={38} />
        </div>
        <h1 className="text-3xl font-black text-gray-900">مشروع تنظيم المضخات</h1>
        <p className="mt-2 text-sm text-gray-500">
          دفترك الشخصي لإدارة حصص المياه الزراعية — بدون تعقيد
        </p>
      </div>

      <div className="space-y-5">
        <Field label="اسمك">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="اكتب اسمك هنا"
            autoFocus
          />
        </Field>

        <div>
          <div className="mb-2 text-sm font-bold text-gray-700">اختر طريقة الدخول</div>
          <div className="grid grid-cols-2 gap-3">
            <ModeCard
              active={mode === "shareholder"}
              onClick={() => setMode("shareholder")}
              icon={<UserRound size={22} />}
              title="مساهم"
              description="أدير مضخاتي وأدواري وحساباتي"
            />
            <ModeCard
              active={mode === "manager"}
              onClick={() => setMode("manager")}
              icon={<ShieldCheck size={22} />}
              title="مدير مضخة"
              description="أدير المساهمين والديالات"
            />
          </div>
        </div>

        <Button onClick={submit} disabled={!name.trim()} className="w-full py-4 text-base">
          <LogIn size={20} /> دخول
        </Button>

        <p className="text-center text-xs text-gray-400">
          لا تحتاج بريدًا إلكترونيًا أو كلمة سر — بياناتك تُحفظ على جهازك فقط.
        </p>
      </div>

      <div className="mt-auto pt-8 text-center text-xs text-gray-400">
        برمجة وتطوير: المهندس/ عبدالملك عامر
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-3xl border-2 p-4 text-right transition",
        active
          ? "border-emerald-500 bg-emerald-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-emerald-200"
      )}
    >
      <div
        className={cx(
          "mb-2 flex h-11 w-11 items-center justify-center rounded-2xl",
          active ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
        )}
      >
        {icon}
      </div>
      <div className={cx("font-extrabold", active ? "text-emerald-700" : "text-gray-800")}>
        {title}
      </div>
      <div className="mt-0.5 text-xs text-gray-500">{description}</div>
    </button>
  );
}
