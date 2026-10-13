
import crypto from "node:crypto";

export const GUILD_ID = "1554544322068873286";

export const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
export const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
export const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
export const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

function encryptionKey() {
  const value = process.env.DISCORD_TOKEN_ENCRYPTION_KEY;

  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      "DISCORD_TOKEN_ENCRYPTION_KEY doit contenir 64 caractères hexadécimaux."
    );
  }

  return Buffer.from(value, "hex");
}

export function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    encryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptToken(value) {
  const [ivHex, tagHex, encryptedHex] = value.split(":");

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Token chiffré invalide.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
