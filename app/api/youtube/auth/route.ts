import { NextResponse } from "next/server";
import {
  cookieOptions,
  createYouTubeOAuthClient,
  YOUTUBE_STATE_COOKIE,
} from "../../../../agents/youtubeAuth";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const oauth = createYouTubeOAuthClient(new URL(request.url).origin);
    const state = randomBytes(32).toString("base64url");
    const authorizationUrl = oauth.generateAuthUrl({
      access_type: "offline",
      include_granted_scopes: true,
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/youtube.upload"],
      state,
    });
    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set(YOUTUBE_STATE_COOKIE, state, cookieOptions(600));
    return response;
  } catch (error) {
    console.error("YouTube OAuth configuration error:", error);
    return NextResponse.redirect(
      new URL("/?youtube=not-configured", request.url)
    );
  }
}