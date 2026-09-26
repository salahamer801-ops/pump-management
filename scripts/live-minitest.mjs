/**
 * اختبار إنتاجي مصغّر داخل Mythex — أربعة أقسام في تشغيل واحد:
 *   1) تدقيق قاعدة البيانات الفعلية (قراءة فقط): الجداول، الأعمدة، PK/FK،
 *      والصفوف اليتيمة والمكررة والناقصة، وتغطية العلاقات.
 *   2) واجهات الـ API المطلوبة على الخادم الحقيقي.
 *   3) الصلاحيات: مدير يعدّل مضخته · مساهم يقرأ المسموح ولا يعدّل.
 *   4) بيانات اختبار (محمد اختبار / مضخة اختبار 01 / علي اختبار / ديالة اختبار 01)
 *      ثم حذفها كلها في معاملة واحدة بعد نسخة احتياطية JSON — بلا لمس أي بيانات حقيقية.
 *
 *   node scripts/live-minitest.mjs            # ينفّذ ثم ينظّف
 *   node scripts/live-minitest.mjs --keep     # يُبقي بيانات الاختبار للمعاينة
 *   API_BASE=http://localhost:3001 (اختياري)
 *
 * ملاحظة: لا يُطبع أي سر — لا DATABASE_URL ولا رموز الجلسات.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const requireServer = createRequire(fileURLToPath(new URL("../server/package.json", import.meta.url)));
const pg = requireServer("pg");
const API = process.env.API_BASE || "http://127.0.0.1:3001";
const KEEP = process.argv.includes("--keep");
const BACKUP_PATH = fileURLToPath(new URL("../.mythex/", import.meta.url));

/* --------------------------------- أدوات --------------------------------- */
let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const note = (text) => console.log(`  • ${text}`);
const section = (text) => console.log(`\n===== ${text} =====`);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const q = (text, params) => pool.query(text, params);
const one = async (text, params) => (await q(text, params)).rows[0];

async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    return { status: 0, json: { error: { message: `تعذّر الوصول إلى الخادم: ${err.message}` } } };
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/** نداء API مع تسجيل النتيجة تلقائيًا */
async function hit(method, path, { token, body, expect = 200, name } = {}) {
  const res = await api(method, path, { token, body });
  const wanted = Array.isArray(expect) ? expect : [expect];
  const ok = wanted.includes(res.status);
  const detail = ok
    ? `HTTP ${res.status}`
    : `HTTP ${res.status} · ${JSON.stringify(res.json)?.slice(0, 180) ?? ""}`;
  check(name ?? `${method} ${path}`, ok, detail);
  return res;
}

/* ------------------------- [1] تدقيق قاعدة البيانات ------------------------- */
const SOFT_REFS = [
  ["diala_days", "diala_id", "dialas"],
  ["day_entries", "postpone_to_day_id", "diala_days"],
  ["actual_usages", "day_id", "diala_days"],
  ["actual_usages", "entry_id", "day_entries"],
  ["pump_stops", "day_id", "diala_days"],
  ["fuel_records", "diala_id", "dialas"],
  ["finance_records", "day_id", "diala_days"],
  ["finance_records", "diala_id", "dialas"],
  ["personal_records", "pump_id", "pumps"],
  ["audit_logs", "pump_id", "pumps"],
  ["audit_logs", "actor_id", "users"],
  ["pump_memberships", "approved_by", "users"],
  ["pump_memberships", "rejected_by", "users"],
  ["pump_memberships", "removed_by", "users"],
  ["pump_settings", "updated_by", "users"],
  ["dialas", "locked_by", "users"],
  ["dialas", "roster_locked_by", "users"],
  ["pump_shareholders", "person_id", "pump_people"],
  ["pump_shareholders", "counterpart_person_id", "pump_people"],
  ["diala_roster", "person_id", "pump_people"],
  ["day_entries", "person_id", "pump_people"],
];

const DUP_CHECKS = [
  ["users", ["phone"], ""],
  ["pumps", ["code"], ""],
  ["pump_memberships", ["pump_id", "user_id"], ""],
  ["pump_settings", ["pump_id"], ""],
  ["pump_sync", ["pump_id"], ""],
  ["pump_people", ["pump_id", "name"], "name <> ''"],
  ["pump_shareholders", ["pump_id", "share_no"], "share_no is not null"],
  ["dialas", ["pump_id", "number"], "number > 0"],
  ["diala_days", ["diala_id", "day_index"], "diala_id is not null"],
  ["diala_roster", ["diala_id", "person_id"], "person_id is not null"],
  ["day_entries", ["day_id", "order_index"], "day_id is not null"],
];

const MISSING_CHECKS = [
  ["users", "phone", "text"],
  ["users", "password_hash", "text"],
  ["pumps", "name", "text"],
  ["pumps", "code", "text"],
  ["pumps", "manager_id", "uuid"],
  ["pump_settings", "work_start", "text"],
  ["pump_settings", "work_end", "text"],
  ["diala_roster", "person_name", "text"],
  ["day_entries", "start_time", "text"],
  ["day_entries", "end_time", "text"],
  ["dialas", "days", "num"],
  ["diala_roster", "share_min", "num"],
];

