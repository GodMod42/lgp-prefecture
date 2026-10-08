import {
  db, discordUser, ensureSchema, isKnownMotif, notifyDiscord, parseAttachments, sendJson,
} from "../../lib/contact-data.js";
import { randomUUID } from "node:crypto";

/* Même envoi que dans api/contact.js : le test « Prise de rendez-vous » part sur DISCORD_WEBHOOK_RDV (salon forum). */
async function notifyRdv(embed, threadName) {
  const hook = (process.env.DISCORD_WEBHOOK_RDV || "").trim().replace(/^["']|["']$/g, "");
  if (!hook) return { ok: false };
  try {
    const response = await fetch(hook + (hook.includes("?") ? "&" : "?") + "wait=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Préfecture — Rendez-vous",
        thread_name: threadName.slice(0, 100),
        allowed_mentions: { parse: [] },
        embeds: [embed],
      }),
    });
    if (!response.ok) throw new Error("webhook " + response.status);
    const message = await response.json().catch(() => ({}));
    return { ok: true, threadId: message.channel_id || null };
  } catch (error) {
    console.error("RDV webhook failed:", error?.message || error);
    return { ok: false };
  }
}

export default async function handler(req, res) {
  const identity = await discordUser(req, true).catch(() => ({ error: "discord_auth_unavailable", status: 502 }));
  if (identity.error) return sendJson(res, identity.status, { error: identity.error });

  try {
    await ensureSchema();
    if (req.method === "GET") {
      const tickets = await db()`SELECT reference, discord_user_id, discord_username, requester_name,
        phone, motif, subject, status, messages, discord_notified, is_test, created_at, updated_at
        FROM contact_tickets ORDER BY CASE WHEN status = 'Ouvert' THEN 0 ELSE 1 END, updated_at DESC`;
      return sendJson(res, 200, tickets);
    }

    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (req.method === "POST" && payload.testForm) {
      const testForm = String(payload.testForm);
      let motif, subject, formLabel, useRdv = false;
      if (testForm === "contact") {
        motif = String(payload.motif || "Support technique").trim();
        if (!isKnownMotif(motif) || motif === "Déclaration / démarche")
          return sendJson(res, 400, { error: "unknown_motif" });
        subject = "[TEST] Formulaire de contact";
        formLabel = "formulaire de contact";
      } else if (testForm === "creation") {
        motif = "Déclaration / démarche";
        subject = "Démarche en ligne — Création d'entreprise [TEST]";
        formLabel = "formulaire de création d’entreprise";
      } else if (testForm === "procedure") {
        const name = String(payload.procedureName || "").replace(/\s+/g, " ").trim().slice(0, 80);
        if (!name) return sendJson(res, 400, { error: "procedure_invalid" });
        motif = "Déclaration / démarche";
        subject = `Démarche en ligne — ${name} [TEST]`;
        formLabel = `formulaire « ${name} »`;
        useRdv = name === "Prise de rendez-vous";
      } else {
        return sendJson(res, 400, { error: "test_form_invalid" });
      }

      const reference = "TEST-" + randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
      const author = "TEST — " + String(identity.member.nick || identity.user.username || "Admin").slice(0, 80);
      const requester = "TEST — " + String(identity.member.nick || identity.user.username || "Admin").slice(0, 80);
      const username = "TEST — " + String(identity.user.username || "Admin").slice(0, 80);
      const phone = "TEST — aucun numéro réel";
      const text = `[TEST] Soumission de test du ${formLabel}, générée depuis le panel admin. Ces données de test servent uniquement à vérifier la réception de la demande et des réponses.`;
      const createdAt = new Date().toISOString();
      const messages = [{ sender: "citoyen", author, text, createdAt }];
      await db()`INSERT INTO contact_tickets
        (reference, discord_user_id, discord_username, requester_name, phone, motif, subject, messages, is_test)
        VALUES (${reference}, ${identity.user.id}, ${username}, ${requester}, ${phone}, ${motif}, ${subject}, ${JSON.stringify(messages)}::jsonb, TRUE)`;

      const testEmbed = {
        title: `${motif} — ${subject}`.slice(0, 256),
        description: text,
        color: 0xff8a00,
        fields: [
          { name: "Demandeur", value: requester, inline: true },
          { name: "Téléphone", value: phone, inline: true },
          { name: "Référence de test", value: reference, inline: true },
        ],
        footer: { text: `TEST · webhook du motif ${motif}` },
        timestamp: createdAt,
      };
      const notification = useRdv
        ? await notifyRdv(testEmbed, `${reference} · ${subject}`)
        : await notifyDiscord(motif, testEmbed, { subject, reference, test: true });
      if (notification.ok) await db()`UPDATE contact_tickets
        SET discord_notified = TRUE, discord_thread_id = ${notification.threadId || null}
        WHERE reference = ${reference}`;
      return sendJson(res, 201, { ok: true, reference, discordNotified: notification.ok });
    }
    if (req.method === "PATCH" && payload.closeAll === true) {
      const ticketType = String(payload.ticketType || "");
      let closed;
      if (ticketType === "contact") {
        closed = await db()`UPDATE contact_tickets SET status = 'Fermé', updated_at = NOW()
          WHERE status = 'Ouvert' AND motif <> 'Déclaration / démarche' RETURNING reference`;
      } else if (ticketType === "procedure") {
        closed = await db()`UPDATE contact_tickets SET status = 'Fermé', updated_at = NOW()
          WHERE status = 'Ouvert' AND motif = 'Déclaration / démarche' RETURNING reference`;
      } else {
        return sendJson(res, 400, { error: "ticket_type_invalid" });
      }
      return sendJson(res, 200, { ok: true, closed: closed.length });
    }

    /* Suppression définitive de toutes les demandes d'un onglet (ouvertes et clôturées, tests inclus) */
    if (req.method === "DELETE" && payload.all === true) {
      const ticketType = String(payload.ticketType || "");
      let deleted;
      if (ticketType === "contact") {
        deleted = await db()`DELETE FROM contact_tickets
          WHERE motif <> 'Déclaration / démarche' RETURNING reference`;
      } else if (ticketType === "procedure") {
        deleted = await db()`DELETE FROM contact_tickets
          WHERE motif = 'Déclaration / démarche' RETURNING reference`;
      } else {
        return sendJson(res, 400, { error: "ticket_type_invalid" });
      }
      return sendJson(res, 200, { ok: true, deleted: deleted.length });
    }

    const reference = String(payload.reference || "").trim().slice(0, 32);
    if (!reference) return sendJson(res, 400, { error: "reference_required" });

    /* Suppression définitive d'une seule demande */
    if (req.method === "DELETE") {
      const result = await db()`DELETE FROM contact_tickets WHERE reference = ${reference} RETURNING reference`;
      if (!result.length) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { ok: true, deleted: 1 });
    }

    if (req.method === "PATCH") {
      const result = await db()`UPDATE contact_tickets SET status = 'Fermé', updated_at = NOW()
        WHERE reference = ${reference} RETURNING reference`;
      if (!result.length) return sendJson(res, 404, { error: "not_found" });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
    const text = String(payload.text || "").trim().slice(0, 1500);
    const parsedAttachments = parseAttachments(payload.attachments || []);
    if (parsedAttachments.error) return sendJson(res, 400, { error: parsedAttachments.error });
    if (!text && !parsedAttachments.files.length) return sendJson(res, 400, { error: "message_required" });

    const rows = await db()`SELECT motif, subject, messages, status, discord_thread_id, is_test FROM contact_tickets WHERE reference = ${reference}`;
    if (!rows.length) return sendJson(res, 404, { error: "not_found" });
    const ticket = rows[0];
    if (ticket.status !== "Ouvert") return sendJson(res, 409, { error: "closed" });

    const createdAt = new Date().toISOString();
    const reply = {
      sender: "prefecture",
      author: ticket.is_test ? `TEST — ${identity.member.nick || identity.user.username}` : (identity.member.nick || identity.user.username),
      text: ticket.is_test ? `[TEST] ${text}` : text,
      attachments: parsedAttachments.files,
      createdAt,
    };
    const updated = await db()`UPDATE contact_tickets
      SET messages = messages || ${JSON.stringify([reply])}::jsonb, updated_at = NOW()
      WHERE reference = ${reference} RETURNING messages`;
    const notification = await notifyDiscord(ticket.motif, {
      title: `Réponse — ${ticket.motif} — ${ticket.subject}`.slice(0, 256),
      description: [text, parsedAttachments.files.length ? `${parsedAttachments.files.length} pièce(s) jointe(s), visibles dans le panneau du site.` : ""].filter(Boolean).join("\n\n").slice(0, 4096),
      color: 0x000091,
      fields: [{ name: "Référence de la demande", value: reference }],
      footer: { text: `Réponse de ${reply.author}` },
      timestamp: createdAt,
    }, { subject: ticket.subject, threadId: ticket.discord_thread_id, test: ticket.is_test });
    if (notification.threadId && notification.threadId !== ticket.discord_thread_id)
      await db()`UPDATE contact_tickets SET discord_thread_id = ${notification.threadId} WHERE reference = ${reference}`;
    return sendJson(res, 200, { ok: true, messages: updated[0].messages, discordNotified: notification.ok });
  } catch (error) {
    console.error("Admin ticket operation failed:", error?.message || error);
    if (error?.message === "database_not_configured")
      return sendJson(res, 503, { error: "database_not_configured" });
    return sendJson(res, 500, { error: "admin_unavailable" });
  }
}
