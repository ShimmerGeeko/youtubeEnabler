import { NextResponse } from "next/server";
import {
  cookieOptions,
  YOUTUBE_CREDENTIALS_COOKIE,
} from "../../../../agents/youtubeAuth";

export async function POST() {
  const response = NextResponse.json({ connected: false });
  response.cookies.set(YOUTUBE_CREDENTIALS_COOKIE, "", cookieOptions(0));
  return response;
}