const COVERAGE = [
  ["ديالات نشطة بلا كشف دوام", `select count(*)::int c from dialas d where d.deleted_at is null and not exists (select 1 from diala_roster r where r.diala_id = d.id and r.deleted_at is null)`, "warn"],
  ["ديالات فيها كشف بلا أيام", `select count(*)::int c from dialas d where d.deleted_at is null and exists (select 1 from diala_roster r where r.diala_id = d.id and r.deleted_at is null) and not exists (select 1 from diala_days dd where dd.diala_id = d.id)`, "warn"],
  ["أيام بلا دوام فعلي مسجَّل", `select count(*)::int c from diala_days dd where dd.deleted_at is null and not exists (select 1 from day_entries e where e.day_id = dd.id and e.deleted_at is null)`, "warn"],
  ["مضخات بلا صف إعدادات (pump_settings)", `select count(*)::int c from pumps p where not exists (select 1 from pump_settings s where s.pump_id = p.id)`, "warn"],
  ["عضويات معتمدة بلا ربط بشخص", `select count(*)::int c from pump_memberships m where m.status = 'approved' and (m.person_id is null or btrim(m.person_id) = '')`, "warn"],
  ["صفوف كشف بلا person_id", `select count(*)::int c from diala_roster r where r.deleted_at is null and (r.person_id is null or btrim(r.person_id) = '')`, "warn"],
  ["أيام بلا ديالة (diala_id فارغ)", `select count(*)::int c from diala_days dd where dd.diala_id is null or btrim(dd.diala_id) = ''`, "fail"],
  ["سجلات شخصية بلا مستخدم", `select count(*)::int c from personal_records pr where not exists (select 1 from users u where u.id = pr.user_id)`, "fail"],
];

