import { NextResponse } from "next/server";
import { google } from "googleapis";
import {
  cookieOptions,
  createYouTubeOAuthClient,
  decryptCredentials,
  encryptCredentials,
  getCookie,
  isYouTubeOAuthConfigured,
  YOUTUBE_CREDENTIALS_COOKIE,
} from "../../../../agents/youtubeAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isYouTubeOAuthConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }

  const encryptedCredentials = getCookie(request, YOUTUBE_CREDENTIALS_COOKIE);
  const credentials = encryptedCredentials
    ? decryptCredentials(encryptedCredentials)
    : null;

  if (!credentials) {
    return NextResponse.json({ configured: true, connected: false });
  }

  try {
    const oauth = createYouTubeOAuthClient(new URL(request.url).origin);
    oauth.setCredentials(credentials);
    const result = await google.youtube({ version: "v3", auth: oauth }).channels.list({
      part: ["snippet"],
      mine: true,
      maxResults: 1,
    });
    const channel = result.data.items?.[0];
    const response = NextResponse.json({
      configured: true,
      connected: Boolean(channel),
      channelTitle: channel?.snippet?.title ?? null,
    });

    if (oauth.credentials.refresh_token) {
      response.cookies.set(
        YOUTUBE_CREDENTIALS_COOKIE,
        encryptCredentials(oauth.credentials as Record<string, unknown>),
        cookieOptions(60 * 60 * 24 * 30)
      );
    }

    return response;
  } catch (error) {
    console.error("YouTube connection check failed:", error);
    return NextResponse.json({ configured: true, connected: false });
  }
}