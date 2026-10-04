import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import {
  cookieOptions,
  createYouTubeOAuthClient,
  decryptCredentials,
  encryptCredentials,
  getCookie,
  YOUTUBE_CREDENTIALS_COOKIE,
} from "../../../../agents/youtubeAuth";

export const runtime = "nodejs";
export const maxDuration = 300;

type UploadRequest = {
  mediaId?: unknown;
  title?: unknown;
  description?: unknown;
  privacyStatus?: unknown;
  confirmed?: unknown;
};

export async function POST(request: Request) {
  let body: UploadRequest;

  try {
    body = (await request.json()) as UploadRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    body.confirmed !== true ||
    typeof body.mediaId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.mediaId) ||
    typeof body.title !== "string" ||
    !body.title.trim() ||
    typeof body.description !== "string" ||
    !["private", "unlisted", "public"].includes(String(body.privacyStatus))
  ) {
    return NextResponse.json(
      { error: "A confirmed upload with valid video details is required." },
      { status: 400 }
    );
  }

  const encryptedCredentials = getCookie(request, YOUTUBE_CREDENTIALS_COOKIE);
  const credentials = encryptedCredentials
    ? decryptCredentials(encryptedCredentials)
    : null;

  if (!credentials) {
    return NextResponse.json(
      { error: "Connect your YouTube channel before uploading." },
      { status: 401 }
    );
  }

  const videoPath = path.join(
    process.cwd(),
    ".generated-media",
    `${body.mediaId}.mp4`
  );

  try {
    await stat(videoPath);
  } catch {
    return NextResponse.json(
      { error: "The rendered MP4 was not found on this server." },
      { status: 404 }
    );
  }

  try {
    const oauth = createYouTubeOAuthClient(new URL(request.url).origin);
    oauth.setCredentials(credentials);
    const upload = await google.youtube({ version: "v3", auth: oauth }).videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: body.title.trim().slice(0, 100),
          description: body.description.slice(0, 5000),
        },
        status: {
          privacyStatus: body.privacyStatus as "private" | "unlisted" | "public",
          selfDeclaredMadeForKids: false,
        },
      },
      media: { body: createReadStream(videoPath) },
    });

    if (!upload.data.id) {
      throw new Error("YouTube did not return an uploaded video ID.");
    }

    const response = NextResponse.json({
      videoId: upload.data.id,
      url: `https://www.youtube.com/watch?v=${upload.data.id}`,
      privacyStatus: upload.data.status?.privacyStatus ?? body.privacyStatus,
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
    console.error("YouTube upload failed:", error);
    return NextResponse.json(
      { error: "YouTube upload failed. Check the channel connection and try again." },
      { status: 500 }
    );
  }
}