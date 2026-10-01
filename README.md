# Liaison du site et du bot Discord

Le site est servi par Netlify. Une fonction Netlify relaie les appels `/api/*` vers l’API aiohttp du bot Python. L’API vérifie chaque jeton de connexion auprès de Discord, confirme que le compte est membre du serveur, puis gère les demandes dans SQLite et leurs salons privés Discord.

## Configuration

1. Héberge le bot Python sur une machine qui reste en ligne et rends son port `25606` accessible à Netlify derrière une adresse HTTPS. Utilise un tunnel ou un reverse proxy HTTPS ; évite d’exposer directement le port HTTP du bot.
2. Dans les variables d’environnement du site Netlify, ajoute `BOT_API_URL` avec l’URL HTTPS de l’API, sans `/api` à la fin. Par exemple : `https://bot-api.example.com`. Donne à cette variable le scope **Functions**. La fonction retire automatiquement le préfixe `/api` avant de transmettre la requête.
3. Déploie le site depuis ce dossier. `netlify.toml` configure le dossier statique et les fonctions dans `netlify/functions` ; `npm run dev` lance l’aperçu local.
4. Dans le `.env` du bot, configure `DISCORD_TOKEN`, `GUILD_ID`, `TICKET_CATEGORY_ID` et `TICKET_STAFF_ROLE_ID`. Le bot a besoin des permissions de gérer les salons, voir et envoyer des messages, joindre des fichiers et intégrer des liens. Active les intents Membres et Contenu des messages dans le portail Discord.
5. Dans le portail Discord, configure l’URL de redirection OAuth exactement comme l’adresse de `connexion.html` sur Netlify ou sur ton domaine personnalisé (par exemple `https://ton-site.netlify.app/connexion.html`). L’application Discord doit autoriser les scopes `identify`, `guilds` et `guilds.members.read` utilisés par la page.

## Demandes de contact et administration

Le formulaire de contact utilise le relais `/api` pour que les jetons Discord et les URL des webhooks restent traités côté serveur. Dans le `.env` du bot, ajoute `SITE_ADMIN_IDS` avec les identifiants Discord des administrateurs (séparés par des virgules), puis `CONTACT_WEBHOOKS_JSON` comme objet JSON dont chaque clé est le libellé exact d’un motif et chaque valeur son URL de webhook Discord. Exemple de structure : `{"Renseignement":"https://discord.com/api/webhooks/ID/TOKEN","Autre":"https://discord.com/api/webhooks/ID/TOKEN"}`. Ne place jamais ces URL dans les fichiers du site ni dans `content.json`.

Les demandes restent enregistrées dans SQLite et apparaissent dans l’onglet « Demandes de contact » du panneau admin. Une réponse envoyée depuis cet onglet est ajoutée à la conversation et transmise au salon Discord associé ; l’envoi au webhook sert à notifier le service concerné. Les motifs sans webhook configuré continuent d’être visibles dans le salon de tickets existant.

Les comptes connectés peuvent ouvrir un ticket depuis le site. Le bot crée un salon visible du demandeur et du staff ; les réponses du staff apparaissent sur le site, et le bouton du salon ferme le ticket. Les demandes sont conservées dans `Bot/data/bot.db`.

## Démarrage

Depuis le dossier `Bot`, installe les paquets de `requirements.txt` puis lance `python main.py`. Depuis le dossier du site, lance `npm install`, puis `npm run dev` pour le développement local. Connecte le dépôt à Netlify pour les déploiements. Le site affiche une erreur API 503 tant que `BOT_API_URL` n’est pas défini dans l’environnement des fonctions Netlify.
