/* lib/vigipirate-handler.js — niveau du plan Vigipirate (appelé par api/prefecture.js, module « vigipirate »)
   Appel : /api/prefecture?module=vigipirate
     GET  (public)  -> { level, updated_at, message, history:[{ level, previous, at, message }] }
                       Les noms des agents (updated_by / by) ne sont renvoyés qu'aux agents connectés (Staff ou Préfectoral).
     POST (Staff ou rôle Préfectoral)  { level: 1 | 2 | 3, message?: string }  -> même objet, niveau mis à jour
   Chaque changement est enregistré dans l'historique ; les pages « Actualités » et l'accueil en font automatiquement une actualité.
   Placé dans lib/ et routé depuis api/prefecture.js pour ne pas ajouter de fonction Vercel (limite de 12 sur le plan Hobby).
   Rôles : Staff (ADMIN_ROLE_ID) ou Préfectoral (variable Vercel PREFECTURE_ROLE_ID). */
import { db, discordUser, sendJson, ADMIN_ROLE_ID } from "./contact-data.js";

const PREFECTURE_ROLE_ID = process.env.PREFECTURE_ROLE_ID || "";
const DEFAULT_LEVEL = 1;      // niveau affiché tant qu'aucun changement n'a été enregistré (Vigilance)
const HISTORY_LIMIT = 50;
const MESSAGE_MAX = 500;

let schemaReady;
async function ensureSchema() {
  if (!schemaReady) schemaReady = (async () => {
    const sql = db();
    await sql`CREATE TABLE IF NOT EXISTS vigipirate_log (
      id TEXT PRIMARY KEY, level INT NOT NULL, previous INT, message TEXT,
      author TEXT, author_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS vigipirate_log_created_idx ON vigipirate_log (created_at DESC)`;
  })().catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

const isAgent = (identity) => {
  const roles = identity?.member?.roles || [];
  return roles.includes(ADMIN_ROLE_ID) || (PREFECTURE_ROLE_ID !== "" && roles.includes(PREFECTURE_ROLE_ID));
};

async function readState(sql, withAuthors) {
  const rows = await sql`SELECT id, level, previous, message, author, created_at
    FROM vigipirate_log ORDER BY created_at DESC LIMIT ${HISTORY_LIMIT}`;
  const last = rows[0];
  const entry = (r) => ({
    level: Number(r.level), previous: r.previous == null ? null : Number(r.previous),
    at: r.created_at, message: r.message || "",
    ...(withAuthors ? { by: r.author || "" } : {}),
  });
  return {
    level: last ? Number(last.level) : DEFAULT_LEVEL,
    updated_at: last ? last.created_at : null,
    message: last?.message || "",
    ...(withAuthors ? { updated_by: last?.author || "" } : {}),
    history: rows.map(entry),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  try {
    /* Identité : obligatoire pour modifier ; facultative en lecture (sert uniquement à afficher les noms aux agents) */
    let identity = null;
    if (req.method === "POST" || req.headers?.authorization) {
      identity = await discordUser(req).catch(() => ({ error: "discord_auth_unavailable", status: 502 }));
      if (req.method === "POST") {
        if (identity.error) return sendJson(res, identity.status || 401, { error: identity.error });
        if (!isAgent(identity)) return sendJson(res, 403, { error: "role_required" });
      }
    }
    const agent = !!identity && !identity.error && isAgent(identity);

    await ensureSchema();
    const sql = db();

    if (req.method === "GET") {
      const state = await readState(sql, agent);
      /* lecture publique : cache court côté CDN pour ne pas solliciter la base à chaque visite */
      res.setHeader("Cache-Control", agent ? "no-store" : "public, max-age=0, s-maxage=10, stale-while-revalidate=50");
      return sendJson(res, 200, state);
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const level = Number(body.level);
    if (!Number.isInteger(level) || level < 1 || level > 3) return sendJson(res, 400, { error: "invalid_level" });
    const message = String(body.message ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, MESSAGE_MAX);

    const { user, member } = identity;
    const nick = member?.nick || user.global_name || user.username;
    const current = (await sql`SELECT level FROM vigipirate_log ORDER BY created_at DESC LIMIT 1`)[0];
    const previous = current ? Number(current.level) : DEFAULT_LEVEL;
    if (level === previous) return sendJson(res, 409, { error: "same_level" });

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await sql`INSERT INTO vigipirate_log (id, level, previous, message, author, author_id)
      VALUES (${id}, ${level}, ${previous}, ${message}, ${nick}, ${user.id})`;

    res.setHeader("Cache-Control", "no-store");
    return sendJson(res, 201, await readState(sql, true));
  } catch (error) {
    console.error("Vigipirate operation failed:", error?.message || error);
    if (error?.message === "database_not_configured") return sendJson(res, 503, { error: "database_not_configured" });
    return sendJson(res, 500, { error: "vigipirate_unavailable" });
  }
}
