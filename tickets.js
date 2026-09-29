/* Module tickets : à brancher sur un bot discord.js et une app Express existants.
   Usage :  require('./tickets')(client, app);
   Le client doit avoir les intents Guilds, GuildMessages et MessageContent. */
const fs = require('fs'), path = require('path');
const express = require('express'), cors = require('cors'), multer = require('multer');
const { PermissionFlagsBits: P, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = function setupTickets(client, app) {
const { GUILD_ID, STAFF_ROLE_ID, CAT_DEFAULT, CAT_CLOSED } = process.env;
const ORIGIN = (process.env.SITE_ORIGIN || '').replace(/\/+$/, '');   // sans "/" final
const CATS = JSON.parse(process.env.CATEGORIES || '{}');
if (!GUILD_ID || !STAFF_ROLE_ID) throw new Error('GUILD_ID et STAFF_ROLE_ID sont requis (.env)');

/* ---- Stockage (fichier JSON) ---- */
const DB_FILE = path.join(__dirname, 'data.json');
let db = { n: 0, tickets: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
let timer = null;
const save = () => { clearTimeout(timer); timer = setTimeout(() => { fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db)); fs.renameSync(DB_FILE + '.tmp', DB_FILE); }, 200); };
const pub = (t, full) => ({ id: t.id, motif: t.motif, objet: t.objet, nom: t.nom, tel: t.tel, statut: t.statut, date: t.date, ...(full ? { msgs: t.msgs } : {}) });


/* ---- Auth : le token Discord de l'utilisateur est vérifié auprès de Discord ---- */
const cache = new Map();
async function auth(req, res, next) {
  const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!tok) return res.status(401).json({ error: 'auth' });
  let c = cache.get(tok);
  if (!c || c.exp < Date.now()) {
    try {
      const r = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + tok } });
      if (!r.ok) throw 0;
      const u = await r.json();
      const guild = await client.guilds.fetch(GUILD_ID);
      if (!(await guild.members.fetch(u.id).catch(() => null))) return res.status(403).json({ error: 'not_member' });
      c = { id: u.id, exp: Date.now() + 5 * 60e3 }; cache.set(tok, c);
    } catch { return res.status(401).json({ error: 'auth' }); }
  }
  req.uid = c.id; next();
}
const hits = new Map();
const limit = (k, n, ms) => { const now = Date.now(), a = (hits.get(k) || []).filter(x => now - x < ms); if (a.length >= n) return false; a.push(now); hits.set(k, a); return true; };
const clean = (s, n) => String(s || '').trim().slice(0, n);
const mine = (req, res) => { const t = db.tickets[req.params.id]; if (!t || t.uid !== req.uid) { res.status(404).json({ error: 'introuvable' }); return null; } return t; };

