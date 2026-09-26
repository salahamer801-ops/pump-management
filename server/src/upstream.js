/**
 * تمرير اختياري لطلبات /api إلى خادم الـAPI المنشور خارجيًا (Railway مثلًا).
 *
 * لماذا التمرير بدل عنوان ثابت في الواجهة؟
 *  - الواجهة تبقى على مسار نسبي /api من نفس الأصل: لا عنوان مكتوب في كود الواجهة،
 *    ولا يتغير شيء عند ربط دومين مخصص لاحقًا.
 *  - لا حاجة إلى CORS في المتصفح إطلاقًا.
 *  - العنوان يُقرأ وقت التشغيل من بيئة الخادم (UPSTREAM_API_BASE) ولا يُخزَّن في الكود
 *    ولا في المستودع ولا في الواجهة، ولا يُطبع في أي رد.
 *
 * يُفعَّل فقط عند ضبط UPSTREAM_API_BASE — وإن لم يكن مضبوطًا فكل شيء يعمل كما هو
 * (التطوير المحلي والمعاينة على الخادم المحلي).
 */
const BASE = String(process.env.UPSTREAM_API_BASE || "").trim().replace(/\/+$/, "");
const TIMEOUT_MS = Math.max(1000, Number(process.env.UPSTREAM_TIMEOUT_MS || 30000));

/** رؤوس لا تُمرَّر (رؤوس اتصال + ما يحسبه fetch/Clients بنفسه) */
const DROP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "accept-encoding",
  "cookie",
]);

export const upstreamEnabled = () => BASE.length > 0;

export function upstreamProxy() {
  if (!upstreamEnabled()) return (_req, _res, next) => next();

  return async function upstreamMiddleware(req, res) {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (DROP_HEADERS.has(key.toLowerCase())) continue;
      if (typeof value === "string") headers[key.toLowerCase()] = value;
    }

    const hasBody = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const upstream = await fetch(`${BASE}${req.originalUrl}`, {
        method: req.method,
        headers,
        body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
        redirect: "manual",
        signal: controller.signal,
      });
      const text = await upstream.text();
      const type = upstream.headers.get("content-type");
      res.status(upstream.status);
      if (type) res.setHeader("Content-Type", type);
      res.send(text);
    } catch (err) {
      const timedOut = err && err.name === "AbortError";
      res.status(timedOut ? 504 : 502).json({
        error: {
          code: timedOut ? "upstream_timeout" : "upstream_unreachable",
          message: timedOut
            ? "الخادم الخارجي تأخّر في الرد — حاول مرة أخرى."
            : "تعذّر الوصول إلى الخادم الخارجي — حاول مرة أخرى.",
        },
      });
    } finally {
      clearTimeout(timer);
    }
  };
}
