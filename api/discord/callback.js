
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  BOT_TOKEN,
  REDIRECT_URI,
  GUILD_ID,
  encryptToken,
} from "../../lib/discord-oauth.js";

const sql = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL manquante.");
  }
  return neon(process.env.DATABASE_URL);
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Méthode non autorisée.");
  }

  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send("Connexion Discord annulée.");
  }

  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    !/^[a-f0-9]{64}$/.test(state) ||
    !CLIENT_ID ||
    !CLIENT_SECRET ||
    !BOT_TOKEN ||
    !REDIRECT_URI
  ) {
    return res.status(400).send("Paramètres OAuth invalides.");
  }

  // Le state doit être comparé à celui créé par la page de connexion.
  // Cette signature permet de vérifier son authenticité côté serveur.
  const signature = req.headers.cookie || "";
  const stateCookie = signature
    .split("; ")
    .find((part) => part.startsWith("lgp_oauth_state="))
    ?.split("=")[1];

  if (!stateCookie || stateCookie !== state) {
    return res.status(400).send(
      "État OAuth incorrect. Retournez à la page de connexion et réessayez."
    );
  }

  try {
    const tokenResponse = await fetch(
      "https://discord.com/api/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
        }),
      }
    );

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) {
      console.error("Échec échange OAuth :", tokenResponse.status);
      return res.status(400).send("Échec de la connexion Discord.");
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const user = await userResponse.json();

    if (!userResponse.ok || !user.id) {
      return res.status(400).send("Impossible de vérifier ton compte Discord.");
    }

    // Ajouter le membre au serveur avec l'API officielle Discord.
    const joinResponse = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${user.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: tokens.access_token }),
      }
    );

    if (!joinResponse.ok && joinResponse.status !== 204) {
      console.error("Ajout au serveur refusé :", joinResponse.status);
      return res.status(502).send(
        "Autorisation enregistrée non confirmée : impossible de rejoindre le serveur. Vérifie les permissions du bot."
      );
    }

    const db = sql();

    await db`
      CREATE TABLE IF NOT EXISTS discord_oauth_consents (
        user_id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ
      )
    `;

    await db`
      INSERT INTO discord_oauth_consents
        (user_id, access_token, refresh_token, expires_at, revoked_at)
      VALUES (
        ${user.id},
        ${encryptToken(tokens.access_token)},
        ${encryptToken(tokens.refresh_token)},
        ${Date.now() + tokens.expires_in * 1000},
        NULL
      )
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        consented_at = NOW(),
        revoked_at = NULL
    `;

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", "lgp_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");

    // La page existante pourra récupérer le token depuis le fragment.
    const fragment = new URLSearchParams({
      access_token: tokens.access_token,
      expires_in: String(tokens.expires_in),
      state,
    });

    return res.redirect(
      302,
      `/connexion.html#${fragment.toString()}`
    );
  } catch (err) {
    console.error("Erreur callback OAuth :", err.message);
    return res.status(500).send("Erreur interne pendant la connexion.");
  }
}