/* ---- API ---- */
const r = express.Router();
r.use(cors({ origin: ORIGIN, allowedHeaders: ['Authorization', 'Content-Type'] }));
r.use(express.json({ limit: '50kb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 3, fileSize: 8 * 1048576 } });

r.get('/', auth, (req, res) =>
  res.json(Object.values(db.tickets).filter(t => t.uid === req.uid).sort((a, b) => b.date - a.date).map(t => pub(t))));

r.get('/:id', auth, (req, res) => { const t = mine(req, res); if (t) res.json(pub(t, true)); });

r.post('/', auth, async (req, res) => {
  const b = req.body || {};
  const motif = clean(b.motif, 60), objet = clean(b.objet, 100), nom = clean(b.nom, 100), tel = clean(b.tel, 30), txt = clean(b.txt, 1500);
  if (!motif || !objet || !nom || !txt) return res.status(400).json({ error: 'champs' });
  if (!limit('new' + req.uid, 5, 3600e3)) return res.status(429).json({ error: 'limite' });
  try {
    const guild = await client.guilds.fetch(GUILD_ID), member = await guild.members.fetch(req.uid);
    const id = String(++db.n).padStart(4, '0');
    const slug = motif.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'ticket';
    const ch = await guild.channels.create({
      name: `${slug}-${id}`, type: ChannelType.GuildText, parent: CATS[motif] || CAT_DEFAULT || null,
      topic: `Ticket #${id} — ${objet} — ${member.displayName}`.slice(0, 1000),
      permissionOverwrites: [
        { id: guild.id, deny: [P.ViewChannel] },
        { id: STAFF_ROLE_ID, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.AddReactions] },
        { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks, P.AddReactions] }] });
    const emb = new EmbedBuilder().setColor(0x000091).setTitle(`Ticket #${id} — ${objet}`).setDescription(txt)
      .addFields({ name: 'Demandeur', value: `<@${req.uid}> (${nom})`, inline: true }, { name: 'Motif', value: motif, inline: true }, { name: 'Téléphone', value: tel || '—', inline: true })
      .setFooter({ text: 'Écrivez ici pour répondre : votre message est envoyé au demandeur sur le site. Préfixe // = note interne.' });
    await ch.send({ content: `<@&${STAFF_ROLE_ID}>`, allowedMentions: { roles: [STAFF_ROLE_ID] }, embeds: [emb],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close:' + id).setLabel('Fermer le ticket').setStyle(ButtonStyle.Danger))] });
    const t = db.tickets[id] = { id, uid: req.uid, channelId: ch.id, motif, objet, nom, tel, statut: 'Ouvert', date: Date.now(),
      msgs: [{ from: 'user', author: member.displayName, avatar: member.displayAvatarURL({ size: 64, extension: 'png' }), txt, files: [], date: Date.now() }] };
    save(); res.json(pub(t, true));
  } catch (e) { console.error(e); res.status(500).json({ error: 'discord' }); }
});

r.post('/:id/messages', auth, upload.array('files', 3), async (req, res) => {
  const t = mine(req, res); if (!t) return;
  if (t.statut !== 'Ouvert') return res.status(409).json({ error: 'ferme' });
  if (!limit('msg' + req.uid, 20, 60e3)) return res.status(429).json({ error: 'limite' });
  const txt = clean(req.body.txt, 1500), files = req.files || [];
  if (!txt && !files.length) return res.status(400).json({ error: 'vide' });
  try {
    const member = await (await client.guilds.fetch(GUILD_ID)).members.fetch(req.uid);
    const avatar = member.displayAvatarURL({ size: 64, extension: 'png' });
    const ch = await client.channels.fetch(t.channelId);
    await ch.send({ allowedMentions: { parse: [] },
      embeds: [new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: member.displayName, iconURL: avatar }).setDescription(txt || '*(pièce jointe)*')],
      files: files.map(f => ({ attachment: f.buffer, name: f.originalname })) });
    t.msgs.push({ from: 'user', author: member.displayName, avatar, txt, files: files.map(f => ({ name: f.originalname })), date: Date.now() });
    save(); res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'discord' }); }
});

/* ---- Discord -> site ---- */
client.on('messageCreate', m => {
  if (m.author.bot || !m.guild) return;
  const t = Object.values(db.tickets).find(x => x.channelId === m.channelId);
  if (!t || t.statut !== 'Ouvert' || m.content.startsWith('//')) return;
  const txt = m.cleanContent, files = [...m.attachments.values()].map(a => ({ name: a.name, url: a.url }));
  if (!txt && !files.length) return;
  t.msgs.push({ from: 'staff', author: m.member?.displayName || m.author.username, avatar: m.author.displayAvatarURL({ size: 64, extension: 'png' }), txt, files, date: Date.now() });
  save(); m.react('✅').catch(() => {});
});

client.on('interactionCreate', async i => {
  if (!i.isButton() || !i.customId.startsWith('close:')) return;
  const t = db.tickets[i.customId.slice(6)];
  if (!t) return i.reply({ content: 'Ticket introuvable.', flags: 64 });
  if (!i.member.roles.cache.has(STAFF_ROLE_ID)) return i.reply({ content: 'Réservé au staff.', flags: 64 });
  t.statut = 'Fermé'; t.msgs.push({ from: 'system', txt: `Ticket fermé par ${i.member.displayName}.`, date: Date.now() }); save();
  await i.reply('🔒 Ticket fermé : le demandeur ne peut plus répondre.');
  await i.channel.setName('ferme-' + i.channel.name.replace(/^ferme-/, '')).catch(() => {});
  if (CAT_CLOSED) await i.channel.setParent(CAT_CLOSED, { lockPermissions: false }).catch(() => {});
});

app.use('/tickets', r);
};
