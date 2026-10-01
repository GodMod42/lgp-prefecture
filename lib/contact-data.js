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
    await sql`CREATE INDEX IF NOT EXISTS contact_tickets_updated_at_idx ON contact_tickets (updated_at DESC)`;
  })().catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

export async function discordUser(req, requireAdmin = false) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 4096) return { error: "auth", status: 401 };

  const headers = { Authorization: `Bearer ${token}` };
  const meResponse = await fetch("https://discord.com/api/users/@me", { headers });
  if (!meResponse.ok) return { error: "auth", status: 401 };
  const user = await meResponse.json();

  const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, { headers });
  if (memberResponse.status === 404) return { error: "not_member", status: 403 };
  if (!memberResponse.ok) return { error: "discord_auth_unavailable", status: 502 };
  const member = await memberResponse.json();
  if (requireAdmin && !(member.roles || []).includes(ADMIN_ROLE_ID))
    return { error: "admin_required", status: 403 };
  return { user, member };
}

export function webhookFor(motif) {
  const envName = WEBHOOK_BY_MOTIF[motif];
  const url = envName && process.env[envName];
  return url && /^https:\/\/discord\.com\/api\/webhooks\//.test(url) ? url : null;
}

export async function notifyDiscord(motif, embed) {
  const webhook = webhookFor(motif);
  if (!webhook) return false;
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Préfecture — demandes en ligne",
        allowed_mentions: { parse: [] },
        embeds: [embed],
      }),
    });
    await response.body?.cancel();
    return response.ok;
  } catch (error) {
    console.error("Discord notification failed:", error?.message || error);
    return false;
  }
}

export function sendJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}
