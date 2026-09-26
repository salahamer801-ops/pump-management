/**
 * اختبار الاستمرارية (PostgreSQL): نضيف بيانات عبر الـ API الحقيقي، نعيد تشغيل الخادم،
 * ثم نتأكد أن نفس البيانات ما زالت تُقرأ — أي أنها في قاعدة البيانات لا في ذاكرة العملية.
 *
 *   node scripts/verify-persistence.mjs seed     # إنشاء البيانات + حفظ المعرّفات
 *   # ... أعد تشغيل الخادم ...
 *   node scripts/verify-persistence.mjs verify   # التحقق بعد إعادة التشغيل
 *
 * API_BASE اختياري (الافتراضي http://127.0.0.1:3001).
 * معرّفات التشغيل تُحفظ في .mythex/persist-ids.json (خارج git).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.API_BASE || "http://127.0.0.1:3001";
const STATES = fileURLToPath(new URL("../.mythex/persist-ids.json", import.meta.url));
const PHONE = "779001234";
const PASSWORD = "test12345";
const PUMP_NAME = "مضخة اختبار الاستمرارية";
const MARK = { farm: "مزرعة الاستمرارية", fuelPrice: 4321, workStart: "05:30", workEnd: "19:30" };

async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function loginOrRegister() {
  let res = await api("POST", "/api/auth/login", { body: { phone: PHONE, password: PASSWORD } });
  if (res.status === 200 && res.json?.token) return { token: res.json.token, created: false };
  res = await api("POST", "/api/auth/register", {
    body: {
      name: "مدير اختبار الاستمرارية",
      phone: PHONE,
      password: PASSWORD,
      confirmPassword: PASSWORD,
      accountType: "manager",
    },
  });
  if (res.status !== 201 || !res.json?.token) {
    throw new Error(`register/login failed: ${res.status} ${JSON.stringify(res.json)}`);
  }
  return { token: res.json.token, created: true };
}

const mode = process.argv[2] || "verify";

if (mode === "seed") {
  const { token, created } = await loginOrRegister();
  console.log(`الحساب: ${created ? "أُنشئ الآن" : "موجود مسبقًا"} — ${PHONE}`);

  /* مضخة: نبحث عنها بالاسم، وننشئها إن لم توجد */
  const list = await api("GET", "/api/pumps", { token });
  const pumps = list.json?.managedPumps ?? list.json?.pumps ?? list.json?.data ?? [];
  let pump = pumps.find((p) => p.name === PUMP_NAME);
  if (!pump) {
    const made = await api("POST", "/api/pumps", {
      token,
      body: { name: PUMP_NAME, description: "اختبار استمرارية البيانات", location: "صنعاء" },
    });
    if (made.status !== 201) throw new Error(`pump create: ${made.status} ${JSON.stringify(made.json)}`);
    pump = made.json.pump;
    console.log(`أُنشئت المضخة: ${pump.name} · كود الانضمام ${pump.pumpCode}`);
  } else {
    console.log(`المضخة موجودة: ${pump.name} · كود الانضمام ${pump.pumpCode}`);
  }

  const runId = `run${Date.now().toString(36)}`;
  const dialaId = `diala_${runId}`;
  const dayId = `day_${runId}`;

  /* الديالة أولًا (اليوم مرتبط بها على الخادم) */
  const diala = await api("POST", `/api/pumps/${pump.id}/dialas`, {
    token,
    body: { id: dialaId, number: 1, startDate: "2026-02-01", days: 10, notes: `ديالة ${runId}` },
  });
  if (diala.status !== 201) throw new Error(`diala create: ${diala.status} ${JSON.stringify(diala.json)}`);
  console.log(`إنشاء الديالة: HTTP ${diala.status}`);

  const day = {
    id: dayId,
    dialaId,
    dayIndex: 1,
    date: "2026-02-01",
    status: "in_progress",
    workStart: "05:30",
    workEnd: "19:30",
    capacityMin: 840,
    plannedWorkStart: "05:30",
    plannedWorkEnd: "19:30",
    plannedCapacityMin: 840,
    notes: "يوم اختبار الاستمرارية",
  };
  const saved = await api("PUT", `/api/pumps/${pump.id}/operating`, {
    token,
    body: { data: { settings: MARK, days: [day] } },
  });
  console.log(`حفظ الإعدادات واليوم: HTTP ${saved.status}${saved.status >= 400 ? " " + JSON.stringify(saved.json) : ""}`);
  if (saved.status !== 200) throw new Error("لم يُحفظ اليوم — توقّف الاختبار");

  const roster = [
    { id: `r1_${runId}`, dialaId, personId: `p1_${runId}`, personName: "أحمد الاستمرارية", role: "shareholder", shareMin: 30, order: 1, archived: false },
    { id: `r2_${runId}`, dialaId, personId: `p2_${runId}`, personName: "سالم الاستمرارية", role: "shareholder", shareMin: 30, order: 2, archived: false },
    { id: `r3_${runId}`, dialaId, personId: `p3_${runId}`, personName: "ناصر الاستمرارية", role: "shareholder", shareMin: 40, order: 3, archived: false },
  ];
  const posted = await api("POST", `/api/dialas/${dialaId}/base-roster`, { token, body: { roster } });
  console.log(`كشف الدوام الأساسي: HTTP ${posted.status} · المجموع ${posted.json?.totalMin} دقيقة`);

  const entries = [
    { id: `e1_${runId}`, dayId, orderIndex: 1, personId: `p2_${runId}`, personName: "سالم الاستمرارية (قُدِّم)", role: "shareholder", startTime: "05:30", endTime: "06:00", plannedMin: 30, status: "planned", entryType: "moved_forward" },
    { id: `e2_${runId}`, dayId, orderIndex: 2, personId: `p1_${runId}`, personName: "أحمد الاستمرارية", role: "shareholder", startTime: "06:00", endTime: "06:30", plannedMin: 30, status: "planned", entryType: "roster" },
    { id: `e3_${runId}`, dayId, orderIndex: 3, personId: `p9_${runId}`, personName: "ضيف اليوم الاستمرارية", role: "guest", startTime: "06:30", endTime: "07:00", plannedMin: 30, status: "planned", entryType: "guest" },
  ];
  const scheduled = await api("POST", `/api/days/${dayId}/actual-schedule`, { token, body: { entries } });
  console.log(`الدوام الفعلي: HTTP ${scheduled.status} · ${scheduled.json?.entries?.length} صف${scheduled.status >= 400 ? " " + JSON.stringify(scheduled.json) : ""}`);

  mkdirSync(dirname(STATES), { recursive: true });
  writeFileSync(
    STATES,
    JSON.stringify(
      { pumpId: pump.id, pumpName: PUMP_NAME, pumpCode: pump.pumpCode, dialaId, dayId, runId, phone: PHONE },
      null,
      2
    )
  );
  console.log(`\nالمعرّفات محفوظة في .mythex/persist-ids.json`);
  process.exit(0);
}

