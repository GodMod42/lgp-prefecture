// api/rdv.js — reçoit une demande de rendez-vous et l'envoie sur Discord via DISCORD_WEBHOOK_RDV.
// Style CommonJS : si ton package.json contient "type": "module", remplace la dernière ligne
// par « export default handler; » et garde le reste tel quel.

const clip = (v, n) => String(v ?? "").trim().slice(0, n);
const lastCall = new Map(); // anti-spam simple (par utilisateur, au mieux sur serverless)

const parisToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
const frDate = (d) => d.split("-").reverse().join("/");

// Même règles que le formulaire : lun-ven 8h30-22h, samedi 9h-22h, dimanche fermé.
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

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const hook = (process.env.DISCORD_WEBHOOK_RDV || "").trim().replace(/^["']|["']$/g, "");
  if (!hook) return res.status(500).json({ error: "webhook_not_configured" });

  // 1. Vérifier l'utilisateur côté serveur (on ne fait pas confiance au navigateur)
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "unauthorized" });

  let me;
  try {
    const r = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: "Bearer " + token },
    });
    if (r.status === 401) return res.status(401).json({ error: "unauthorized" });
    if (!r.ok) throw new Error("discord " + r.status);
    me = await r.json();
  } catch {
    return res.status(502).json({ error: "discord_auth_unavailable" });
  }

  // 2. Anti-spam : 1 demande toutes les 30 secondes par personne
  const now = Date.now();
  if (now - (lastCall.get(me.id) || 0) < 30000) return res.status(429).json({ error: "rate_limited" });

  // 3. Validation
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const d = {
    nom: clip(b.nom, 80), prenom: clip(b.prenom, 80), tel: clip(b.tel, 30),
    service: clip(b.service, 80), motif: clip(b.motif, 80), objet: clip(b.objet, 1000),
    date: clip(b.date, 10), heure: clip(b.heure, 5), date2: clip(b.date2, 10), heure2: clip(b.heure2, 5),
  };
  if (!d.nom || !d.prenom || !d.tel || !d.service || !d.motif || !d.objet) {
    return res.status(400).json({ error: "invalid_request" });
  }
  if (!validSlot(d.date, d.heure)) return res.status(400).json({ error: "invalid_slot" });
  const hasAlt = d.date2 || d.heure2;
  if (hasAlt && !validSlot(d.date2, d.heure2)) return res.status(400).json({ error: "invalid_slot" });

  // 4. Envoi sur Discord
  const reference = "RDV-" + now.toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const fields = [
    { name: "Demandeur", value: clip(d.prenom + " " + d.nom, 200), inline: true },
    { name: "Téléphone", value: d.tel, inline: true },
    { name: "Compte Discord", value: `<@${me.id}> (${clip(me.username, 40)})`, inline: false },
    { name: "Service", value: d.service, inline: true },
    { name: "Motif", value: d.motif, inline: true },
    { name: "Créneau souhaité", value: `${frDate(d.date)} à ${d.heure}`, inline: false },
  ];
  if (hasAlt) fields.push({ name: "Créneau alternatif", value: `${frDate(d.date2)} à ${d.heure2}`, inline: false });
  fields.push({ name: "Précisions", value: d.objet });

  try {
    const r = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Préfecture — Rendez-vous",
        thread_name: clip(`${reference} · ${d.service} · ${d.prenom} ${d.nom}`, 100),
        allowed_mentions: { parse: [] }, // aucune mention n'est réellement notifiée
        embeds: [{
          title: "📅 Nouvelle demande de rendez-vous",
          color: 0x000091,
          fields,
          footer: { text: "Réf. " + reference },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    if (!r.ok) throw new Error("webhook " + r.status);
  } catch (e) {
    console.error("rdv webhook error:", e.message);
    return res.status(502).json({ error: "send_failed" });
  }

  lastCall.set(me.id, now);
  return res.status(200).json({ ok: true, reference });
}

export default handler;
