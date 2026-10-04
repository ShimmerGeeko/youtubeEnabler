import { NextResponse } from "next/server";
import { runTopicAgent } from "../../../agents/topicAgent";
import { searchYouTubeVideos } from "../../../agents/youtubeResearch";

export async function GET() {
  try {
    const topics = await runTopicAgent();

    if (!Array.isArray(topics)) {
      throw new Error("The Topic Agent did not return a list of topics.");
    }

    const topicsWithVideos = await Promise.all(
      topics.map(async (topic: { title: string }) => ({
        ...topic,
        youtubeVideos: await searchYouTubeVideos(topic.title),
      }))
    );

    return NextResponse.json(topicsWithVideos);
  } catch (error: unknown) {
    console.error("Topic generation error:", error);

    const status =
      error !== null && typeof error === "object" && "statusCode" in error
        ? error.statusCode
        : undefined;

    if (status === 503) {
      return NextResponse.json(
        {
          error:
            "Gemini is temporarily busy. Please wait about 30 seconds and try again.",
        },
        { status: 503 }
      );
    }

    if (status === 429) {
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
        error: "Failed to generate topics.",
      },
      { status: 500 }
    );
  }
}