/* ------------------------------- verify ------------------------------- */
const state = JSON.parse(readFileSync(STATES, "utf8"));
let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const { token } = await loginOrRegister();
check("الدخول بالحساب نفسه نجح بعد إعادة التشغيل", Boolean(token));

const op = await api("GET", `/api/pumps/${state.pumpId}/operating`, { token });
check("المضخة تُقرأ من الخادم بعد إعادة التشغيل", op.status === 200, `HTTP ${op.status}`);
check(
  "إعدادات المضخة محفوظة كما هي (المزرعة + سعر الديزل 4321 + ساعات العمل)",
  op.json?.settings?.farm === MARK.farm &&
    Number(op.json?.settings?.fuelPrice) === MARK.fuelPrice &&
    op.json?.settings?.workStart === MARK.workStart &&
    op.json?.settings?.workEnd === MARK.workEnd,
  `المزرعة: ${op.json?.settings?.farm} · سعر الديزل: ${op.json?.settings?.fuelPrice} · ${op.json?.settings?.workStart}→${op.json?.settings?.workEnd}`
);
const day = (op.json?.days ?? []).find((d) => d.id === state.dayId);
check("اليوم الفعلي ما زال موجودًا بعد إعادة التشغيل", Boolean(day), day ? `${day.date} · ${day.status}` : "مفقود");

const roster = await api("GET", `/api/dialas/${state.dialaId}/base-roster`, { token });
check(
  "كشف الدوام الأساسي (3 أعضاء · 100 دقيقة) محفوظ",
  roster.status === 200 && roster.json?.roster?.length === 3 && roster.json?.totalMin === 100,
  `${roster.json?.roster?.length} عضو · ${roster.json?.totalMin} دقيقة`
);
const shares = (roster.json?.roster ?? []).map((r) => r.shareMin).sort((a, b) => a - b).join("+");
check("الأسهم والدقائق محفوظة بأعيانها", shares === "30+30+40", shares);

const sched = await api("GET", `/api/days/${state.dayId}/actual-schedule`, { token });
const guest = (sched.json?.entries ?? []).find((e) => e.entryType === "guest");
check(
  "الدوام الفعلي (3 صفوف بينها ضيف اليوم) محفوظ",
  sched.status === 200 && sched.json?.entries?.length === 3 && Boolean(guest),
  `${sched.json?.entries?.length} صف`
);

const fresh = await api("POST", "/api/auth/login", { body: { phone: state.phone, password: "test12345" } });
const freshOp = await api("GET", `/api/pumps/${state.pumpId}/operating`, { token: fresh.json?.token });
check(
  "جلسة جديدة تمامًا (كجهاز آخر) تقرأ نفس البيانات من الخادم",
  freshOp.status === 200 && freshOp.json?.settings?.farm === MARK.farm,
  `HTTP ${freshOp.status}`
);

console.log(`\n${pass} ناجح · ${fail} فاشل`);
process.exit(fail === 0 ? 0 : 1);
