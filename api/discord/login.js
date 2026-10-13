
import crypto from "node:crypto";
import {
  CLIENT_ID,
  REDIRECT_URI,
} from "../../lib/discord-oauth.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Méthode non autorisée.");
  }

  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).send("Configuration Discord manquante.");
  }

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
