import { randomUUID } from "node:crypto";
import {
  db, discordUser, ensureSchema, isKnownMotif, notifyDiscord, sendJson,
} from "../lib/contact-data.js";
import { checkBotId } from "botid/server";

const MAX_MESSAGE = 3800;

/* ===== Prise de rendez-vous =====
   Un rendez-vous est enregistré comme une démarche en ligne (même motif que les autres démarches),
   donc il apparaît dans « Mes démarches » et dans l'admin : Demandes → Démarches en ligne → « Prise de rendez-vous ».
   La notification part sur le webhook forum DISCORD_WEBHOOK_RDV. */
const RDV_MOTIF = "Déclaration / démarche";
const RDV_SUBJECT = "Démarche en ligne — Prise de rendez-vous";

const clip = (value, max) => String(value ?? "").trim().slice(0, max);
const parisToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
const frDate = (date) => date.split("-").reverse().join("/");

// Mêmes horaires que le formulaire : lun-ven 8h30-22h, samedi 9h-22h, dimanche fermé.
function validSlot(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;
  if (date < parisToday()) return false;
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  if (day === 0) return false;
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m;
  const start = day === 6 ? 9 * 60 : 8 * 60 + 30;
  return minutes >= start && minutes <= 22 * 60 - 30 && m % 30 === 0;
}

function buildRdv(raw) {
  const rdv = {
    service: clip(raw.service, 80), motif: clip(raw.motif, 80), precisions: clip(raw.precisions, 1000),
    date: clip(raw.date, 10), heure: clip(raw.heure, 5), date2: clip(raw.date2, 10), heure2: clip(raw.heure2, 5),
  };
  if (!rdv.service || !rdv.motif || !rdv.precisions) return { error: "fields" };
  if (!validSlot(rdv.date, rdv.heure)) return { error: "invalid_slot" };
  const hasAlt = rdv.date2 || rdv.heure2;
  if (hasAlt && !validSlot(rdv.date2, rdv.heure2)) return { error: "invalid_slot" };
  const lines = [
    "Prise de rendez-vous",
    `Service concerné : ${rdv.service}`,
    `Motif : ${rdv.motif}`,
    `Créneau souhaité : ${frDate(rdv.date)} à ${rdv.heure}`,
  ];
  if (hasAlt) lines.push(`Créneau alternatif : ${frDate(rdv.date2)} à ${rdv.heure2}`);
  lines.push(`Précisions : ${rdv.precisions}`);
  return { rdv, text: lines.join("\n") };
}

// Envoi sur le webhook du forum : un post par demande (thread_name obligatoire pour un forum).
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
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });

  const { isBot } = await checkBotId();

  if (isBot) {
    return sendJson(res, 403, { error: "bot_detected" });
  }

  const origin = req.headers.origin;

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host)
    return sendJson(res, 403, { error: "origin_refused" });

  try {
    const identity = await discordUser(req);
    if (identity.error) return sendJson(res, identity.status, { error: identity.error });
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const name = String(payload.nom || "").trim().slice(0, 100);
    const phone = String(payload.tel || "").trim().slice(0, 30);

    const rawRdv = payload.rdv && typeof payload.rdv === "object" ? payload.rdv : null;
    let motif, subject, text, rdv = null;
    if (rawRdv) {
      const built = buildRdv(rawRdv);
      if (built.error) return sendJson(res, 400, { error: built.error });
      rdv = built.rdv;
      motif = RDV_MOTIF;
      subject = RDV_SUBJECT;
      text = built.text.slice(0, MAX_MESSAGE);
      if (!name) return sendJson(res, 400, { error: "fields" });
    } else {
      motif = String(payload.motif || "").trim();
      subject = String(payload.objet || "").trim().slice(0, 100);
      text = String(payload.txt || "").trim().slice(0, MAX_MESSAGE);
      if (!isKnownMotif(motif)) return sendJson(res, 400, { error: "unknown_motif" });
      if (!subject || !name || !text) return sendJson(res, 400, { error: "fields" });
    }

    await ensureSchema();
    const reference = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
    const createdAt = new Date().toISOString();
    const messages = [{ sender: "citoyen", author: name, text, createdAt }];
    await db()`INSERT INTO contact_tickets
      (reference, discord_user_id, discord_username, requester_name, phone, motif, subject, messages)
      VALUES (${reference}, ${identity.user.id}, ${identity.user.username}, ${name}, ${phone}, ${motif}, ${subject}, ${JSON.stringify(messages)}::jsonb)`;

    const embed = {
      title: (rdv ? "📅 Prise de rendez-vous" : `${motif} — ${subject}`).slice(0, 256),
      description: text,
      color: 0x000091,
      fields: [
        { name: "Demandeur", value: `${name} · ${identity.user.username}`.slice(0, 1024), inline: true },
        { name: "Téléphone", value: phone || "Non renseigné", inline: true },
        { name: "Référence", value: reference, inline: true },
      ],
      footer: { text: `Compte Discord : ${identity.user.id}` },
      timestamp: createdAt,
    };
    const notification = rdv
      ? await notifyRdv(embed, `${reference} · ${rdv.service} · ${name}`)
      : await notifyDiscord(motif, embed, { subject, reference });
    if (notification.ok) await db()`UPDATE contact_tickets
      SET discord_notified = TRUE, discord_thread_id = ${notification.threadId || null}
      WHERE reference = ${reference}`;
    return sendJson(res, 201, { ok: true, reference, discordNotified: notification.ok });
  } catch (error) {
    console.error("Contact submission failed:", error?.message || error);
    if (error?.message === "database_not_configured")
      return sendJson(res, 503, { error: "database_not_configured" });
    return sendJson(res, 500, { error: "contact_unavailable" });
  }
}
