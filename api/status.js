/* api/status.js — surveillance et historique des services du site
   GET /api/status          (public) -> état courant, disponibilité sur 90 jours par service, temps de réponse de l'API, incidents des 14 derniers jours
   GET /api/status?run=1    (public) -> lance une vérification complète si la dernière date de plus de 4 minutes, puis renvoie la même chose
   Les vérifications sont faites côté serveur et enregistrées dans la table status_checks (créée automatiquement).
   Pour une surveillance continue, appelez /api/status?run=1 toutes les 5 minutes (cron-job.org, UptimeRobot ou une tâche cron Vercel) ;
   sans cela, une vérification est lancée à chaque ouverture de la page de statut (au plus une toutes les 4 minutes).
   Variables facultatives : SITE_ORIGIN (défaut https://lgp-prefecture.vercel.app), DISCORD_INVITE. */
import { db, sendJson } from "../lib/contact-data.js";

const ORIGIN = (process.env.SITE_ORIGIN || "https://lgp-prefecture.vercel.app").replace(/\/+$/, "");
const DISCORD_INVITE = process.env.DISCORD_INVITE || "8RAFH7KfDj";
const RUN_EVERY_MS = 4 * 60 * 1000;
const TIMEOUT = 6000;     // reste sous la limite de durée d'une fonction Vercel
const SLOW = 2500;
const DAYS = 90;
const INCIDENT_DAYS = 14;

const timed = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { "user-agent": "LGP-StatusBot/1.0", "cache-control": "no-cache" } });
    return { r, ms: Date.now() - t0 };
  } finally { clearTimeout(timer); }
};
const speed = (state, ms) => (state === "ok" && ms > SLOW ? "slow" : state);
const failure = (e) => ({ state: "down", ms: null, detail: e?.name === "AbortError" ? "Délai dépassé" : "Injoignable" });

/* toute réponse sans erreur 5xx/404 prouve que la fonction est en ligne (401/405 attendus sans connexion) */
const apiCheck = (path) => async () => {
  try {
    const { r, ms } = await timed(ORIGIN + path);
    if (r.status >= 500) return { state: "down", ms, detail: "Erreur " + r.status };
    if (r.status === 404) return { state: "down", ms, detail: "Service introuvable (404)" };
    return { state: speed("ok", ms), ms, detail: "" };
  } catch (e) { return failure(e); }
};

const SERVICES = [
  { id: "site", name: "Site web de la Préfecture", api: false, check: async () => {
      try {
        const { r, ms } = await timed(ORIGIN + "/content.json");
        if (!r.ok) return { state: "down", ms, detail: "Erreur " + r.status };
        await r.json();
        return { state: speed("ok", ms), ms, detail: "" };
      } catch (e) { return failure(e); }
    } },
  { id: "discordServer", name: "Serveur Discord de la Préfecture", api: false, check: async () => {
      try {
        const { r, ms } = await timed(`https://discord.com/api/v9/invites/${DISCORD_INVITE}?with_counts=true`);
        if (r.status >= 500) return { state: "down", ms, detail: "Erreur " + r.status };
        if (!r.ok) return { state: "unknown", ms, detail: "Réponse " + r.status };
        const d = await r.json();
        if (d.approximate_member_count == null) return { state: "unknown", ms, detail: "Réponse inattendue" };
        return { state: speed("ok", ms), ms, detail: "" };
      } catch (e) { return { state: "unknown", ms: null, detail: "Vérification impossible" }; }
    } },
  { id: "discordPlatform", name: "Plateforme Discord", api: false, check: async () => {
      try {
        const { r, ms } = await timed("https://discordstatus.com/api/v2/status.json");
        if (!r.ok) return { state: "unknown", ms, detail: "Réponse " + r.status };
        const d = await r.json();
        const i = d?.status?.indicator;
        if (i === "none") return { state: speed("ok", ms), ms, detail: "" };
        if (i === "minor") return { state: "slow", ms, detail: String(d.status.description || "").slice(0, 120) };
        return { state: "down", ms, detail: String(d?.status?.description || "Incident majeur").slice(0, 120) };
      } catch (e) { return { state: "unknown", ms: null, detail: "Vérification impossible" }; }
    } },
  { id: "contact", name: "Démarches en ligne (API)", api: true, check: apiCheck("/api/contact") },
  { id: "prefecture", name: "Espace Préfecture (API)", api: true, check: apiCheck("/api/prefecture?module=ping") },
  { id: "tickets", name: "Tickets (API)", api: true, check: apiCheck("/api/admin/tickets") },
  { id: "finances", name: "Finances (API)", api: true, check: apiCheck("/api/admin/finances") },
  { id: "vigipirate", name: "Plan Vigipirate (API)", api: true, check: async () => {
      try {
        const { r, ms } = await timed(ORIGIN + "/api/vigipirate");
        if (r.status >= 500) return { state: "down", ms, detail: "Erreur " + r.status };
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.level) return { state: "down", ms, detail: "Réponse invalide" };
        return { state: speed("ok", ms), ms, detail: "" };
      } catch (e) { return failure(e); }
    } },
  { id: "db", name: "Base de données", api: false, check: async () => {
      const t0 = Date.now();
      try {
        await db()`SELECT 1`;
        const ms = Date.now() - t0;
        return { state: speed("ok", ms), ms, detail: "" };
      } catch (e) { return { state: "down", ms: Date.now() - t0, detail: "Base de données injoignable" }; }
    } },
];
const NAMES = Object.fromEntries(SERVICES.map((s) => [s.id, s.name]));

