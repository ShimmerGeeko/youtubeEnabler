import { NextResponse } from "next/server";
import { renderScriptVideo } from "../../../../agents/mediaRenderer";

export const runtime = "nodejs";
export const maxDuration = 300;

type Script = {
  title: string;
  hook: string;
  script: string;
  estimatedDurationSeconds?: number;
  estimatedDurationMinutes?: number;
  scenes?: {
    id: number;
    durationSeconds: number;
    narration: string;
    visualPrompt: string;
    caption: string;
    animationType?: string;
  }[];
};

function isScript(value: unknown): value is Script {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const script = value as Record<string, unknown>;
  return (
    typeof script.title === "string" &&
    typeof script.hook === "string" &&
    typeof script.script === "string"
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !isScript((body as Record<string, unknown>).script)
  ) {
    return NextResponse.json(
      { error: "A generated script is required to render a video." },
      { status: 400 }
    );
  }

  try {
    const result = await renderScriptVideo(
      (body as { script: Script }).script
    );

    return NextResponse.json({
      ...result,
      videoUrl: `/api/media/${result.id}`,
    });
  } catch (error) {
    console.error("Video rendering error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Video rendering failed.",
      },
      { status: 500 }
    );
  }
}