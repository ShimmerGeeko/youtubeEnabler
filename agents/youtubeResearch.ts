export type YouTubeVideo = {
  videoId: string;
  title: string;
  channelTitle: string;
  url: string;
};

type YouTubeSearchItem = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    channelTitle?: string;
  };
};

export async function searchYouTubeVideos(
  query: string
): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) return [];

  const params = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    type: "video",
    maxResults: "3",
    q: query,
    safeSearch: "strict",
  });

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    );

    if (!response.ok) {
      throw new Error(`YouTube API returned ${response.status}.`);
    }

    const result = (await response.json()) as {
      items?: YouTubeSearchItem[];
    };

    return (result.items ?? [])
      .filter(
        (item) =>
          typeof item.id?.videoId === "string" &&
          typeof item.snippet?.title === "string" &&
          typeof item.snippet.channelTitle === "string"
      )
      .map((item) => {
        const videoId = item.id!.videoId!;

        return {
          videoId,
          title: item.snippet!.title!,
          channelTitle: item.snippet!.channelTitle!,
          url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        };
      });
  } catch (error) {
    console.error("YouTube reference search failed:", error);
    return [];
  }
}