async function schemaMap() {
  const tables = (
    await q(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`
    )
  ).rows.map((r) => r.table_name);

  const cols = {};
  const pk = {};
  const fks = {};
  for (const t of tables) {
    cols[t] = (
      await q(
        `select column_name, data_type from information_schema.columns
          where table_schema = 'public' and table_name = $1 order by ordinal_position`,
        [t]
      )
    ).rows;
    pk[t] = (
      await q(
        `select kcu.column_name from information_schema.table_constraints tc
           join information_schema.key_column_usage kcu
             on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
          where tc.table_schema = 'public' and tc.table_name = $1 and tc.constraint_type = 'PRIMARY KEY'`,
        [t]
      )
    ).rows.map((r) => r.column_name);
    fks[t] = (
      await q(
        `select kcu.column_name as col, ccu.table_name as ref_table,
                rc.delete_rule as rule
           from information_schema.table_constraints tc
           join information_schema.key_column_usage kcu
             on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
           join information_schema.constraint_column_usage ccu
             on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
           join information_schema.referential_constraints rc
             on rc.constraint_name = tc.constraint_name
          where tc.table_schema = 'public' and tc.table_name = $1 and tc.constraint_type = 'FOREIGN KEY'`,
        [t]
      )
    ).rows;
  }
  return { tables, cols, pk, fks };
}

async function countAll(tables) {
  const out = {};
  for (const t of tables) out[t] = (await one(`select count(*)::int c from "${t}"`)).c;
  return out;
}

async function orphanReport(cols) {
  const out = [];
  const refCount = new Map();
  for (const [table, col, ref] of SOFT_REFS) {
    if (!cols[table]?.some((c) => c.column_name === col)) continue;
    if (!cols[ref]?.some((c) => c.column_name === "id")) continue;
    const r = await one(
      `select count(*)::int c from "${table}" a
        where a."${col}" is not null and btrim(a."${col}"::text) <> ''
          and not exists (select 1 from "${ref}" b where b.id::text = a."${col}"::text)`
    );
    if (!refCount.has(ref)) refCount.set(ref, (await one(`select count(*)::int c from "${ref}"`)).c);
    out.push({ table, col, ref, count: r.c, refEmpty: refCount.get(ref) === 0 });
  }
  return out;
}

/** أمثلة فعلية على الصفوف المكررة (أي مضخة/أي ديالة) */
async function dupExamples(cols, dup) {
  const def = DUP_CHECKS.find((c) => c[0] === dup.table && c[1].join("+") === dup.keys);
  if (!def) return "—";
  const [table, keys, extra] = def;
  const hasSoftDelete = cols[table].some((c) => c.column_name === "deleted_at");
  const where = [hasSoftDelete ? "deleted_at is null" : null, extra || null].filter(Boolean).join(" and ");
  const r = await q(
    `select ${keys.join(", ")}, count(*)::int c from "${table}" ${where ? `where ${where}` : ""}
      group by ${keys.join(", ")} having count(*) > 1 order by c desc limit 3`
  );
  return r.rows.map((x) => `${keys.map((k) => String(x[k] ?? "").slice(0, 14)).join(" / ")} ×${x.c}`).join(" · ");
}

async function dupReport(cols) {
  const out = [];
  for (const [table, keys, extra] of DUP_CHECKS) {
    if (!cols[table]) continue;
    const hasSoftDelete = cols[table].some((c) => c.column_name === "deleted_at");
    const where = [hasSoftDelete ? "deleted_at is null" : null, extra || null].filter(Boolean).join(" and ");
    const r = await one(
      `select coalesce(sum(c - 1), 0)::int extra from (
         select count(*)::int c from "${table}" ${where ? `where ${where}` : ""}
          group by ${keys.join(", ")} having count(*) > 1
       ) s`
    );
    out.push({ table, keys: keys.join("+"), count: r.extra });
  }
  return out;
}

async function missingReport(cols) {
  const out = [];
  for (const [table, col, kind] of MISSING_CHECKS) {
    if (!cols[table]?.some((c) => c.column_name === col)) continue;
    const cond =
      kind === "text"
        ? `"${col}" is null or btrim("${col}"::text) = ''`
        : kind === "num"
          ? `"${col}" is null or "${col}" = 0`
          : `"${col}" is null`;
    const r = await one(`select count(*)::int c from "${table}" where ${cond}`);
    out.push({ table, col, kind, count: r.c });
  }
  return out;
}

async function auditDb(title) {
  section(title);
  const { tables, cols, pk, fks } = await schemaMap();
  const counts = await countAll(tables);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  note(`الجداول في قاعدة البيانات: ${tables.length} · إجمالي الصفوف: ${total}`);
  console.log("\n  الجدول | الصفوف | المفتاح الأساسي | المفاتيح الأجنبية");
  for (const t of tables) {
    const pkText = pk[t].length ? pk[t].join("+") : "⚠️ بلا PK";
    const fkText = fks[t].length
      ? fks[t].map((f) => `${f.col}→${f.ref_table}${f.rule && f.rule !== "NO ACTION" ? `(${f.rule})` : ""}`).join(", ")
      : "—";
    console.log(`  ${t} | ${counts[t]} | ${pkText} | ${fkText}`);
  }

  const noPk = tables.filter((t) => pk[t].length === 0);
  console.log("");
  check(`كل الجداول لها مفتاح أساسي (${tables.length})`, noPk.length === 0, noPk.length ? `بلا PK: ${noPk.join(", ")}` : "كلها ✅");

  const orphans = await orphanReport(cols);
  const realOrphans = orphans.filter((o) => o.count > 0 && !o.refEmpty);
  const unresolved = orphans.filter((o) => o.count > 0 && o.refEmpty);
  check(
    `لا صفوف يتيمة تشير إلى كيان محذوف (من ${orphans.length} علاقة)`,
    realOrphans.reduce((a, b) => a + b.count, 0) === 0,
    realOrphans.length
      ? realOrphans.map((o) => `${o.table}.${o.col}→${o.ref}: ${o.count}`).join(" · ")
      : "الصفر في كل العلاقات التي لها هدف مُشبَع"
  );
  if (unresolved.length) {
    note(
      "مراجع ناعمة بلا هدف مُشبَع (الجدول الهدف فارغ تمامًا — الأشخاص محفوظون بالاسم داخل الصفوف): " +
        unresolved.map((o) => `${o.table}.${o.col} (${o.count} صف)`).join(" · ")
    );
  }

  const dups = await dupReport(cols);
  const dupList = dups.filter((d) => d.count > 0);
  check(
    `لا تكرار في ${dups.length} مجموعة مفاتيح منطقية`,
    dupList.length === 0,
    dupList.length ? dupList.map((d) => `${d.table}(${d.keys}): ${d.count}`).join(" · ") : "الصفر في كل المجموعات"
  );
  for (const d of dupList) note(`تكرار ${d.table}(${d.keys}): ${await dupExamples(cols, d)}`);

  const missing = await missingReport(cols);
  const hardMissing = missing.filter((m) => m.count > 0 && m.kind !== "num");
  const softMissing = missing.filter((m) => m.count > 0 && m.kind === "num");
  check(
    "لا بيانات ناقصة في الأعمدة المطلوبة",
    hardMissing.length === 0,
    hardMissing.length ? hardMissing.map((m) => `${m.table}.${m.col}: ${m.count}`).join(" · ") : "لا نقص"
  );
  if (softMissing.length) {
    note(
      `قيم صفرية (تحتاج نظرًا): ${softMissing.map((m) => `${m.table}.${m.col}: ${m.count}`).join(" · ")}`
    );
  }

  let coverageProblem = 0;
  for (const [label, sql, level] of COVERAGE) {
    const r = await one(sql);
    const c = r.c;
    const mark = c === 0 ? "✅" : level === "fail" ? "❌" : "⚠️";
    if (c > 0 && level === "fail") coverageProblem += 1;
    console.log(`  ${mark} ${label}: ${c}`);
  }
  check("علاقات التغطية سليمة (لا خلل بنيوي)", coverageProblem === 0);

  return { tables, cols, counts, orphans, dups, missing };
}

/* --------------- حذف بيانات الاختبار: نسخة احتياطية JSON ثم معاملة واحدة --------------- */
const PUMP_TABLES = [
  "pump_settings", "pump_memberships", "pump_people", "pump_shareholders", "dialas",
  "diala_roster", "diala_days", "day_entries", "actual_usages", "pump_stops",
  "fuel_records", "operator_records", "finance_records", "pump_sync",
];

async function purgeTestData(userIds, pumpIds, tag, base) {
  const managed = (await q(`select id from pumps where manager_id = any($1::uuid[])`, [userIds])).rows.map((r) => r.id);
  for (const id of managed) if (!pumpIds.includes(id)) pumpIds.push(id);

  const backup = {
    at: new Date().toISOString(),
    note: "بيانات اختبار — كلمات المرور (hash) غير مُدرجة",
    users: (await q(`select id, name, phone, account_type, status, created_at from users where id = any($1::uuid[])`, [userIds])).rows,
    pumps: (await q(`select * from pumps where id = any($1::uuid[])`, [pumpIds])).rows,
    rows: {},
  };
  for (const t of PUMP_TABLES) {
    backup.rows[t] = (await q(`select * from "${t}" where pump_id = any($1::uuid[])`, [pumpIds])).rows;
  }
  backup.rows.personal_records = (
    await q(`select * from personal_records where user_id = any($1::uuid[]) or pump_id = any($2::uuid[])`, [userIds, pumpIds])
  ).rows;
  backup.rows.audit_logs = (
    await q(
      `select * from audit_logs
        where pump_id = any($1::uuid[]) or actor_id = any($2::uuid[]) or entity_id = any($3::text[])`,
      [pumpIds, userIds, [...userIds, ...pumpIds, ...dialaIds]]
    )
  ).rows;
  backup.rows.sessions = (
    await q(`select id, user_id, created_at, expires_at, revoked_at from sessions where user_id = any($1::uuid[])`, [userIds])
  ).rows;

  mkdirSync(BACKUP_PATH, { recursive: true });
  const file = `${BACKUP_PATH}${tag}-backup-${base}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 1));
  note(`نسخة احتياطية قبل الحذف: .mythex/${tag}-backup-${base}.json`);
  note(
    `ما سيُحذف: ${userIds.length} حساب اختبار · ${pumpIds.length} مضخة اختبار · ${backup.rows.dialas.length} ديالة · ` +
      `${backup.rows.diala_roster.length} صف كشف · ${backup.rows.personal_records.length} سجل شخصي · ${backup.rows.audit_logs.length} حدث تدقيق`
  );

  const client = await pool.connect();
  const deleted = {};
  try {
    await client.query("begin");
    deleted.audit_logs = (
      await client.query(
        `delete from audit_logs
          where pump_id = any($1::uuid[]) or actor_id = any($2::uuid[]) or entity_id = any($3::text[])`,
        [pumpIds, userIds, [...userIds, ...pumpIds, ...dialaIds]]
      )
    ).rowCount;
    deleted.personal_records = (
      await client.query(`delete from personal_records where user_id = any($1::uuid[]) or pump_id = any($2::uuid[])`, [userIds, pumpIds])
    ).rowCount;
    deleted.pumps = (await client.query(`delete from pumps where id = any($1::uuid[])`, [pumpIds])).rowCount;
    deleted.users = (await client.query(`delete from users where id = any($1::uuid[])`, [userIds])).rowCount;
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    client.release();
    throw err;
  }
  client.release();
  return { deleted, file, backup };
}