let schemaReady;
async function ensureSchema() {
  if (!schemaReady) schemaReady = (async () => {
    const sql = db();
    await sql`CREATE TABLE IF NOT EXISTS status_checks (
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(), service TEXT NOT NULL, state TEXT NOT NULL, ms INT, detail TEXT
    )`;
    await sql`CREATE INDEX IF NOT EXISTS status_checks_service_ts_idx ON status_checks (service, ts DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS status_checks_ts_idx ON status_checks (ts DESC)`;
  })().catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

/* Une vérification complète, au plus toutes les RUN_EVERY_MS, quel que soit le nombre de visiteurs ou d'appels */
async function runChecks(sql) {
  const last = (await sql`SELECT MAX(ts) AS ts FROM status_checks`)[0]?.ts;
  if (last && Date.now() - new Date(last).getTime() < RUN_EVERY_MS) return false;
  const results = await Promise.all(SERVICES.map(async (s) => ({
    id: s.id,
    ...(await s.check().catch(() => ({ state: "unknown", ms: null, detail: "Erreur de vérification" }))),
  })));
  await Promise.all(results.map((r) =>
    sql`INSERT INTO status_checks (service, state, ms, detail) VALUES (${r.id}, ${r.state}, ${r.ms}, ${r.detail || ""})`));
  if (Math.random() < 0.02) await sql`DELETE FROM status_checks WHERE ts < NOW() - INTERVAL '100 days'`;
  return true;
}

/* liste des 90 derniers jours (dates AAAA-MM-JJ, heure de Paris), du plus ancien au plus récent */
function lastDays() {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const base = new Date(today + "T12:00:00Z").getTime();
  return Array.from({ length: DAYS }, (_, i) => new Date(base - (DAYS - 1 - i) * 86400000).toISOString().slice(0, 10));
}

const metric = (sql, hours, bucket) => sql`
  SELECT to_timestamp(FLOOR(EXTRACT(EPOCH FROM ts) / ${bucket}::int) * ${bucket}::int) AS t, ROUND(AVG(ms))::int AS ms
  FROM status_checks
  WHERE service IN ('contact','prefecture','tickets','finances','vigipirate')
    AND state IN ('ok','slow') AND ms IS NOT NULL AND ts > NOW() - make_interval(hours => ${hours}::int)
  GROUP BY 1 ORDER BY 1`;

async function readHistory(sql) {
  const [daily, current, lastRun, day, week, month, runs] = await Promise.all([
    sql`SELECT service, ((ts AT TIME ZONE 'Europe/Paris')::date)::text AS d,
          (COUNT(*) FILTER (WHERE state = 'ok'))::int AS ok,
          (COUNT(*) FILTER (WHERE state = 'slow'))::int AS slow,
          (COUNT(*) FILTER (WHERE state = 'down'))::int AS down
        FROM status_checks WHERE ts > NOW() - INTERVAL '91 days' AND state <> 'unknown' GROUP BY 1, 2`,
    sql`SELECT DISTINCT ON (service) service, state, ms, detail, ts FROM status_checks ORDER BY service, ts DESC`,
    sql`SELECT MAX(ts) AS ts FROM status_checks`,
    metric(sql, 24, 900),          // jour : points de 15 minutes
    metric(sql, 24 * 7, 7200),     // semaine : points de 2 heures
    metric(sql, 24 * 30, 43200),   // mois : points de 12 heures
    /* incidents : séries d'au moins 2 vérifications consécutives en échec ; résolu au premier retour à la normale */
    sql`WITH s AS (
          SELECT service, ts, state, (state = 'down') AS d FROM status_checks
          WHERE ts > NOW() - make_interval(days => ${INCIDENT_DAYS}::int) AND state <> 'unknown'
        ), g AS (
          SELECT service, ts, d, SUM(CASE WHEN d THEN 0 ELSE 1 END) OVER (PARTITION BY service ORDER BY ts) AS grp FROM s
        ), runs AS (
          SELECT service, grp, MIN(ts) AS started_at, MAX(ts) AS last_down, COUNT(*)::int AS n
          FROM g WHERE d GROUP BY service, grp HAVING COUNT(*) >= 2
        )
        SELECT r.service, r.started_at, r.n,
               (SELECT MIN(s2.ts) FROM s s2 WHERE s2.service = r.service AND s2.ts > r.last_down AND s2.state <> 'down') AS resolved_at
        FROM runs r ORDER BY r.started_at DESC`,
  ]);

  const dates = lastDays();
  const byService = {};
  for (const r of daily) (byService[r.service] ||= {})[r.d] = r;
  const cur = Object.fromEntries(current.map((r) => [r.service, r]));

  const services = {};
  for (const s of SERVICES) {
    const rows = byService[s.id] || {};
    let up = 0, total = 0;
    const days = dates.map((d) => {
      const r = rows[d] || { ok: 0, slow: 0, down: 0 };
      up += r.ok + r.slow; total += r.ok + r.slow + r.down;
      return { d, ok: r.ok, slow: r.slow, down: r.down };
    });
    const c = cur[s.id];
    services[s.id] = {
      name: s.name,
      uptime: total ? Math.round((up / total) * 10000) / 100 : null,
      current: c ? { state: c.state, ms: c.ms, detail: c.detail || "", ts: c.ts } : null,
      days,
    };
  }
  return {
    last_run: lastRun[0]?.ts || null,
    every_minutes: RUN_EVERY_MS / 60000,
    services,
    metrics: {
      day: day.map((p) => ({ t: p.t, ms: p.ms })),
      week: week.map((p) => ({ t: p.t, ms: p.ms })),
      month: month.map((p) => ({ t: p.t, ms: p.ms })),
    },
    incidents: runs.map((r) => ({
      service: r.service, name: NAMES[r.service] || r.service,
      started_at: r.started_at, resolved_at: r.resolved_at || null, checks: r.n, ongoing: !r.resolved_at,
    })),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  try {
    await ensureSchema();
    const sql = db();
    const wantRun = new URL(req.url, "http://localhost").searchParams.get("run") === "1";
    const ran = wantRun ? await runChecks(sql) : false;
    const payload = await readHistory(sql);
    res.setHeader("Cache-Control", wantRun ? "no-store" : "public, max-age=0, s-maxage=30, stale-while-revalidate=120");
    return sendJson(res, 200, { ...payload, ran });
  } catch (error) {
    console.error("Status operation failed:", error?.message || error);
    if (error?.message === "database_not_configured") return sendJson(res, 503, { error: "database_not_configured" });
    return sendJson(res, 500, { error: "status_unavailable" });
  }
}
