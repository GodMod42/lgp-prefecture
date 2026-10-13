
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  BOT_TOKEN,
  REDIRECT_URI,
  GUILD_ID,
  encryptToken,
  decryptToken,
} from "../lib/discord-oauth.js";

import { discordUser } from "../lib/contact-data.js";

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


async function requireAdmin(req, res) {
  const identity = await discordUser(req, true);

  if (identity.error) {
    res.setHeader("Cache-Control", "no-store");
    res.status(identity.status).json({ error: identity.error });
    return false;
  }

  return true;
}

function jsonNoStore(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(data);
}

async function consentRows() {
  if (!process.env.DATABASE_URL) {
    throw new Error("database_not_configured");
  }

  const sql = neon(process.env.DATABASE_URL);

  return sql`
    SELECT user_id, access_token, refresh_token,
           expires_at, consented_at, revoked_at
    FROM discord_oauth_consents
    WHERE revoked_at IS NULL
    ORDER BY consented_at DESC
    LIMIT 500
  `;
}

async function refreshConsentToken(row) {
  const oldRefreshToken = decryptToken(row.refresh_token);

  const response = await fetch(
    "https://discord.com/api/v10/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: oldRefreshToken,
      }),
      signal: AbortSignal.timeout(10000),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (
    !response.ok ||
    !data.access_token ||
    !data.refresh_token ||
    !Number.isFinite(Number(data.expires_in))
  ) {
    return { ok: false, reason: "refresh_invalid" };
  }

  const sql = neon(process.env.DATABASE_URL);

  await sql`
    UPDATE discord_oauth_consents
    SET access_token = ${encryptToken(data.access_token)},
        refresh_token = ${encryptToken(data.refresh_token)},
        expires_at = ${Date.now() + Number(data.expires_in) * 1000}
    WHERE user_id = ${row.user_id}
      AND revoked_at IS NULL
  `;

  return {
    ok: true,
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
}

async function addConsentMember(userId, accessToken) {
  return fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
      signal: AbortSignal.timeout(10000),
    }
  );
}

async function previewConsents(req, res) {
  if (req.method !== "GET") {
    return jsonNoStore(res, 405, { error: "method_not_allowed" });
  }

  if (!(await requireAdmin(req, res))) return;

  try {
    const rows = await consentRows();

    const results = rows.map((row) => {
      let accessReadable = false;
      let refreshReadable = false;

      try {
        decryptToken(row.access_token);
        accessReadable = true;
      } catch {}

      try {
        decryptToken(row.refresh_token);
        refreshReadable = true;
      } catch {}

      const accessExpired = Number(row.expires_at) <= Date.now();

      let status = "prêt à vérifier";
      if (!accessReadable || !refreshReadable) {
        status = "jeton illisible";
      } else if (accessExpired) {
        status = "accès expiré — renouvellement nécessaire";
      }

      return {
        userId: row.user_id,
        consentedAt: row.consented_at,
        expiresAt: Number(row.expires_at),
        accessExpired,
        accessReadable,
        refreshReadable,
        selectable: accessReadable && refreshReadable,
        status,
      };
    });

    return jsonNoStore(res, 200, { users: results });
  } catch (error) {
    console.error("Consent preview failed:", error?.message || error);
    return jsonNoStore(res, 500, { error: "preview_failed" });
  }
}

async function readdConsents(req, res) {
  if (req.method !== "POST") {
    return jsonNoStore(res, 405, { error: "method_not_allowed" });
  }

  if (!(await requireAdmin(req, res))) return;

  if (!CLIENT_ID || !CLIENT_SECRET || !BOT_TOKEN) {
    return jsonNoStore(res, 500, { error: "discord_config_missing" });
  }

  const ids = req.body?.userIds;

  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 25 ||
    ids.some((id) => typeof id !== "string" || !/^\d{17,20}$/.test(id))
  ) {
    return jsonNoStore(res, 400, {
      error: "select_between_1_and_25_valid_user_ids",
    });
  }

  try {
    const uniqueIds = [...new Set(ids)];
    const rows = await consentRows();
    const selected = uniqueIds.map((id) => ({
      id,
      row: rows.find((row) => row.user_id === id),
    }));

    const results = [];

    for (const item of selected) {
      const { id, row } = item;

      if (!row) {
        results.push({ userId: id, status: "consentement absent ou révoqué" });
        continue;
      }

      let accessToken;

      try {
        accessToken = decryptToken(row.access_token);
        decryptToken(row.refresh_token);
      } catch {
        results.push({ userId: id, status: "jeton illisible — aucune action" });
        continue;
      }

      // Renouvelle l'accès si le jeton est expiré ou expire dans moins d'une minute.
      if (Number(row.expires_at) <= Date.now() + 60000) {
        const refreshed = await refreshConsentToken(row);

        if (!refreshed.ok) {
          results.push({
            userId: id,
            status: "jeton de renouvellement invalide ou révoqué",
          });
          continue;
        }

        accessToken = refreshed.accessToken;
      }

      let response;

      try {
        response = await addConsentMember(id, accessToken);

        // Si l'accès est refusé, tente une seule actualisation du jeton.
        if (response.status === 401) {
          const refreshed = await refreshConsentToken(row);

          if (!refreshed.ok) {
            results.push({
              userId: id,
              status: "jeton invalide — renouvellement impossible",
            });
            continue;
          }

          response = await addConsentMember(id, refreshed.accessToken);
        }
      } catch {
        results.push({ userId: id, status: "erreur réseau Discord" });
        continue;
      }

      if (response.status === 201) {
        results.push({ userId: id, status: "ajouté au serveur" });
      } else if (response.status === 204) {
        results.push({ userId: id, status: "déjà membre" });
      } else {
        await response.body?.cancel().catch(() => {});
        results.push({
          userId: id,
          status: `échec Discord (${response.status})`,
        });
      }
    }

    return jsonNoStore(res, 200, { results });
  } catch (error) {
    console.error("Consent re-add failed:", error?.message || error);
    return jsonNoStore(res, 500, { error: "readd_failed" });
  }
}


export default async function handler(req, res) {
  const action = req.query.action;

  if (action === "admin-preview") {
    return previewConsents(req, res);
  }

  if (action === "admin-readd") {
    return readdConsents(req, res);
  }

  if (req.method !== "GET") {
    return res.status(405).send("Méthode non autorisée.");
  }

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
