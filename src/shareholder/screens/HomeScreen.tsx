import { CalendarDays, CalendarClock, Droplets, Moon, Sun, TrendingUp } from "lucide-react";
import { useShareholder } from "../store";
import { activeCycles, currentDayOfCycle, findPump } from "../selectors";
import { cycleDayDate } from "../calc";
import { formatDayDate, gregorianToday, hijriToday } from "../format";
import { Button, Card, EmptyState, Pill } from "../../components/ui";

interface UpcomingTurn {
  cycleId: string;
  cycleName: string;
  pumpName: string;
  day: number;
  date: Date;
  isToday: boolean;
}

function useUpcomingTurns(): UpcomingTurn[] {
  const { state } = useShareholder();
  const cycles = activeCycles(state);
  const upcoming: UpcomingTurn[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + 7 * 86400000);

  for (const cycle of cycles) {
    for (let day = 1; day <= cycle.days; day++) {
      const date = cycleDayDate(cycle.startDate, day);
      date.setHours(0, 0, 0, 0);
      if (date.getTime() < today.getTime()) continue;
      if (date.getTime() > horizon.getTime()) break;
      const pump = findPump(state, cycle.pumpId);
      upcoming.push({
        cycleId: cycle.id,
        cycleName: cycle.name,
        pumpName: pump?.name ?? "—",
        day,
        date,
        isToday: date.getTime() === today.getTime(),
      });
    }
  }
  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
  return upcoming;
}

export default function HomeScreen({
  onGoToPumps,
  onGoToCycles,
}: {
  onGoToPumps: () => void;
  onGoToCycles: () => void;
}) {
  const { state } = useShareholder();
  const cycles = activeCycles(state);
  const upcoming = useUpcomingTurns();
  const nearest = upcoming[0];

  return (
    <div className="space-y-4">
      {/* welcome + dates */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-l from-emerald-600 to-emerald-500 p-5 text-white">
          <div className="text-sm text-emerald-100">أهلًا بك 👋</div>
          <div className="text-2xl font-black">{state.profile.name || "مساهم"}</div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5">
              <Sun size={15} /> {gregorianToday()}
            </span>
            <span className="flex items-center gap-1.5">
              <Moon size={15} /> {hijriToday() || "—"}
            </span>
          </div>
        </div>
      </Card>

      {/* أقرب دور لي */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-base font-extrabold text-gray-800 dark:text-white">
          <TrendingUp size={18} className="text-emerald-600" /> أقرب دور لي
        </h2>
        {!nearest ? (
          <EmptyState
            icon={<CalendarClock size={26} />}
            title="لا توجد أدوار قادمة"
            description="أضف مضخة وأنشئ دياله لتظهر أدوارك هنا."
            action={
              <div className="flex flex-col gap-2">
                <Button onClick={onGoToCycles}>إنشاء دياله</Button>
                <Button variant="secondary" onClick={onGoToPumps}>
                  إضافة مضخة
                </Button>
              </div>
            }
          />
        ) : (
          <Card className="overflow-hidden border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-4 dark:from-emerald-900/30 dark:to-slate-800 dark:border-emerald-800">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
                <span className="text-lg font-black leading-none">{nearest.day}</span>
                <span className="text-[10px]">اليوم</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-extrabold text-gray-900 dark:text-white">
                    {nearest.pumpName}
                  </span>
                  {nearest.isToday && <Pill tone="green">اليوم</Pill>}
                </div>
                <div className="mt-0.5 text-sm text-gray-600 dark:text-slate-300">
                  {formatDayDate(nearest.date)}
                </div>
                <div className="mt-0.5 text-xs text-gray-400 dark:text-slate-400">
                  {nearest.cycleName}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* الأدوار القادمة */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-base font-extrabold text-gray-800 dark:text-white">
          <CalendarClock size={18} className="text-emerald-600" /> الأدوار القادمة (٧ أيام)
        </h2>
        {upcoming.length === 0 ? (
          <Card className="p-4 text-center text-sm text-gray-400 dark:text-slate-400">
            لا توجد أدوار قريبة ضمن الأيام السبعة القادمة.
          </Card>
        ) : (
          <div className="space-y-2">
            {upcoming.map((u, i) => (
              <Card
                key={u.cycleId + "-" + u.day}
                className={`flex items-center gap-3 p-3 ${i === 0 ? "border-emerald-300 dark:border-emerald-700" : ""}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-sm font-black text-gray-700 dark:bg-slate-700 dark:text-slate-200">
                  {u.day}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-gray-800 dark:text-white">
                    {u.pumpName} — اليوم {u.day}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-slate-400">
                    {formatDayDate(u.date)}
                  </div>
                </div>
                {u.isToday && <Pill tone="green">اليوم</Pill>}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* يوم الدياله لكل مضخة */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 px-1 text-base font-extrabold text-gray-800 dark:text-white">
          <CalendarDays size={18} className="text-emerald-600" /> يوم الدياله لكل مضخة
        </h2>
        {cycles.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={26} />}
            title="لا توجد ديالات بعد"
            description="أضف مضخة ثم أنشئ دياله لتظهر هنا."
          />
        ) : (
          <div className="space-y-2">
            {cycles.map((cycle) => {
              const pump = findPump(state, cycle.pumpId);
              const day = currentDayOfCycle(cycle);
              const status =
                day === null
                  ? new Date() < new Date(cycle.startDate)
                    ? "لم تبدأ"
                    : "انتهت"
                  : null;
              return (
                <Card key={cycle.id} className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Droplets size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-extrabold text-gray-900 dark:text-white">
                      {pump?.name ?? "—"}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-slate-400">
                      {cycle.name} · {cycle.days} يوم
                    </div>
                  </div>
                  {day !== null ? (
                    <div className="text-left">
                      <div className="text-xs text-gray-400 dark:text-slate-400">اليوم</div>
                      <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                        {day}
                      </div>
                    </div>
                  ) : (
                    <Pill tone={status === "انتهت" ? "gray" : "amber"}>{status}</Pill>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
