/* api/admin/service.js — gestion de la prise de service (admin uniquement)
   GET    ?period=week|month|all  -> classement, services en cours, derniers services
   PATCH  {id} | {all:true}       -> forcer la fin d'un service / de tous les services en cours
   DELETE {id} | {all:true}       -> supprimer un service / remettre toutes les statistiques à zéro */
import { db, discordUser, sendJson } from "../../lib/contact-data.js";

const SERVICE_MAX_HOURS = 12;
let schemaReady;
async function ensureSchema() {
  if (!schemaReady) schemaReady = (async () => {
    const sql = db();
    await sql`CREATE TABLE IF NOT EXISTS prefecture_members (
      id TEXT PRIMARY KEY, name TEXT, avatar TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS prefecture_service (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, avatar TEXT, note TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ended_at TIMESTAMPTZ, ended_by TEXT
    )`;
    await sql`CREATE INDEX IF NOT EXISTS prefecture_service_user_idx ON prefecture_service (user_id, started_at DESC)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS prefecture_service_one_open ON prefecture_service (user_id) WHERE ended_at IS NULL`;
  })().catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

export default async function handler(req, res) {
  const identity = await discordUser(req, true).catch(() => ({ error: "discord_auth_unavailable", status: 502 }));
  if (identity.error) return sendJson(res, identity.status, { error: identity.error });

  try {
    await ensureSchema();
    const sql = db();
    await sql`UPDATE prefecture_service SET ended_at = started_at + make_interval(hours => ${SERVICE_MAX_HOURS}), ended_by = 'auto'
      WHERE ended_at IS NULL AND started_at < NOW() - make_interval(hours => ${SERVICE_MAX_HOURS})`;
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (req.method === "GET") {
      const period = ["week", "month", "all"].includes(req.query?.period) ? req.query.period : "week";
      const board = await sql`SELECT s.user_id, COALESCE(m.name, MAX(s.name)) AS name, m.avatar AS avatar,
          SUM(EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at)))::float AS seconds,
          COUNT(*)::int AS sessions, MAX(COALESCE(s.ended_at, s.started_at)) AS last_seen
        FROM prefecture_service s LEFT JOIN prefecture_members m ON m.id = s.user_id
        WHERE ${period} = 'all' OR s.started_at >= CASE WHEN ${period} = 'week'
          THEN (date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris')
          ELSE (date_trunc('month', NOW() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris') END
        GROUP BY s.user_id, m.name, m.avatar ORDER BY seconds DESC LIMIT 50`;
      const onDuty = await sql`SELECT s.id, s.user_id, COALESCE(m.name, s.name) AS name, m.avatar AS avatar, s.note, s.started_at,
          EXTRACT(EPOCH FROM (NOW() - s.started_at))::float AS seconds
        FROM prefecture_service s LEFT JOIN prefecture_members m ON m.id = s.user_id
        WHERE s.ended_at IS NULL ORDER BY s.started_at`;
      const recent = await sql`SELECT s.id, s.user_id, COALESCE(m.name, s.name) AS name, m.avatar AS avatar, s.started_at, s.ended_at, s.ended_by,
          EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))::float AS seconds
        FROM prefecture_service s LEFT JOIN prefecture_members m ON m.id = s.user_id
        ORDER BY s.started_at DESC LIMIT 30`;
      const num = (r) => ({ ...r, seconds: Number(r.seconds) });
      const b = board.map(num);
      return sendJson(res, 200, {
        period, board: b, on_duty: onDuty.map(num), recent: recent.map(num),
        totals: { seconds: b.reduce((n, r) => n + r.seconds, 0), sessions: b.reduce((n, r) => n + r.sessions, 0), agents: b.length },
      });
    }

    if (req.method === "PATCH") {
      if (body.all) {
        const closed = await sql`UPDATE prefecture_service SET ended_at = NOW(), ended_by = 'admin' WHERE ended_at IS NULL RETURNING id`;
        return sendJson(res, 200, { closed: closed.length });
      }
      const id = String(body.id || "");
      if (!id) return sendJson(res, 400, { error: "missing_id" });
      const done = await sql`UPDATE prefecture_service SET ended_at = NOW(), ended_by = 'admin' WHERE id = ${id} AND ended_at IS NULL RETURNING id`;
      if (!done.length) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE") {
      if (body.all) {
        const gone = await sql`DELETE FROM prefecture_service RETURNING id`;
        return sendJson(res, 200, { deleted: gone.length });
      }
      const id = String(body.id || "");
      if (!id) return sendJson(res, 400, { error: "missing_id" });
      const gone = await sql`DELETE FROM prefecture_service WHERE id = ${id} RETURNING id`;
      if (!gone.length) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, PATCH, DELETE");
    return sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    console.error("Prefecture service admin failed:", error?.message || error);
    if (error?.message === "database_not_configured") return sendJson(res, 503, { error: "database_not_configured" });
    return sendJson(res, 500, { error: "service_unavailable" });
  }
}