/** إيجاد بقايا تشغيل سابق بالاسم الدقيق (محمد اختبار / علي اختبار / مدير آخر اختبار + مضخة اختبار 01) */
async function findTestEntities() {
  const users = (await q(`select id, name, phone from users where name = any($1::text[])`, [Object.values(NAMES)])).rows;
  const userIds = users.map((u) => u.id);
  const pumps = userIds.length
    ? (await q(`select id, name, code from pumps where name = $1 and manager_id = any($2::uuid[])`, [PUMP_NAME, userIds])).rows
    : [];
  return { users, userIds, pumps, pumpIds: pumps.map((p) => p.id) };
}

/* --------------------------------- التشغيل --------------------------------- */
const base = String(Date.now()).slice(-6);
const PHONE = { manager: `78${base}1`, shareholder: `78${base}2`, other: `78${base}3` };
const PASSWORD = "test12345";
const NAMES = { manager: "محمد اختبار", shareholder: "علي اختبار", other: "مدير آخر اختبار" };
const PUMP_NAME = "مضخة اختبار 01";
const DIALA_ID = `diala_test01_${base}`;
const userIds = [];
const pumpIds = [];
const dialaIds = [DIALA_ID];

/* وضع الحذف فقط: يزيل بقايا تشغيل سابق بعد انقطاع (بالمطابقة الدقيقة للأسماء) */
if (process.argv.includes("--cleanup-only")) {
  console.log("===== حذف بقايا بيانات الاختبار =====");
  const found = await findTestEntities();
  if (!found.userIds.length && !found.pumpIds.length) {
    console.log("  ✅ لا بقايا: لا حساب «محمد اختبار / علي اختبار / مدير آخر اختبار» ولا مضخة «مضخة اختبار 01».");
  } else {
    console.log(
      `  • حُدّد: ${found.users.map((u) => u.name).join(" · ") || "—"} · مضخات: ${found.pumps.map((p) => `${p.name} (${p.code})`).join(" · ") || "—"}`
    );
    const { deleted, backup } = await purgeTestData(found.userIds, found.pumpIds, "leftover", base);
    console.log(
      `  ✅ حُذف: حسابات ${deleted.users}/${found.userIds.length} · مضخات ${deleted.pumps}/${found.pumpIds.length} · تدقيق ${deleted.audit_logs} · سجلات شخصية ${deleted.personal_records} · صفوف كشف ${backup.rows.diala_roster.length}`
    );
  }
  await pool.end();
  process.exit(0);
}

