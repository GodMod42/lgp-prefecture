/* api/prefecture.js — API du panel préfectoral
   Appel : /api/prefecture?module=annonce   (GET, POST, PATCH, DELETE)
           /api/prefecture?module=service   (GET, POST {action:"start"|"stop"})
           /api/prefecture?module=service_admin&period=week|month|all  (Staff uniquement : classement, gestion)
   Réutilise lib/contact-data.js (base Neon + vérification Discord).
   Accès : rôle Staff (ADMIN_ROLE_ID) ou rôle Préfectoral (variable Vercel PREFECTURE_ROLE_ID).

   Webhooks Discord (variables Vercel). Seuls ces 4 modules sont envoyés sur Discord :
     DISCORD_WEBHOOK_PREF_ANNONCE · DISCORD_WEBHOOK_PREF_REUNION
     DISCORD_WEBHOOK_PREF_RDV     · DISCORD_WEBHOOK_PREF_ABSENCE */
import { db, discordUser, sendJson, ADMIN_ROLE_ID, GUILD_ID } from "../lib/contact-data.js";
import vigipirateHandler from "../lib/vigipirate-handler.js";
import statusHandler from "../lib/status-handler.js";

const PREFECTURE_ROLE_ID = process.env.PREFECTURE_ROLE_ID || "";

/* ===== Apparence des messages Discord (modifiable) ===== */
const EMBED_IMAGE_URL = "";       // grande image en bas du message (https://…) — laisser vide = aucune
const EMBED_THUMBNAIL_URL = "";   // miniature en haut à droite (https://…) — laisser vide = aucune
const WEBHOOK_NAME = "Préfecture — Panel préfectoral";
const WEBHOOKS = {
  annonce: "DISCORD_WEBHOOK_PREF_ANNONCE",
  reunion: "DISCORD_WEBHOOK_PREF_REUNION",
  rdv: "DISCORD_WEBHOOK_PREF_RDV",
  absence: "DISCORD_WEBHOOK_PREF_ABSENCE",
};

