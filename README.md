# Déploiement du site sur Vercel

Le dépôt GitHub Vercel contient uniquement le site : ses fichiers doivent donc être à la racine du dépôt (copie le contenu du dossier local `Site`, pas le dossier `Site` lui-même). Vercel héberge les pages et exécute les fonctions placées dans `api/`. Neon Postgres conserve les demandes et les conversations partagées entre les visiteurs et l’équipe. Les webhooks Discord servent uniquement aux notifications ; aucun bot Discord n’est utilisé. Le schéma de la base est créé automatiquement au premier appel.

## 1. Relier la base de données

Dans Vercel, ouvre le projet, puis **Storage / Marketplace** et installe l’intégration **Neon Postgres**. Relie la base à ce projet et à l’environnement Production. L’intégration fournit `DATABASE_URL` au projet. Vercel présente Neon comme une base Postgres serverless installable depuis son Marketplace et injecte ses variables de connexion au projet.

## 2. Définir les webhooks Discord

Dans **Settings → Environment Variables**, ajoute ces variables avec les URL de webhook fournies. Applique-les à Production (et Preview si besoin) :

- `DISCORD_WEBHOOK_SUPPORT_TECHNIQUE` → Support technique
- `DISCORD_WEBHOOK_RECLAMATION` → Réclamation
- `DISCORD_WEBHOOK_DECLARATION_DEMARCHE` → Déclaration / démarche
- `DISCORD_WEBHOOK_SIGNALEMENT` → Signalement
- `DISCORD_WEBHOOK_RECRUTEMENT` → Recrutement
- `DISCORD_WEBHOOK_IGPN` → IGPN
- `DISCORD_WEBHOOK_AUTRE` → Autre

Les URL restent dans les variables serveur et ne sont pas publiées dans les fichiers du site. Si Discord est momentanément indisponible, la demande reste enregistrée dans la base et apparaît dans le panneau admin.

## 3. Connexion Discord et accès admin

Dans le portail développeur Discord, conserve les scopes `identify`, `guilds` et `guilds.members.read`. Ajoute comme redirect URI l’adresse exacte de la page de connexion, par exemple `https://lgp-prefecture.vercel.app/connexion.html`.

L’administration est réservée au rôle Discord **Staff**, identifié par `1554580932411789402`. Aucun identifiant individuel d’administrateur n’est utilisé.

## 4. Déployer

Dans **Settings → Build and Deployment**, laisse **Root Directory** vide (racine du dépôt). Après avoir relié Neon et ajouté les variables webhook, redéploie le projet : Vercel applique les changements d’environnement aux nouveaux déploiements.

Depuis la racine locale du site, `npm install` installe les dépendances et `npm run dev` lance l’environnement local Vercel. `npm run deploy` lance un déploiement de production.

## Fonctionnement

Le formulaire enregistre la demande dans Neon puis envoie un embed au webhook du motif. Le panneau admin lit cette même demande et permet d’y répondre ; la réponse est sauvegardée dans la conversation et notifiée sur Discord. La page « Mes démarches » permet au demandeur de lire les réponses et d’ajouter un message. Les réponses écrites directement dans Discord ne sont pas synchronisées vers le site : cela nécessiterait une intégration d’événements Discord distincte.
