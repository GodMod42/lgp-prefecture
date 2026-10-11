/* api/prefecture.js — API du panel préfectoral
   Appel : /api/prefecture?module=annonce  (GET, POST, PATCH, DELETE)
   Réutilise lib/contact-data.js (base Neon + vérification Discord).
   Accès : rôle Staff (ADMIN_ROLE_ID) ou rôle Préfectoral (variable Vercel PREFECTURE_ROLE_ID). */
import { db, discordUser, sendJson, ADMIN_ROLE_ID, GUILD_ID } from "../lib/contact-data.js";

const PREFECTURE_ROLE_ID = process.env.PREFECTURE_ROLE_ID || "";

const FIELDS = {
  annonce: ["objet", "importance", "portee", "texte"],
  reunion: ["objet", "quand", "lieu", "odj"],
  discussion: ["texte", "salon"],
  rdv: ["avec", "quand", "objet", "statut"],
  dossier: ["ref", "intitule", "resp", "statut", "suivi"],
  document: ["intitule", "type", "lien"],
  notes: ["sujet", "texte"],
  tenues: ["nom", "grade", "lien", "detail"],
  absence: ["agent", "du", "au", "motif"],
  annuaire: ["nom", "grade", "tel", "discord"],
};

let schemaReady;
async function ensureSchema() {
  if (!schemaReady) schemaReady = (async () => {
    const sql = db();
    await sql`CREATE TABLE IF NOT EXISTS prefecture_items (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      author TEXT,
      author_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS prefecture_members (
      id TEXT PRIMARY KEY,
      name TEXT,
      avatar TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS prefecture_items_module_idx ON prefecture_items (module, created_at DESC)`;
  })().catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

const clean = (mod, src) => {
  const out = {};
  for (const k of FIELDS[mod])
    if (typeof src[k] === "string" && src[k].trim()) out[k] = src[k].trim().slice(0, 4000);
  return out;
};

export default async function handler(req, res) {
  const mod = String(req.query?.module || "");
  if (!Object.hasOwn(FIELDS, mod)) return sendJson(res, 400, { error: "unknown_module" });

  const identity = await discordUser(req).catch(() => ({ error: "discord_auth_unavailable", status: 502 }));
  if (identity.error) return sendJson(res, identity.status, { error: identity.error });

  const roles = identity.member?.roles || [];
  const staff = roles.includes(ADMIN_ROLE_ID);
  if (!staff && !(PREFECTURE_ROLE_ID && roles.includes(PREFECTURE_ROLE_ID)))
    return sendJson(res, 403, { error: "role_required" });

  try {
    await ensureSchema();
    const sql = db();
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { user, member } = identity;
    const nick = member?.nick || user.global_name || user.username;
    const avatar = member?.avatar
      ? `https://cdn.discordapp.com/guilds/${GUILD_ID}/users/${user.id}/avatars/${member.avatar}.png?size=64`
      : user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : "";
    const row = (r) => ({
      ...r.data, id: r.id, author: r.m_name || r.author, author_id: r.author_id,
      avatar: r.m_avatar || "", mine: r.author_id === user.id, created_at: r.created_at,
    });
    /* garde à jour le surnom et l'avatar affichés pour cet agent */
    if (req.method === "GET" || req.method === "POST")
      await sql`INSERT INTO prefecture_members (id, name, avatar, updated_at) VALUES (${user.id}, ${nick}, ${avatar}, NOW())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, avatar = EXCLUDED.avatar, updated_at = NOW()`;

    if (req.method === "GET") {
      const rows = await sql`SELECT i.*, m.name AS m_name, m.avatar AS m_avatar
        FROM prefecture_items i LEFT JOIN prefecture_members m ON m.id = i.author_id
        WHERE i.module = ${mod} ORDER BY i.created_at DESC LIMIT 500`;
      return sendJson(res, 200, rows.map(row));
    }

    if (req.method === "POST") {
      const data = clean(mod, body);
      if (!Object.keys(data).length) return sendJson(res, 400, { error: "empty" });
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await sql`INSERT INTO prefecture_items (id, module, data, author, author_id)
        VALUES (${id}, ${mod}, ${JSON.stringify(data)}::jsonb, ${nick}, ${user.id})`;
      const created = await sql`SELECT i.*, m.name AS m_name, m.avatar AS m_avatar
        FROM prefecture_items i LEFT JOIN prefecture_members m ON m.id = i.author_id WHERE i.id = ${id}`;
      return sendJson(res, 201, row(created[0]));
    }

    if (req.method === "PATCH") {
      const id = String(body.id || "");
      const statut = typeof body.statut === "string" ? body.statut.trim().slice(0, 40) : "";
      if (!id || !statut || !FIELDS[mod].includes("statut")) return sendJson(res, 400, { error: "nothing_to_update" });
      const updated = await sql`UPDATE prefecture_items SET data = data || ${JSON.stringify({ statut })}::jsonb
        WHERE id = ${id} AND module = ${mod} RETURNING id`;
      if (!updated.length) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "DELETE") {
      const id = String(body.id || "");
      if (!id) return sendJson(res, 400, { error: "missing_id" });
      if (mod === "discussion" && !staff) {
        const found = await sql`SELECT author_id FROM prefecture_items WHERE id = ${id} AND module = ${mod}`;
        if (found.length && found[0].author_id !== user.id) return sendJson(res, 403, { error: "forbidden" });
      }
      const deleted = await sql`DELETE FROM prefecture_items WHERE id = ${id} AND module = ${mod} RETURNING id`;
      if (!deleted.length) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    console.error("Prefecture panel operation failed:", error?.message || error);
    if (error?.message === "database_not_configured") return sendJson(res, 503, { error: "database_not_configured" });
    return sendJson(res, 500, { error: "prefecture_unavailable" });
  }
}