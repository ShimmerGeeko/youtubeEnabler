import { AI_CONFIG } from "@/config/ai";
import type { VideoProvider } from "./videoProvider";
import { AnimatedImageProvider } from "./animatedImageProvider";

export function getVideoProvider(): VideoProvider {
  switch (AI_CONFIG.video.provider) {
    case "animated-image":
      return new AnimatedImageProvider();

    default:
      throw new Error(
        `Unsupported video provider: ${AI_CONFIG.video.provider}`
      );
  }
}