const before = await auditDb("[1/4] تدقيق قاعدة البيانات — قبل إنشاء بيانات الاختبار");

/* ------------------------------- [2] الـ API ------------------------------- */
section("[2/4] واجهات الـ API (خادم حقيقي + قاعدة بيانات حقيقية)");

await hit("GET", "/api/health", { expect: 200, name: "GET /api/health" });
const healthDb = await hit("GET", "/api/health/db", { expect: 200, name: "GET /api/health/db" });
check("فحص القاعدة يرجّع وقت الخادم", Boolean(healthDb.json?.db), String(healthDb.json?.db ?? "مفقود"));
await hit("GET", "/api/settings/public", { expect: 200, name: "GET /api/settings/public" });

/* تسجيل ثلاثة حسابات اختبار */
const reg = async (role) => {
  const res = await hit("POST", "/api/auth/register", {
    body: {
      name: NAMES[role],
      phone: PHONE[role],
      password: PASSWORD,
      confirmPassword: PASSWORD,
      accountType: role === "shareholder" ? "user" : "manager",
    },
    expect: 201,
    name: `POST /api/auth/register (${NAMES[role]})`,
  });
  if (res.json?.user?.id) userIds.push(res.json.user.id);
  return res;
};

const manager = await reg("manager");
const shareholder = await reg("shareholder");
const other = await reg("other");

await hit("POST", "/api/auth/login", {
  body: { phone: PHONE.manager, password: "كلمة-خاطئة" },
  expect: 401,
  name: "POST /api/auth/login بكلمة خاطئة → 401",
});
const login = await hit("POST", "/api/auth/login", {
  body: { phone: PHONE.manager, password: PASSWORD },
  expect: 200,
  name: "POST /api/auth/login",
});
const managerToken = login.json?.token;
const me = await hit("GET", "/api/auth/me", { token: managerToken, name: "GET /api/auth/me" });
check("بيانات الحساب صحيحة (/api/auth/me)", me.json?.user?.name === NAMES.manager, String(me.json?.user?.name ?? "—"));
await hit("GET", "/api/pumps", { expect: 401, name: "GET /api/pumps بلا تسجيل دخول → 401" });

/* المضخة */
const created = await hit("POST", "/api/pumps", {
  token: managerToken,
  body: { name: PUMP_NAME, description: "بيانات اختبار مصغّرة", location: "صنعاء" },
  expect: 201,
  name: "POST /api/pumps",
});
const pump = created.json?.pump;
if (pump?.id) pumpIds.push(pump.id);
check(
  "كود المضخة بصيغة الخادم المعتمدة PMP-XXXXXX",
  typeof pump?.pumpCode === "string" && /^PMP-[A-Z0-9]{4,12}$/.test(pump.pumpCode),
  String(pump?.pumpCode ?? "—")
);
await hit("GET", `/api/pumps/${pump?.id}`, { token: managerToken, name: "GET /api/pumps/:pumpId" });
await hit("GET", "/api/pumps", { token: managerToken, name: "GET /api/pumps (قائمة المدير)" });

