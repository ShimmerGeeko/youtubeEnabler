import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { google } from "googleapis";

export const YOUTUBE_CREDENTIALS_COOKIE = "youtube_credentials";
export const YOUTUBE_STATE_COOKIE = "youtube_oauth_state";

type Credentials = Record<string, unknown>;

function getEncryptionKey() {
  const secret = process.env.YOUTUBE_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("YOUTUBE_COOKIE_SECRET must contain at least 32 characters.");
  }
  return createHash("sha256").update(secret).digest();
}

export function createYouTubeOAuthClient(origin: string) {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.YOUTUBE_OAUTH_REDIRECT_URI ||
    new URL("/api/youtube/callback", origin).toString();

  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth client credentials are not configured.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function encryptCredentials(credentials: Credentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);

  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptCredentials(value: string): Credentials | null {
  try {
    const [iv, authTag, encrypted] = value
      .split(".")
      .map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
    const parsed: unknown = JSON.parse(decrypted);

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Credentials;
  } catch {
    return null;
  }
}

export function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function isYouTubeOAuthConfigured() {
  const cookieSecret = process.env.YOUTUBE_COOKIE_SECRET;

  return Boolean(
    process.env.YOUTUBE_OAUTH_CLIENT_ID &&
      process.env.YOUTUBE_OAUTH_CLIENT_SECRET &&
      cookieSecret &&
      cookieSecret.length >= 32
  );
}