import { NextResponse } from "next/server";
import { runScriptAgent } from "../../../agents/scriptAgent";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function runWithRetry(topic: {
  title: string;
  description: string;
  source: string;
}) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await runScriptAgent(topic);
    } catch (error: any) {
      const statusCode = error?.statusCode ?? error?.status;

      console.error(
        `Script Agent attempt ${attempt}/${maxAttempts} failed:`,
        error
      );

      // Retry temporary Gemini/server errors
      if (
        statusCode !== 503 &&
        statusCode !== 429 &&
        statusCode !== 500
      ) {
        throw error;
      }

      if (attempt === maxAttempts) {
        throw error;
      }

      // 2s -> 4s -> 8s
      const delay = 2000 * Math.pow(2, attempt - 1);

      console.log(
        `Gemini temporarily unavailable. Retrying in ${
          delay / 1000
        }s...`
      );

      await sleep(delay);
    }
  }

  throw new Error("Script generation failed after retries.");
}

export async function POST(request: Request) {
  try {
    const topic = await request.json();

    if (!topic?.title || !topic?.description) {
      return NextResponse.json(
        {
          error: "Topic information is required.",
        },
        { status: 400 }
      );
    }

    const result = await runWithRetry({
      title: topic.title,
      description: topic.description,
      source: topic.source ?? "",
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Script generation error:", error);

    const statusCode = error?.statusCode ?? error?.status;

    if (statusCode === 503) {
      return NextResponse.json(
        {
          error:
            "Gemini is currently overloaded. Automatic retries were exhausted. Please try again later.",
        },
        { status: 503 }
      );
    }

    if (statusCode === 429) {
      return NextResponse.json(
        {
          error:
            "Gemini rate limit reached. Please wait before trying again.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate script.",
      },
      { status: 500 }
    );
  }
}

