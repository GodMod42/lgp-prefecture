import { db, discordUser, ensureSchema, notifyDiscord, parseAttachments, sendJson } from "../lib/contact-data.js";

export default async function handler(req, res) {
  try {
    const identity = await discordUser(req);
    if (identity.error) return sendJson(res, identity.status, { error: identity.error });
    await ensureSchema();

    if (req.method === "GET") {
      const tickets = await db()`SELECT reference, requester_name, phone, motif, subject, status,
        messages, created_at, updated_at FROM contact_tickets
        WHERE discord_user_id = ${identity.user.id} ORDER BY updated_at DESC`;
      return sendJson(res, 200, tickets);
    }

    if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const reference = String(payload.reference || "").trim().slice(0, 32);
    const text = String(payload.text || "").trim().slice(0, 1500);
    const parsedAttachments = parseAttachments(payload.attachments || []);
    if (parsedAttachments.error) return sendJson(res, 400, { error: parsedAttachments.error });
    if (!reference || (!text && !parsedAttachments.files.length)) return sendJson(res, 400, { error: "fields" });

    const rows = await db()`SELECT motif, subject, messages, status FROM contact_tickets
      WHERE reference = ${reference} AND discord_user_id = ${identity.user.id}`;
    if (!rows.length) return sendJson(res, 404, { error: "not_found" });
    const ticket = rows[0];
    if (ticket.status !== "Ouvert") return sendJson(res, 409, { error: "closed" });

    const createdAt = new Date().toISOString();
    const message = { sender: "citoyen", author: identity.user.username, text, attachments: parsedAttachments.files, createdAt };
    const updated = await db()`UPDATE contact_tickets
      SET messages = messages || ${JSON.stringify([message])}::jsonb, updated_at = NOW()
      WHERE reference = ${reference} RETURNING messages`;
    const discordNotified = await notifyDiscord(ticket.motif, {
      title: `Complément — ${ticket.motif} — ${ticket.subject}`.slice(0, 256),
      description: [text, parsedAttachments.files.length ? `${parsedAttachments.files.length} pièce(s) jointe(s), visibles dans le panneau du site.` : ""].filter(Boolean).join("\n\n").slice(0, 4096),
      color: 0x000091,
      fields: [{ name: "Référence de la demande", value: reference }],
      footer: { text: `Complément de ${identity.user.username}` },
      timestamp: createdAt,
    });
    return sendJson(res, 200, { ok: true, messages: updated[0].messages, discordNotified });
  } catch (error) {
    console.error("Citizen ticket operation failed:", error?.message || error);
    if (error?.message === "database_not_configured")
      return sendJson(res, 503, { error: "database_not_configured" });
    return sendJson(res, 500, { error: "tickets_unavailable" });
  }
}

