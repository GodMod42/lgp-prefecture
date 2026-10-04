import { neon } from "@neondatabase/serverless";

export const GUILD_ID = "1554544322068873286";
export const ADMIN_ROLE_ID = "1554580932411789402";

export const WEBHOOK_BY_MOTIF = {
  "Support technique": "DISCORD_WEBHOOK_SUPPORT_TECHNIQUE",
  "Réclamation": "DISCORD_WEBHOOK_RECLAMATION",
  "Déclaration / démarche": "DISCORD_WEBHOOK_DECLARATION_DEMARCHE",
  "Signalement": "DISCORD_WEBHOOK_SIGNALEMENT",
  "Recrutement": "DISCORD_WEBHOOK_RECRUTEMENT",
  "IGPN": "DISCORD_WEBHOOK_IGPN",
  "Autre": "DISCORD_WEBHOOK_AUTRE",
};

const DISCORD_TIMEOUT_MS = 7000;
const WEBHOOK_TIMEOUT_MS = 3500;
const IDENTITY_CACHE_TTL_MS = 60 * 1000;
const IDENTITY_STALE_TTL_MS = 10 * 60 * 1000;
const identityCache = new Map();
const ATTACHMENT_TYPES = new Set([
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png", "image/webp", "text/plain",
]);
const MAX_ATTACHMENT_BYTES = 1024 * 1024;
const MAX_ATTACHMENTS_BYTES = 2.5 * 1024 * 1024;

export function parseAttachments(input) {
  if (!Array.isArray(input) || input.length > 5) return { error: "attachments_invalid" };
  const files = [];
  let total = 0;
  for (const item of input) {
    const name = String(item?.name || "fichier").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120);
    const type = String(item?.type || "").toLowerCase();
    const data = String(item?.data || "");
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(data);
    if (!name || !ATTACHMENT_TYPES.has(type) || !match || match[1].toLowerCase() !== type)
      return { error: "attachments_invalid" };
    const size = Math.floor(match[2].length * 3 / 4) - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
    if (!size || size > MAX_ATTACHMENT_BYTES) return { error: "attachments_too_large" };
    total += size;
    if (total > MAX_ATTACHMENTS_BYTES) return { error: "attachments_too_large" };
    files.push({ name, type, size, data });
  }
  return { files, total };
}

export function isKnownMotif(motif) {
  return Object.hasOwn(WEBHOOK_BY_MOTIF, motif);
}

let sqlClient;
let schemaReady;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("database_not_configured");
  sqlClient ||= neon(process.env.DATABASE_URL);
  return sqlClient;
}

export async function ensureSchema() {
  if (!schemaReady) schemaReady = (async () => {
    const sql = db();
    await sql`CREATE TABLE IF NOT EXISTS contact_tickets (
      reference TEXT PRIMARY KEY,
      discord_user_id TEXT NOT NULL,
      discord_username TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      motif TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Ouvert',
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      discord_notified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`ALTER TABLE contact_tickets ADD COLUMN IF NOT EXISTS discord_thread_id TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS contact_tickets_updated_at_idx ON contact_tickets (updated_at DESC)`;
  })().catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

export async function discordUser(req, requireAdmin = false) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 4096) return { error: "auth", status: 401 };

  const cached = identityCache.get(token);
  const now = Date.now();
  if (cached && now - cached.verifiedAt <= IDENTITY_CACHE_TTL_MS) {
    if (requireAdmin && !(cached.member.roles || []).includes(ADMIN_ROLE_ID))
      return { error: "admin_required", status: 403 };
    return cached;
  }

  const headers = { Authorization: `Bearer ${token}` };
  try {
    const [meResponse, memberResponse] = await Promise.all([
      fetch("https://discord.com/api/users/@me", { headers, signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS) }),
      fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, { headers, signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS) }),
    ]);
    if (meResponse.status === 401) return { error: "auth", status: 401 };
    if (!meResponse.ok) return { error: "discord_auth_unavailable", status: 502 };
    const user = await meResponse.json();
    if (memberResponse.status === 404) return { error: "not_member", status: 403 };
    if (!memberResponse.ok) return { error: "discord_auth_unavailable", status: 502 };
    const member = await memberResponse.json();
    const identity = { user, member, verifiedAt: Date.now() };
    identityCache.set(token, identity);
    if (identityCache.size > 500) identityCache.delete(identityCache.keys().next().value);
    if (requireAdmin && !(member.roles || []).includes(ADMIN_ROLE_ID))
      return { error: "admin_required", status: 403 };
    return identity;
  } catch (error) {
    console.error("Discord identity check failed:", error?.message || error);
    if (cached && now - cached.verifiedAt <= IDENTITY_STALE_TTL_MS) {
      if (requireAdmin && !(cached.member.roles || []).includes(ADMIN_ROLE_ID))
        return { error: "admin_required", status: 403 };
      return cached;
    }
    return { error: "discord_auth_unavailable", status: 502 };
  }
}

const COMPANY_CREATION_SUBJECT = "Démarche en ligne — Création d'entreprise";

function isCompanyCreation(motif, subject) {
  return motif === "Déclaration / démarche" && subject === COMPANY_CREATION_SUBJECT;
}

export function webhookFor(motif, subject) {
  if (isCompanyCreation(motif, subject)) {
    const url = process.env.DISCORD_WEBHOOK_CREATION_ENTREPRISE;
    return url && /^https:\/\/discord\.com\/api\/webhooks\//.test(url) ? url : null;
  }
  const envName = WEBHOOK_BY_MOTIF[motif];
  const url = envName && process.env[envName];
  return url && /^https:\/\/discord\.com\/api\/webhooks\//.test(url) ? url : null;
}

export async function notifyDiscord(motif, embed, { subject = "", threadId = "", reference = "" } = {}) {
  const companyCreation = isCompanyCreation(motif, subject);
  const webhook = webhookFor(motif, subject);
  if (!webhook) return { ok: false, threadId: "" };
  try {
    const url = new URL(webhook);
    url.searchParams.set("wait", "true");
    if (threadId) url.searchParams.set("thread_id", threadId);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      body: JSON.stringify({
        username: "Préfecture — demandes en ligne",
        allowed_mentions: { parse: [] },
        ...(companyCreation && !threadId ? { thread_name: `Création d'entreprise — ${reference}`.slice(0, 100) } : {}),
        embeds: [embed],
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { ok: false, threadId: "" };
    }
    let createdMessage = null;
    try { createdMessage = await response.json(); } catch {}
    return { ok: true, threadId: companyCreation ? (threadId || createdMessage?.channel_id || "") : "" };
  } catch (error) {
    console.error("Discord notification failed:", error?.message || error);
    return { ok: false, threadId: "" };
  }
}

export function sendJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}

