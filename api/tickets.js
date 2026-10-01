import {
  db, discordUser, ensureSchema, notifyDiscord, sendJson,
} from "../../lib/contact-data.js";

export default async function handler(req, res) {
  const identity = await discordUser(req, true).catch(() => ({ error: "discord_auth_unavailable", status: 502 }));
  if (identity.error) return sendJson(res, identity.status, { error: identity.error });

  try {
    await ensureSchema();
    if (req.method === "GET") {
      const tickets = await db()`SELECT reference, discord_user_id, discord_username, requester_name,
        phone, motif, subject, status, messages, discord_notified, created_at, updated_at
        FROM contact_tickets ORDER BY CASE WHEN status = 'Ouvert' THEN 0 ELSE 1 END, updated_at DESC`;
      return sendJson(res, 200, tickets);
    }

    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const reference = String(payload.reference || "").trim().slice(0, 32);
    if (!reference) return sendJson(res, 400, { error: "reference_required" });

    if (req.method === "PATCH") {
      const result = await db()`UPDATE contact_tickets SET status = 'Fermé', updated_at = NOW()
        WHERE reference = ${reference} RETURNING reference`;
      if (!result.length) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
    const text = String(payload.text || "").trim().slice(0, 1500);
    if (!text) return sendJson(res, 400, { error: "message_required" });

    const rows = await db()`SELECT motif, subject, messages, status FROM contact_tickets WHERE reference = ${reference}`;
    if (!rows.length) return sendJson(res, 404, { error: "not_found" });
    const ticket = rows[0];
    if (ticket.status !== "Ouvert") return sendJson(res, 409, { error: "closed" });

    const createdAt = new Date().toISOString();
    const reply = { sender: "prefecture", author: identity.member.nick || identity.user.username, text, createdAt };
    const updated = await db()`UPDATE contact_tickets
      SET messages = messages || ${JSON.stringify([reply])}::jsonb, updated_at = NOW()
      WHERE reference = ${reference} RETURNING messages`;
    const notified = await notifyDiscord(ticket.motif, {
      title: `Réponse — ${ticket.motif} — ${ticket.subject}`.slice(0, 256),
      description: text,
      color: 0x000091,
      fields: [{ name: "Référence de la demande", value: reference }],
      footer: { text: `Réponse de ${reply.author}` },
      timestamp: createdAt,
    });
    return sendJson(res, 200, { ok: true, messages: updated[0].messages, discordNotified: notified });
  } catch (error) {
    console.error("Admin ticket operation failed:", error?.message || error);
    if (error?.message === "database_not_configured")
      return sendJson(res, 503, { error: "database_not_configured" });
    return sendJson(res, 500, { error: "admin_unavailable" });
  }
}
