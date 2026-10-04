export type VideoGenerationOptions = {
  width?: number;
  height?: number;
  durationSeconds: number;
};

export interface VideoProvider {
  generateVideo(
    prompt: string,
    options: VideoGenerationOptions
  ): Promise<string>;
}