const settings = {
  wells: "بئر اختبار",
  farm: "مزرعة اختبار",
  engine: "محرك اختبار",
  energyType: "diesel",
  workStart: "05:00",
  workEnd: "19:00",
  fuelConsumptionPerHour: 6,
  fuelCalcMode: "hour",
  fuelPrice: 777,
  royaltyEnabled: true,
  royaltyMode: "hour",
  royaltyPerHour: 150,
  operatorName: "رواس اختبار",
  operatorHourlyWage: 200,
  shareUnit: "سهم",
  currency: "YER",
};
await hit("PUT", `/api/pumps/${pump?.id}/operating`, {
  token: managerToken,
  body: { data: { settings } },
  name: "PUT /api/pumps/:pumpId/operating (حفظ)",
});
const opRead = await hit("GET", `/api/pumps/${pump?.id}/operating`, {
  token: managerToken,
  name: "GET /api/pumps/:pumpId/operating (استرجاع)",
});
check(
  "الإعدادات المحفوظة رجعت كما أُرسلت",
  opRead.json?.settings?.farm === "مزرعة اختبار" && Number(opRead.json?.settings?.fuelPrice) === 777,
  `المزرعة: ${opRead.json?.settings?.farm} · سعر الديزل: ${opRead.json?.settings?.fuelPrice}`
);

const diala = await hit("POST", `/api/pumps/${pump?.id}/dialas`, {
  token: managerToken,
  body: { id: DIALA_ID, number: 1, startDate: "2026-03-01", days: 10, notes: "ديالة اختبار 01" },
  expect: 201,
  name: "POST /api/pumps/:pumpId/dialas (ديالة اختبار 01)",
});
check("الديالة أُنشئت بالمعرّف نفسه", diala.json?.diala?.id === DIALA_ID, String(diala.json?.diala?.id ?? "—"));

const roster = [
  { id: `r1_${base}`, dialaId: DIALA_ID, personId: `p1_${base}`, personName: NAMES.shareholder, role: "shareholder", shareMin: 30, order: 1, archived: false },
  { id: `r2_${base}`, dialaId: DIALA_ID, personId: `p2_${base}`, personName: "عضو ثانٍ اختبار", role: "shareholder", shareMin: 30, order: 2, archived: false },
  { id: `r3_${base}`, dialaId: DIALA_ID, personId: `p3_${base}`, personName: "عضو ثالث اختبار", role: "shareholder", shareMin: 40, order: 3, archived: false },
];
await hit("POST", `/api/dialas/${DIALA_ID}/base-roster`, {
  token: managerToken,
  body: { roster },
  name: "POST /api/dialas/:dialaId/base-roster (3 أعضاء = 100 دقيقة)",
});
const rosterRead = await hit("GET", `/api/dialas/${DIALA_ID}/base-roster`, {
  token: managerToken,
  name: "GET /api/dialas/:dialaId/base-roster",
});
check("كشف الدوام رجع 3 صفوف بمجموع 100", rosterRead.json?.roster?.length === 3 && rosterRead.json?.totalMin === 100, `${rosterRead.json?.roster?.length} صف · ${rosterRead.json?.totalMin} دقيقة`);

/* السجل الشخصي */
const rec = await hit("POST", "/api/me/records", {
  token: managerToken,
  body: { date: "2026-03-02", kind: "turn", minutes: 45, liters: 4, cost: 900, notes: "سجل اختبار مصغّر" },
  expect: 201,
  name: "POST /api/me/records",
});
check("السجل الشخصي أُنشئ", Boolean(rec.json?.record?.id ?? rec.json?.id), String(rec.json?.record?.id ?? rec.json?.id ?? "—"));
const mine = await hit("GET", "/api/me/records", { token: managerToken, name: "GET /api/me/records" });
check("السجل الشخصي يُقرأ من الخادم", (mine.json?.records ?? []).length >= 1, `${(mine.json?.records ?? []).length} سجل`);

/* انضمام المساهم + الموافقة */
const loginShare = await hit("POST", "/api/auth/login", {
  body: { phone: PHONE.shareholder, password: PASSWORD },
  expect: 200,
  name: "POST /api/auth/login (المساهم)",
});
const shareholderToken = loginShare.json?.token;
await hit("POST", "/api/pumps/join", {
  token: shareholderToken,
  body: { pumpCode: pump?.pumpCode, note: "طلب اختبار مصغّر" },
  expect: 201,
  name: "POST /api/pumps/join (بكود المضخة)",
});
const requests = await hit("GET", `/api/pumps/${pump?.id}/requests`, {
  token: managerToken,
  name: "GET /api/pumps/:pumpId/requests",
});
const pending = (requests.json?.requests ?? []).find((r) => r.status === "pending");
check("طلب الانضمام ظاهر كـ«قيد المراجعة»", Boolean(pending), pending ? `طلب ${pending.id.slice(0, 8)}…` : "لا طلب");
if (pending) {
  await hit("POST", `/api/pumps/${pump?.id}/requests/${pending.id}/decision`, {
    token: managerToken,
    body: { action: "approve", membershipType: "shareholder", personName: NAMES.shareholder },
    name: "POST /api/pumps/:pumpId/requests/:id/decision (موافقة)",
  });
}
const meShare = await hit("GET", "/api/auth/me", { token: shareholderToken, name: "GET /api/auth/me (المساهم)" });
const membership = (meShare.json?.memberships ?? []).find((m) => m.pumpCode === pump?.pumpCode);
check("العضوية المعتمدة ظهرت للمساهم", membership?.status === "approved", String(membership?.status ?? "لا عضوية"));

