import { randomUUID } from "node:crypto";
import {
  db, discordUser, ensureSchema, isKnownMotif, notifyDiscord, sendJson,
} from "../lib/contact-data.js";

const MAX_MESSAGE = 3800;

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host)
    return sendJson(res, 403, { error: "origin_refused" });

  try {
    const identity = await discordUser(req);
    if (identity.error) return sendJson(res, identity.status, { error: identity.error });
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const motif = String(payload.motif || "").trim();
    const subject = String(payload.objet || "").trim().slice(0, 100);
    const name = String(payload.nom || "").trim().slice(0, 100);
    const phone = String(payload.tel || "").trim().slice(0, 30);
    const text = String(payload.txt || "").trim().slice(0, MAX_MESSAGE);
    if (!isKnownMotif(motif)) return sendJson(res, 400, { error: "unknown_motif" });
    if (!subject || !name || !text) return sendJson(res, 400, { error: "fields" });

    await ensureSchema();
    const reference = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    const createdAt = new Date().toISOString();
    const messages = [{ sender: "citoyen", author: name, text, createdAt }];
    await db()`INSERT INTO contact_tickets
      (reference, discord_user_id, discord_username, requester_name, phone, motif, subject, messages)
      VALUES (${reference}, ${identity.user.id}, ${identity.user.username}, ${name}, ${phone}, ${motif}, ${subject}, ${JSON.stringify(messages)}::jsonb)`;

    const notified = await notifyDiscord(motif, {
      title: `${motif} — ${subject}`.slice(0, 256),
      description: text,
      color: 0x000091,
      fields: [
        { name: "Demandeur", value: `${name} · ${identity.user.username}`.slice(0, 1024), inline: true },
        { name: "Téléphone", value: phone || "Non renseigné", inline: true },
        { name: "Référence", value: reference, inline: true },
      ],
      footer: { text: `Compte Discord : ${identity.user.id}` },
      timestamp: createdAt,
    });
    if (notified) await db()`UPDATE contact_tickets SET discord_notified = TRUE WHERE reference = ${reference}`;
    return sendJson(res, 201, { ok: true, reference, discordNotified: notified });
  } catch (error) {
    console.error("Contact submission failed:", error?.message || error);
    if (error?.message === "database_not_configured")
      return sendJson(res, 503, { error: "database_not_configured" });
    return sendJson(res, 500, { error: "contact_unavailable" });
  }
}
