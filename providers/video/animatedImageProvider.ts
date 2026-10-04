import type {
  VideoGenerationOptions,
  VideoProvider,
} from "./videoProvider";

import { animateImage } from "@/media/animation/animateImage";

export class AnimatedImageProvider
  implements VideoProvider
{
  async generateVideo(
    prompt: string,
    options: VideoGenerationOptions
  ): Promise<string> {
    return animateImage(prompt, {
      width: options.width ?? 1080,
      height: options.height ?? 1920,
      durationSeconds: options.durationSeconds,
    });
  }
}