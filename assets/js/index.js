/* Lancement autonome (bot + API). Si tu as déjà un bot, utilise plutôt : require('./tickets')(client, app); */
require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('TOKEN (ou DISCORD_TOKEN) manquant dans .env'); process.exit(1); }
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const app = express();
require('./tickets')(client, app);
client.once('ready', () => {
  console.log('Bot connecté :', client.user.tag);
  const port = process.env.API_PORT || process.env.PORT || 3000;
  app.listen(port, process.env.API_HOST || '0.0.0.0', () => console.log('API sur le port', port));
});
client.login(TOKEN);
