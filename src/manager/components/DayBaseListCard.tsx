/**
 * بطاقة **مساهمو ديالة اليوم — للعرض فقط**.
 *
 * القاعدة: المساهمون الأساسيون مرجع واحد يُضاف في قسم «أيام الديالة» (كشف الدوام الأساسي)،
 * وهنا يُعرضون ببساطة: الاسم · ساعات دوامه · رقمه — **ولا يحجزون أي ساعة من تشغيل المضخة**.
 * لا إضافة ولا تعديل من شاشة اليوم: كل تعديل مكانه شاشة الديالات.
 */
import { useMemo, useState } from "react";
import { Info, ListOrdered, Settings2, Users } from "lucide-react";
import { useApp } from "../../store";
import {
  baseRosterRows,
  pumpWindow,
  shareholderUsageRows,
  useStatusLabel,
  useStatusTone,
} from "../../domain/rules";
import type { DialaDay, ShareholderUseStatus } from "../../domain/types";
import { formatDuration, toHours } from "../../domain/util";
import { Button, Card, Pill } from "../../components/ui";
import { roleLabel } from "../../components/PersonPicker";

const PREVIEW = 8;

export default function DayBaseListCard({ day, onManage }: { day: DialaDay; onManage?: () => void }) {
  const { state } = useApp();
  const pump = state.pump!;
  const round = state.rounds.find((r) => r.id === day.roundId) ?? null;
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => baseRosterRows(state, day.roundId ?? null), [state, day.roundId]);
  const usageRows = useMemo(() => shareholderUsageRows(state, pump.id), [state, pump.id]);
  const statusByPerson = useMemo(() => {
    const map = new Map<string, ShareholderUseStatus>();
    for (const row of usageRows) {
      const effective: ShareholderUseStatus = row.activeRight
        ? row.activeRight.kind === "rent"
          ? "rented"
          : "transferred"
        : row.status;
      map.set(row.shareholder.personId, effective);
    }
    return map;
  }, [usageRows]);

  const capacityHours = toHours(pumpWindow(pump, day).capacityMin);
  const totalMin = rows.reduce((s, r) => s + (r.shareMin || 0), 0);
  const visible = showAll ? rows : rows.slice(0, PREVIEW);

  return (
    <Card className="p-4" data-testid="day-base-list">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Users size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-sm font-extrabold text-gray-800 dark:text-white">
              مساهمو ديالة اليوم — للعرض فقط
            </h2>
            <Pill tone="gray">مرجع ثابت</Pill>
            {round ? <Pill tone="green">ديالة {round.number}</Pill> : null}
            <Pill tone="blue">{rows.length} شخصًا</Pill>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">
            قائمة مرجعية (اسم · ساعات دوام · رقم) — لا تحجز ساعات تشغيل، ولا تُضاف من هنا. من أخذ فعليًا نصيب
            هذا اليوم تُسجّله في «دوام اليوم الفعلي» بالأسفل.
          </p>
        </div>
      </div>

      {!round ? (
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          هذا اليوم غير مرتبط بديالة — قائمة المساهمين الأساسيين تُسجَّل لكل ديالة في قسم «أيام الديالة».
        </p>
      ) : rows.length === 0 ? (
        <div
          className="rounded-2xl bg-amber-50 px-3 py-2 dark:bg-amber-900/20"
          data-testid="day-base-empty"
        >
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            لم تُسجَّل أسماء المساهمين الأساسيين لهذه الديالة بعد — أضفها كاملة مرة واحدة من قسم «أيام الديالة»
            (اسم · ساعات دوام · رقم)، فتظهر هنا وفي كل أيام الديالة.
          </p>
          {onManage ? (
            <Button
              variant="secondary"
              className="mt-2 px-3 py-1.5 text-[11px]"
              onClick={onManage}
              data-testid="day-base-manage"
            >
              <Settings2 size={13} /> إضافة المساهمين في أيام الديالة
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {visible.map((row, index) => {
              const status = statusByPerson.get(row.personId);
              const showStatus = Boolean(status) && status !== "continuing";
              return (
                <div
                  key={row.member.id}
                  className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-1.5 text-[11px] dark:bg-slate-700"
                  data-testid={`day-base-row-${index + 1}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-black text-emerald-700 dark:bg-slate-800 dark:text-emerald-300">
                    {index + 1}
                  </span>
                  <span className="min-w-0 truncate font-extrabold text-gray-800 dark:text-white">{row.name}</span>
                  {showStatus && status ? <Pill tone={useStatusTone(status)}>{useStatusLabel(status)}</Pill> : null}
                  <span className="mr-auto flex shrink-0 items-center gap-2">
                    <span className="text-gray-500 dark:text-slate-300" dir="ltr">
                      {row.phone || "لا رقم"}
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      {row.shareMin > 0 ? formatDuration(row.shareMin) : "بلا نصيب"}
                    </span>
                    <span className="hidden text-gray-400 sm:inline">{roleLabel(row.role)}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {rows.length > PREVIEW ? (
              <button
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
                onClick={() => setShowAll((v) => !v)}
                data-testid="day-base-toggle"
              >
                {showAll ? "إظهار أقل" : `إظهار كل الأسماء (${rows.length})`}
              </button>
            ) : null}
            <span className="text-[10px] text-gray-400">
              <ListOrdered size={10} className="inline -mt-0.5" /> مجموع نصيبهم {formatDuration(totalMin)} من{" "}
              {capacityHours} ساعة تشغيل — المرجع لا يحجز شيئًا.
            </span>
            {onManage ? (
              <Button
                variant="secondary"
                className="mr-auto px-3 py-1.5 text-[11px]"
                onClick={onManage}
                data-testid="day-base-manage"
              >
                <Settings2 size={13} /> إدارة القائمة في أيام الديالة
              </Button>
            ) : null}
          </div>
        </>
      )}

      <p className="mt-2 flex items-start gap-1 text-[10px] leading-relaxed text-gray-400">
        <Info size={11} className="mt-0.5 shrink-0" />
        الإضافة والتعديل (لصق قائمة · تحديد جماعي · شخص جديد · توزيع على الأسهم · تثبيت الكشف) في قسم
        «أيام الديالة» فقط، فلا تتكرّر القائمة ولا تختلف نسختها.
      </p>
    </Card>
  );
}
