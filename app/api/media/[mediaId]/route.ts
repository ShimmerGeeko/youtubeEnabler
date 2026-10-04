import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ mediaId: string }>;
};

function rangeNotSatisfiable(size: number) {
  return new Response(null, {
    status: 416,
    headers: { "Content-Range": `bytes */${size}` },
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { mediaId } = await context.params;

  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) {
    return new Response("Not found", { status: 404 });
  }

  const videoPath = path.join(
    process.cwd(),
    ".generated-media",
    `${mediaId}.mp4`
  );

  let videoStats;
  try {
    videoStats = await stat(videoPath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const size = videoStats.size;
  const range = request.headers.get("range");
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": "video/mp4",
    "Cache-Control": "private, no-store",
  });

  let status = 200;
  let start = 0;
  let end = size - 1;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      return rangeNotSatisfiable(size);
    }

    if (!match[1]) {
      const suffixLength = Number(match[2]);
      start = Math.max(0, size - suffixLength);
    } else {
      start = Number(match[1]);
      if (match[2]) end = Number(match[2]);
    }

    if (start >= size || end < start) return rangeNotSatisfiable(size);

    end = Math.min(end, size - 1);
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }

  headers.set("Content-Length", String(end - start + 1));

  const file = createReadStream(videoPath, { start, end });
  return new Response(
    Readable.toWeb(file) as ReadableStream<Uint8Array>,
    { status, headers }
  );
}