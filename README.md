# Déploiement du site sur Vercel

Le dossier `Site` contient le site statique et la fonction Vercel `/api/contact`. Le traitement des demandes n’utilise pas le bot : la fonction vérifie la session OAuth2 Discord, choisit le webhook correspondant au motif et envoie un embed dans le salon du service. Les agents consultent les demandes et répondent directement dans Discord.

## Configuration Vercel

Dans Vercel, configure le projet avec `Site` comme **Root Directory**. Dans **Settings → Environment Variables**, ajoute une variable par webhook. Copie chaque URL fournie dans la variable correspondant au motif :

- `DISCORD_WEBHOOK_SUPPORT_TECHNIQUE` → Support technique
- `DISCORD_WEBHOOK_RECLAMATION` → Réclamation
- `DISCORD_WEBHOOK_DECLARATION_DEMARCHE` → Déclaration / démarche
- `DISCORD_WEBHOOK_SIGNALEMENT` → Signalement
- `DISCORD_WEBHOOK_RECRUTEMENT` → Recrutement
- `DISCORD_WEBHOOK_IGPN` → IGPN
- `DISCORD_WEBHOOK_AUTRE` → Autre

Applique les variables aux environnements Production et Preview dont tu as besoin, puis redéploie le projet. Ne colle jamais les URL dans un fichier public du site : la fonction les lit depuis l’environnement du serveur.

## Connexion Discord et accès admin

Dans le portail développeur Discord, conserve les scopes `identify`, `guilds` et `guilds.members.read`. Ajoute comme redirect URI l’adresse exacte de la page de connexion Vercel, par exemple `https://lgp-prefecture.vercel.app/connexion.html`.

L’administration du site est réservée au rôle Discord `Staff`, identifié dans le projet par `1554580932411789402`. La connexion Discord charge les rôles du membre ; aucun identifiant individuel d’administrateur n’est requis.

## Développement

Depuis le dossier `Site`, installe les dépendances avec `npm install`, puis lance `npm run dev`. Les URL de webhook doivent être définies dans les variables locales de Vercel pour tester l’envoi. Le déploiement de production se fait avec `npm run deploy` ou depuis le tableau de bord Vercel.

## Limites du fonctionnement sans bot

Les webhooks transmettent les demandes à Discord. Les réponses et le suivi se font dans Discord ; elles ne sont pas synchronisées vers l’espace du site, car le webhook ne peut pas lire les messages du salon. Pour garder les URL secrètes, l’envoi passe par la petite fonction Vercel du dossier `api` : aucun bot Discord ni serveur API externe n’est à héberger.
