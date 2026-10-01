const GUILD_ID = "1554544322068873286";
const WEBHOOK_BY_MOTIF = {
  "Support technique": "DISCORD_WEBHOOK_SUPPORT_TECHNIQUE",
  "Réclamation": "DISCORD_WEBHOOK_RECLAMATION",
  "Déclaration / démarche": "DISCORD_WEBHOOK_DECLARATION_DEMARCHE",
  "Signalement": "DISCORD_WEBHOOK_SIGNALEMENT",
  "Recrutement": "DISCORD_WEBHOOK_RECRUTEMENT",
  "IGPN": "DISCORD_WEBHOOK_IGPN",
  "Autre": "DISCORD_WEBHOOK_AUTRE",
};
const recent = new Map();

function respond(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return respond(res, 405, { error: "method_not_allowed" });

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!host || (origin && new URL(origin).host !== host))
    return respond(res, 403, { error: "origin_refused" });

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 4096) return respond(res, 401, { error: "auth" });

  try {
    const meResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meResponse.ok) return respond(res, 401, { error: "auth" });
    const member = await meResponse.json();

    const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!guildsResponse.ok) return respond(res, 401, { error: "auth" });
    const guilds = await guildsResponse.json();
    if (!Array.isArray(guilds) || !guilds.some((guild) => guild.id === GUILD_ID))
      return respond(res, 403, { error: "not_member" });

    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const motif = String(payload.motif || "").trim();
    const objet = String(payload.objet || "").trim().slice(0, 100);
    const nom = String(payload.nom || "").trim().slice(0, 100);
    const telephone = String(payload.tel || "").trim().slice(0, 30);
    const message = String(payload.txt || "").trim().slice(0, 1500);
    const envName = WEBHOOK_BY_MOTIF[motif];
    const webhook = envName && process.env[envName];
    if (!envName || !objet || !nom || !message)
      return respond(res, 400, { error: "fields" });
    if (!webhook || !/^https:\/\/discord\.com\/api\/webhooks\//.test(webhook))
      return respond(res, 503, { error: "not_configured" });

    const now = Date.now();
    const stamps = (recent.get(member.id) || []).filter((stamp) => now - stamp < 60 * 60 * 1000);
    if (stamps.length >= 5) return respond(res, 429, { error: "rate_limited" });
    stamps.push(now);
    recent.set(member.id, stamps);

    const reference = crypto.randomUUID().slice(0, 8).toUpperCase();
    const sent = await fetch(`${webhook}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Préfecture — demandes en ligne",
        allowed_mentions: { parse: [] },
        embeds: [{
          title: `${motif} — ${objet}`,
          description: message,
          color: 0x000091,
          fields: [
            { name: "Demandeur", value: `${nom} · ${member.username}`.slice(0, 1024), inline: true },
            { name: "Téléphone", value: telephone || "Non renseigné", inline: true },
            { name: "Référence", value: reference, inline: true },
          ],
          footer: { text: `Compte Discord : ${member.id}` },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    if (!sent.ok) {
      await sent.body?.cancel();
      console.error(`Discord webhook returned HTTP ${sent.status} for ${motif}`);
      return respond(res, 502, { error: "discord_unavailable" });
    }
    await sent.body?.cancel();
    return respond(res, 200, { ok: true, reference });
  } catch (error) {
    console.error("Contact submission failed:", error?.message || error);
    return respond(res, 400, { error: "invalid_request" });
  }
}
