
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  BOT_TOKEN,
  REDIRECT_URI,
  GUILD_ID,
  encryptToken,
} from "../lib/discord-oauth.js";

function getCookie(req, name) {
  const cookies = (req.headers.cookie || "").split(";");

  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    if (index < 0) continue;

    if (cookie.slice(0, index).trim() === name) {
      return cookie.slice(index + 1).trim();
    }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Méthode non autorisée.");
  }

  const action = req.query.action;

  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).send("Configuration Discord manquante.");
  }

  // Connexion : générer un état OAuth et enregistrer un cookie sécurisé.
  if (action === "login") {
    const state = crypto.randomBytes(32).toString("hex");

    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Set-Cookie",
      `lgp_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    );

    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set(
      "scope",
      "identify guilds.join guilds.members.read"
    );
    url.searchParams.set("state", state);

    return res.redirect(302, url.toString());
  }

  // Retour de Discord après autorisation.
  if (action !== "callback") {
    return res.status(400).send("Action Discord invalide.");
  }

  const { code, state, error } = req.query;

  if (error) {
    res.setHeader(
      "Set-Cookie",
      "lgp_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );
    return res.redirect(302, "/connexion.html");
  }

  if (
    typeof code !== "string" ||
    typeof state !== "string" ||
    !/^[a-f0-9]{64}$/.test(state) ||
    getCookie(req, "lgp_oauth_state") !== state ||
    !CLIENT_SECRET ||
    !BOT_TOKEN ||
    !process.env.DATABASE_URL
  ) {
    return res.status(400).send("État OAuth invalide ou configuration incomplète.");
  }

  try {
    const tokenResponse = await fetch(
      "https://discord.com/api/v10/oauth2/token",
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

    if (
      !tokenResponse.ok ||
      !tokens.access_token ||
      !tokens.refresh_token
    ) {
      console.error("Échec échange OAuth :", tokenResponse.status);
      return res.status(400).send("Échec de la connexion Discord.");
    }

    const userResponse = await fetch(
      "https://discord.com/api/v10/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    const user = await userResponse.json();

    if (!userResponse.ok || !user.id) {
      return res.status(400).send("Impossible de vérifier ton compte Discord.");
    }

    // Le bot doit appartenir à la même application OAuth.
    const joinResponse = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${user.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: tokens.access_token,
        }),
      }
    );

    if (!joinResponse.ok && joinResponse.status !== 204) {
      console.error("Ajout Discord refusé :", joinResponse.status);
      return res.status(502).send(
        "Impossible de rejoindre le serveur. Vérifie la configuration du bot."
      );
    }

    const sql = neon(process.env.DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS discord_oauth_consents (
        user_id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ
      )
    `;

    await sql`
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
    res.setHeader(
      "Set-Cookie",
      "lgp_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );

    const fragment = new URLSearchParams({
      access_token: tokens.access_token,
      expires_in: String(tokens.expires_in),
      state,
    });

    return res.redirect(302, `/connexion.html#${fragment.toString()}`);
  } catch (err) {
    console.error("Erreur OAuth :", err.message);
    return res.status(500).send("Erreur interne pendant la connexion.");
  }
}