await hit("GET", `/api/pumps/${pump?.id}/audit`, { token: managerToken, name: "GET /api/pumps/:pumpId/audit (سجل التدقيق)" });
await hit("GET", "/api/audit/me", { token: managerToken, name: "GET /api/audit/me (تدقيق صاحب الحساب)" });

/* ------------------------------ [3] الصلاحيات ------------------------------ */
section("[3/4] الصلاحيات — مدير يعدّل مضخته · مساهم يقرأ ولا يعدّل");

await hit("PATCH", `/api/pumps/${pump?.id}`, {
  token: managerToken,
  body: { location: "صنعاء — اختبار" },
  name: "المدير يعدّل مضخته → 200",
});

const shareRead = await hit("GET", `/api/pumps/${pump?.id}/operating`, {
  token: shareholderToken,
  expect: 200,
  name: "المساهم يقرأ بيانات المضخة التي ينتمي إليها → 200",
});
check(
  "المساهم يرى الإعدادات الرسمية نفسها",
  shareRead.json?.settings?.farm === "مزرعة اختبار",
  String(shareRead.json?.settings?.farm ?? "—")
);
await hit("GET", `/api/dialas/${DIALA_ID}/base-roster`, {
  token: shareholderToken,
  expect: 200,
  name: "المساهم يقرأ كشف الدوام الأساسي → 200",
});

await hit("POST", `/api/pumps/${pump?.id}/dialas`, {
  token: shareholderToken,
  body: { id: `diala_denied_${base}`, number: 9, days: 3 },
  expect: 403,
  name: "المساهم ينشئ ديالة → 403",
});
await hit("PUT", `/api/pumps/${pump?.id}/operating`, {
  token: shareholderToken,
  body: { data: { settings: { farm: "تخريب" } } },
  expect: 403,
  name: "المساهم يعدّل إعدادات المضخة → 403",
});
await hit("PATCH", `/api/pumps/${pump?.id}`, {
  token: shareholderToken,
  body: { name: "تخريب" },
  expect: 403,
  name: "المساهم يعدّل بيانات المضخة → 403",
});
await hit("POST", `/api/dialas/${DIALA_ID}/roster/unlock`, {
  token: shareholderToken,
  body: { reason: "محاولة مساهم" },
  expect: 403,
  name: "المساهم يفكّ تثبيت الكشف → 403",
});
await hit("GET", `/api/pumps/${pump?.id}/requests`, {
  token: shareholderToken,
  expect: 403,
  name: "المساهم يطّلع على طلبات الانضمام → 403",
});

/* مدير آخر: لا يرى ولا يعدّل مضخة غيره */
const loginOther = await api("POST", "/api/auth/login", { body: { phone: PHONE.other, password: PASSWORD } });
const otherToken = loginOther.json?.token;
await hit("GET", `/api/pumps/${pump?.id}/operating`, {
  token: otherToken,
  expect: [403, 404],
  name: "مدير آخر يقرأ مضخة ليست له → 403/404",
});
await hit("PATCH", `/api/pumps/${pump?.id}`, {
  token: otherToken,
  body: { name: "تخريب" },
  expect: [403, 404],
  name: "مدير آخر يعدّل مضخة ليست له → 403/404",
});
await hit("POST", `/api/pumps/${pump?.id}/dialas`, {
  token: otherToken,
  body: { id: `diala_other_${base}`, number: 1, days: 1 },
  expect: [403, 404],
  name: "مدير آخر ينشئ ديالة في مضخة ليست له → 403/404",
});

/* ------------------- [4] بيانات الاختبار في القاعدة + التنظيف ------------------- */
section("[4/4] بيانات الاختبار: هل كُتبت بشكل صحيح؟ ثم الحذف المعزول");

const dbPump = await one(`select id, code, name, manager_id from pumps where id = $1`, [pump?.id]);
check("المضخة مكتوبة في PostgreSQL", Boolean(dbPump), dbPump ? `${dbPump.name} · ${dbPump.code}` : "مفقودة");
check("مدير المضخة مربوط بجدول users (FK)", dbPump?.manager_id === userIds[0], String(dbPump?.manager_id ?? "—"));

const dbSettings = await one(`select pump_id, farm, fuel_price, work_start, work_end from pump_settings where pump_id = $1`, [pump?.id]);
check(
  "صف الإعدادات 1:1 مع المضخة (pump_settings)",
  Boolean(dbSettings) && dbSettings.pump_id === pump?.id,
  dbSettings ? `المزرعة: ${dbSettings.farm} · سعر الديزل: ${dbSettings.fuel_price} · ${dbSettings.work_start}→${dbSettings.work_end}` : "مفقود"
);

const dbRoster = await one(
  `select count(*)::int rows, coalesce(sum(share_min),0)::int total from diala_roster where diala_id = $1`,
  [DIALA_ID]
);
check("كشف الدوام مكتوب في القاعدة (3 صفوف · 100 دقيقة)", dbRoster.rows === 3 && dbRoster.total === 100, `${dbRoster.rows} صف · ${dbRoster.total} دقيقة`);

