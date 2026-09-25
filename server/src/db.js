/**
 * الاتصال بقاعدة البيانات (PostgreSQL) + المخطّط.
 * القاعدة: كل شيء يُنشأ بـ IF NOT EXISTS — لا حذف ولا فقدان بيانات.
 */
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("[db] DATABASE_URL غير موجود في بيئة التشغيل");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
});

// قاعدة البيانات قد تكون نائمة (تُوقَظ عند أول طلب) — لا نُسقط العملية بسبب خطأ اتصال
pool.on("error", (err) => {
  console.error("[db] خطأ في الاتصال الخامل:", err.message);
});

function isConnectionError(err) {
  const code = err && err.code;
  return (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    code === "57P01" ||
    code === "57P03" ||
    code === "08006" ||
    code === "08001" ||
    /Connection terminated|timeout|socket hang up/i.test(String((err && err.message) || ""))
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** استعلام واحد مع إعادة محاولة واحدة عند انقطاع الاتصال (قاعدة نائمة) */
export async function q(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    await sleep(400);
    return pool.query(text, params);
  }
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(async (text, params = []) => client.query(text, params));
    await client.query("COMMIT");
    return out;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('manager','user')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS pumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  manager_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pumps_manager_idx ON pumps(manager_id);

CREATE TABLE IF NOT EXISTS pump_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pump_id uuid NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_type text NOT NULL DEFAULT 'viewer'
    CHECK (membership_type IN ('shareholder','rightHolder','actualUser','viewer','accountant','pumpOperator')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','removed')),
  person_id text,
  person_name text NOT NULL DEFAULT '',
  share_ref text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  reject_reason text NOT NULL DEFAULT '',
  removed_at timestamptz,
  removed_by uuid,
  remove_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pump_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_pump_idx ON pump_memberships(pump_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON pump_memberships(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  source text NOT NULL DEFAULT 'web'
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text NOT NULL DEFAULT '',
  actor_role text NOT NULL DEFAULT 'system',
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  pump_id uuid,
  source text NOT NULL DEFAULT 'api',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_pump_idx ON audit_logs(pump_id);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_logs(actor_id);
`;

let ready = null;

/** يهيّئ المخطّط — يعيد المحاولة إن كانت القاعدة نائمة */
export function initSchema(retries = 12) {
  if (ready) return ready;
  ready = (async () => {
    let lastErr = null;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        await q(SCHEMA);
        return true;
      } catch (err) {
        lastErr = err;
        console.error(`[db] فشل تهيئة المخطّط (محاولة ${attempt}):`, err.message);
        await sleep(Math.min(1000 * attempt, 5000));
      }
    }
    ready = null;
    throw lastErr;
  })();
  return ready;
}