const SERVICE_MAX_HOURS = 12;   // un service oublié est clôturé automatiquement après cette durée

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
      id TEXT PRIMARY KEY, module TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}'::jsonb,
      author TEXT, author_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS prefecture_members (
      id TEXT PRIMARY KEY, name TEXT, avatar TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS prefecture_service (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, avatar TEXT, note TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ended_at TIMESTAMPTZ, ended_by TEXT
    )`;
    await sql`CREATE INDEX IF NOT EXISTS prefecture_items_module_idx ON prefecture_items (module, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS prefecture_service_user_idx ON prefecture_service (user_id, started_at DESC)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS prefecture_service_one_open ON prefecture_service (user_id) WHERE ended_at IS NULL`;
  })().catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

const clean = (mod, src) => {
  const out = {};
  for (const k of FIELDS[mod])
    if (typeof src[k] === "string" && src[k].trim()) out[k] = src[k].trim().slice(0, 4000);
  return out;
};
const cut = (v, n) => String(v ?? "").slice(0, n);

/* "2026-10-14T18:30" (heure de Paris) -> timestamp Unix, pour les dates dynamiques Discord */
function parisToUnix(str) {
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(str || "");
  if (!m) return null;
  const [Y, Mo, D, H, Mi] = m.slice(1).map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, H, Mi);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asParis = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.floor((guess - (asParis - guess)) / 1000);
}
const ts = (str, style) => { const t = parisToUnix(str); return t ? `<t:${t}:${style}>` : cut(str, 60) || "—"; };

/* ===== Messages Discord ===== */
function buildEmbed(mod, d, nick, avatar) {
  const base = {
    footer: { text: cut(`Publié par ${nick} · Préfecture de Police`, 2048), ...(avatar ? { icon_url: avatar } : {}) },
    timestamp: new Date().toISOString(),
    ...(EMBED_THUMBNAIL_URL ? { thumbnail: { url: EMBED_THUMBNAIL_URL } } : {}),
    ...(EMBED_IMAGE_URL ? { image: { url: EMBED_IMAGE_URL } } : {}),
  };
  if (mod === "annonce") {
    const niveau = d.importance || "Information";
    return { ...base, color: { Urgent: 0xce0500, Important: 0xb34000 }[niveau] || 0x000091,
      author: { name: cut(`Annonce officielle · ${niveau}`, 256) }, title: cut(d.objet, 256), description: cut(d.texte, 4000),
      fields: [{ name: "Destinataires", value: cut(d.portee || "Tous les agents", 1024), inline: true }, { name: "Niveau", value: niveau, inline: true }] };
  }
  if (mod === "reunion") {
    const odj = String(d.odj || "").split("\n").map((l) => l.replace(/^[-•*\s]+/, "").trim()).filter(Boolean).map((l) => `• ${l}`).join("\n");
    return { ...base, color: 0x6a6af4, author: { name: "Convocation à une réunion" }, title: cut(d.objet, 256),
      fields: [
        { name: "Date et heure", value: `${ts(d.quand, "F")}\n${ts(d.quand, "R")}`, inline: true },
        { name: "Lieu", value: cut(d.lieu || "—", 1024), inline: true },
        ...(odj ? [{ name: "Ordre du jour", value: cut(odj, 1024) }] : []),
      ] };
  }
  if (mod === "rdv") {
    return { ...base, color: 0x18753c, author: { name: "Rendez-vous" }, title: cut(`Rendez-vous avec ${d.avec}`, 256),
      fields: [
        { name: "Date et heure", value: `${ts(d.quand, "F")}\n${ts(d.quand, "R")}`, inline: true },
        { name: "Statut", value: cut(d.statut || "À confirmer", 100), inline: true },
        ...(d.objet ? [{ name: "Objet", value: cut(d.objet, 1024) }] : []),
      ] };
  }
  const jours = Math.round((Date.parse(d.au) - Date.parse(d.du)) / 864e5) + 1;
  return { ...base, color: 0x666666, author: { name: "Absence déclarée" }, title: cut(d.agent, 256),
    fields: [
      { name: "Période", value: `Du ${ts(`${d.du}T00:00`, "D")} au ${ts(`${d.au}T00:00`, "D")}`, inline: true },
      ...(jours > 0 ? [{ name: "Durée", value: `${jours} jour${jours > 1 ? "s" : ""}`, inline: true }] : []),
      ...(d.motif ? [{ name: "Motif", value: cut(d.motif, 1024) }] : []),
    ] };
}

/* true = envoyé · false = échec · null = webhook non configuré */
async function relay(mod, data, nick, avatar) {
  const url = process.env[WEBHOOKS[mod]];
  if (!url) return null;
  if (!/^https:\/\/discord\.com\/api\/webhooks\//.test(url)) return false;
  try {
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(7000),
      body: JSON.stringify({ username: WEBHOOK_NAME, allowed_mentions: { parse: [] }, embeds: [buildEmbed(mod, data, nick, avatar)] }),
    });
    if (!r.ok) { await r.body?.cancel(); return false; }
    return true;
  } catch (error) {
    console.error("Webhook préfecture :", error?.message || error);
    return false;
  }
}

/* ===== Prise de service ===== */
async function handleService(req, res, sql, { user, nick, avatar, body }) {
  await sql`UPDATE prefecture_service SET ended_at = started_at + make_interval(hours => ${SERVICE_MAX_HOURS}), ended_by = 'auto'
    WHERE ended_at IS NULL AND started_at < NOW() - make_interval(hours => ${SERVICE_MAX_HOURS})`;

  if (req.method === "POST") {
    if (body.action === "start") {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await sql`INSERT INTO prefecture_service (id, user_id, name, avatar, note)
        VALUES (${id}, ${user.id}, ${nick}, ${avatar}, ${cut(String(body.note || "").trim(), 120)})
        ON CONFLICT DO NOTHING`;
      return sendJson(res, 200, { ok: true });
    }
    if (body.action === "stop") {
      await sql`UPDATE prefecture_service SET ended_at = NOW(), ended_by = 'agent' WHERE user_id = ${user.id} AND ended_at IS NULL`;
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 400, { error: "unknown_action" });
  }
  if (req.method !== "GET") return sendJson(res, 405, { error: "method_not_allowed" });

  const sess = (r) => ({ id: r.id, user_id: r.user_id, name: r.m_name || r.name, avatar: r.m_avatar || r.avatar || "",
    note: r.note || "", started_at: r.started_at, ended_at: r.ended_at, mine: r.user_id === user.id, seconds: Number(r.seconds) });
  const onDuty = await sql`SELECT s.*, m.name AS m_name, m.avatar AS m_avatar, EXTRACT(EPOCH FROM (NOW() - s.started_at))::float AS seconds
    FROM prefecture_service s LEFT JOIN prefecture_members m ON m.id = s.user_id
    WHERE s.ended_at IS NULL ORDER BY s.started_at`;
  const recent = await sql`SELECT s.*, m.name AS m_name, m.avatar AS m_avatar, EXTRACT(EPOCH FROM (s.ended_at - s.started_at))::float AS seconds
    FROM prefecture_service s LEFT JOIN prefecture_members m ON m.id = s.user_id
    WHERE s.user_id = ${user.id} AND s.ended_at IS NOT NULL ORDER BY s.started_at DESC LIMIT 8`;
  const stats = await sql`SELECT
      COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))) FILTER (
        WHERE started_at >= (date_trunc('week', NOW() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris')), 0)::float AS week_s,
      COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))), 0)::float AS total_s,
      COUNT(*)::int AS n
    FROM prefecture_service WHERE user_id = ${user.id}`;
  const list = onDuty.map(sess);
  return sendJson(res, 200, {
    me: list.find((s) => s.mine) || null, on_duty: list, recent: recent.map(sess),
    stats: { week_s: Number(stats[0].week_s), total_s: Number(stats[0].total_s), n: Number(stats[0].n) },
  });
}

/* ===== Service : classement et gestion (Staff) ===== */
async function handleServiceAdmin(req, res, sql, body) {
  await sql`UPDATE prefecture_service SET ended_at = started_at + make_interval(hours => ${SERVICE_MAX_HOURS}), ended_by = 'auto'
    WHERE ended_at IS NULL AND started_at < NOW() - make_interval(hours => ${SERVICE_MAX_HOURS})`;

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
}

export default async function handler(req, res) {
  const mod = String(req.query?.module || "");
  /* modules publics (lecture sans connexion) gérés dans lib/ : aucune fonction Vercel supplémentaire */
  if (mod === "vigipirate") return vigipirateHandler(req, res);
  if (mod === "status") return statusHandler(req, res);
  if (mod !== "service" && mod !== "service_admin" && !Object.hasOwn(FIELDS, mod)) return sendJson(res, 400, { error: "unknown_module" });

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
    if ((req.method === "GET" || req.method === "POST") && mod !== "service_admin")
      await sql`INSERT INTO prefecture_members (id, name, avatar, updated_at) VALUES (${user.id}, ${nick}, ${avatar}, NOW())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, avatar = EXCLUDED.avatar, updated_at = NOW()`;

    if (mod === "service") return await handleService(req, res, sql, { user, nick, avatar, body });
    if (mod === "service_admin") {
      if (!staff) return sendJson(res, 403, { error: "admin_required" });
      return await handleServiceAdmin(req, res, sql, body);
    }

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
      /* enregistré d'abord, envoyé sur Discord ensuite (un échec Discord ne bloque rien) */
      const discord = Object.hasOwn(WEBHOOKS, mod) ? await relay(mod, data, nick, avatar) : undefined;
      return sendJson(res, 201, { ...row(created[0]), _discord: discord });
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