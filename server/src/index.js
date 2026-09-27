/**
 * خادم واجهة البرمجة (API) لنظام تنظيم المضخات.
 * المصادقة والتصريح هنا — لا في الواجهة.
 */
import express from "express";
import { appendFileSync } from "node:fs";
import { initSchema, pool, q } from "./db.js";
import { HttpError, wrap } from "./http.js";
import { authRouter } from "./routes/auth.js";
import { auditRouter, pumpsRouter } from "./routes/pumps.js";
import { adminRouter } from "./routes/admin.js";
import { operatingRouter } from "./routes/operating.js";
import { getSettings } from "./settings.js";
import { upstreamEnabled, upstreamProxy } from "./upstream.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "256kb" }));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  next();
});

/* --------------------------- CORS (اختياري) ---------------------------
 * الواجهة تصل عبر مسار نسبي /api من نفس الأصل، فلا حاجة إلى CORS أصلًا.
 * عند نشر الواجهة على أصل مختلف (مثل Cloudflare Pages) يكفي ضبط CORS_ORIGIN
 * في بيئة الخادم — ولا تُكتب عناوين ثابتة في الكود. لا يُستخدم "*" أبدًا. */
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const allowOrigins = [
  process.env.CORS_ORIGIN,
  process.env.EXTRA_CORS_ORIGINS,
  process.env.MYTHEX_WEB_ORIGIN,
]
  .filter(Boolean)
  .flatMap((raw) => String(raw).split(","))
  .map((item) => item.trim().replace(/\/+$/, ""))
  .filter((item) => item && item !== "*");

app.use((req, res, next) => {
  const origin = String(req.headers.origin ?? "").replace(/\/+$/, "");
  const allowed = Boolean(origin) && (allowOrigins.includes(origin) || (process.env.NODE_ENV !== "production" && DEV_ORIGIN.test(origin)));
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS" && allowOrigins.length > 0) return res.sendStatus(204);
  next();
});

app.get(["/health", "/api/health"], (_req, res) => res.json({ ok: true, service: "pump-api" }));

/* فحص اتصال قاعدة البيانات — عام مثل /health (لا يكشف أي بيانات، فقط وقت الخادم) */
app.get(
  "/api/health/db",
  wrap(async (_req, res) => {
    const r = await q("SELECT now() AS now");
    res.json({ ok: true, db: r.rows[0].now });
  })
);

/* تمرير بقية مسارات /api إلى الخادم المنشور خارجيًا عند ضبط UPSTREAM_API_BASE.
 * فحوصات الصحة أعلاه (/health و/api/health و/api/health/db) تبقى محلية حتى يظل
 * رصد المنصة لخدمة هذا المشروع دقيقًا. بلا ضبط المتغير: لا يتغير أي شيء. */
app.use("/api", upstreamProxy());

/* إعدادات عامة لشاشة الدخول (الإعلان وفتح التسجيل) — بلا بيانات شخصية */
app.get(
  "/api/settings/public",
  wrap(async (_req, res) => res.json(await getSettings()))
);

app.use("/api/auth", authRouter);
app.use("/api/pumps", pumpsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/admin", adminRouter);
/* بيانات التشغيل الرسمية (المرحلة الثانية) — نفس الخادم ونفس قاعدة البيانات */
app.use("/api", operatingRouter);

app.use((_req, res) => res.status(404).json({ error: { code: "not_found", message: "المسار غير موجود." } }));

app.use((err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  const code = err instanceof HttpError ? err.code : "server_error";
  const message =
    err instanceof HttpError ? err.message : "حدث خطأ غير متوقع في الخادم — حاول مرة أخرى.";
  if (status >= 500) { console.error("[api]", err); try { appendFileSync("/tmp/api-error.log", `${new Date().toISOString()}\n${err?.message}\n${String(err?.stack).split("\n").slice(0,5).join("\n")}\n---\n`); } catch {} }
  res.status(status).json({ error: { code, message } });
});

const server = app.listen(PORT, "0.0.0.0", () =>
  console.log(`[api] يعمل على المنفذ ${PORT}${upstreamEnabled() ? " · /api يُمرَّر إلى خادم خارجي" : ""}`)
);

/* إغلاق نظيف عند إيقاف الاستضافة: نتوقف عن قبول الطلبات ثم نغلق اتصالات قاعدة البيانات */
let closing = false;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    console.log(`[api] إشارة ${signal} — إغلاق نظيف`);
    server.close(() => {
      pool
        .end()
        .catch((err) => console.error("[db] تعذّر إغلاق الاتصالات:", err.message))
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}

async function start() {
  try {
    await initSchema();
    console.log("[api] المخطّط جاهز");
  } catch (err) {
    console.error("[api] تعذّر تهيئة المخطّط:", err.message);
  }
}

start();
