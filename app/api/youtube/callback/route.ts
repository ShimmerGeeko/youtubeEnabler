import { NextResponse } from "next/server";
import {
  cookieOptions,
  createYouTubeOAuthClient,
  encryptCredentials,
  getCookie,
  YOUTUBE_CREDENTIALS_COOKIE,
  YOUTUBE_STATE_COOKIE,
} from "../../../../agents/youtubeAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const expectedState = getCookie(request, YOUTUBE_STATE_COOKIE);
  const code = url.searchParams.get("code");

  if (!state || !expectedState || state !== expectedState || !code) {
    return NextResponse.redirect(
      new URL("/?youtube=authorization-failed", request.url)
    );
  }

  try {
    const oauth = createYouTubeOAuthClient(url.origin);
    const { tokens } = await oauth.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error("Google did not return a refresh token. Reconnect and consent again.");
    }

    const response = NextResponse.redirect(new URL("/?youtube=connected", request.url));
    response.cookies.set(
      YOUTUBE_CREDENTIALS_COOKIE,
      encryptCredentials(tokens as Record<string, unknown>),
      cookieOptions(60 * 60 * 24 * 30)
    );
    response.cookies.set(YOUTUBE_STATE_COOKIE, "", cookieOptions(0));
    return response;
  } catch (error) {
    console.error("YouTube OAuth callback failed:", error);
    return NextResponse.redirect(
      new URL("/?youtube=authorization-failed", request.url)
    );
  }
}