const dbMembership = await one(
  `select status, membership_type from pump_memberships where pump_id = $1 and user_id = $2`,
  [pump?.id, userIds[1]]
);
check("العضوية المعتمدة مكتوبة (pump_memberships)", dbMembership?.status === "approved", String(dbMembership?.status ?? "مفقودة"));

const dbPersonal = await one(`select count(*)::int c from personal_records where user_id = $1`, [userIds[0]]);
check("السجل الشخصي مكتوب (personal_records)", dbPersonal.c >= 1, `${dbPersonal.c} سجل`);

const dbAudit = await one(`select count(*)::int c from audit_logs where pump_id = $1`, [pump?.id]);
check("الأحداث مسجّلة في سجل التدقيق", dbAudit.c >= 5, `${dbAudit.c} حدث`);

/* فحص السلامة بعد الكتابة من التطبيق */
const { cols: colsAfter } = await schemaMap();
const realBefore = before.orphans.filter((o) => !o.refEmpty).reduce((a, b) => a + b.count, 0);
const realAfter = (await orphanReport(colsAfter)).filter((o) => !o.refEmpty).reduce((a, b) => a + b.count, 0);
const dupBefore = before.dups.reduce((a, b) => a + b.count, 0);
const dupAfter = (await dupReport(colsAfter)).reduce((a, b) => a + b.count, 0);
check("بيانات الاختبار لم تُنتج أي صف يتيم جديد", realAfter === realBefore, `قبل ${realBefore} · بعد الكتابة ${realAfter}`);
check("بيانات الاختبار لم تُنتج أي تكرار جديد", dupAfter === dupBefore, `قبل ${dupBefore} · بعد الكتابة ${dupAfter}`);

/* نسخة احتياطية قبل الحذف ثم الحذف المعزول */
if (KEEP) {
  note("تم تمرير --keep: بيانات الاختبار باقية للمعاينة (لن يُحذف شيء).");
  note("لحذفها لاحقًا: node scripts/live-minitest.mjs --cleanup-only");
} else {
  const { deleted, backup } = await purgeTestData(userIds, pumpIds, "testdata", base);
  check(
    "حُذفت بيانات الاختبار كلها في معاملة واحدة",
    deleted.pumps === pumpIds.length && deleted.users === userIds.length,
    `مضخات ${deleted.pumps}/${pumpIds.length} · حسابات ${deleted.users}/${userIds.length} · تدقيق ${deleted.audit_logs} · سجلات شخصية ${deleted.personal_records} · صفوف كشف ${backup.rows.diala_roster.length}`
  );

  const leftUsers = (await one(`select count(*)::int c from users where id = any($1::uuid[])`, [userIds])).c;
  const leftPumps = (await one(`select count(*)::int c from pumps where id = any($1::uuid[])`, [pumpIds])).c;
  const leftRoster = (await one(`select count(*)::int c from diala_roster where diala_id = $1`, [DIALA_ID])).c;
  check("لا أثر لبيانات الاختبار في القاعدة", leftUsers + leftPumps + leftRoster === 0, `حسابات ${leftUsers} · مضخات ${leftPumps} · صفوف كشف ${leftRoster}`);

  const after = await countAll(before.tables);
  console.log("\n  الجدول | قبل الاختبار | بعد التنظيف | الفرق");
  let drifted = 0;
  for (const t of before.tables) {
    const delta = after[t] - before.counts[t];
    if (delta !== 0) drifted += 1;
    console.log(`  ${t} | ${before.counts[t]} | ${after[t]} | ${delta === 0 ? "0 ✅" : `${delta} ⚠️`}`);
  }
  check(
    "بياناتك الحقيقية لم تُمسّ (كل الجداول عادت إلى عددها قبل الاختبار)",
    drifted === 0,
    drifted === 0 ? `كل الـ${before.tables.length} جدولًا بلا تغيير` : `${drifted} جدولًا تغيّر (راجع الجدول أعلاه)`
  );

  const realFinal = (await orphanReport(colsAfter)).filter((o) => !o.refEmpty).reduce((a, b) => a + b.count, 0);
  const dupFinal = (await dupReport(colsAfter)).reduce((a, b) => a + b.count, 0);
  check(
    "القاعدة بعد التنظيف كما كانت (بلا يتيم ولا تكرار جديد)",
    realFinal === realBefore && dupFinal === dupBefore,
    `يتيم ${realBefore}→${realFinal} · تكرار ${dupBefore}→${dupFinal}`
  );
}

console.log(`\n===== الخلاصة: ${pass} ناجح · ${fail} فاشل =====`);
if (failures.length) {
  console.log("الفحوص الفاشلة:");
  for (const f of failures) console.log(`  ❌ ${f}`);
}
await pool.end();
process.exit(fail === 0 ? 0 : 1);
