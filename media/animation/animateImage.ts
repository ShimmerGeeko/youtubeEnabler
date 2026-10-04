import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

import ffmpegPath from "ffmpeg-static";

type AnimateOptions = {
  width: number;
  height: number;
  durationSeconds: number;
};

function runFFmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("FFmpeg binary was not found."));
      return;
    }

    const process = spawn(ffmpegPath, args);

    let stderr = "";

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("error", reject);

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg failed with code ${code}: ${stderr}`
          )
        );
      }
    });
  });
}

export async function animateImage(
  prompt: string,
  options: AnimateOptions
): Promise<string> {
  /*
   * Temporary implementation.
   *
   * This provider will eventually receive an actual
   * generated image file from ImageProvider.
   *
   * For now we create a visual placeholder so the
   * provider architecture is ready.
   */

  const outputDirectory = path.join(
    process.cwd(),
    ".generated-media",
    "scenes"
  );

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const id = randomUUID();

  const imagePath = path.join(
    outputDirectory,
    `${id}.png`
  );

  const videoPath = path.join(
    outputDirectory,
    `${id}.mp4`
  );

  /*
   * Placeholder image.
   *
   * We will replace this with the real image provider
   * once we choose the free image-generation method.
   */

  await runFFmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=${options.width}x${options.height}:d=${options.durationSeconds}`,
    "-vf",
    [
      `scale=${options.width}:${options.height}`,
      `format=yuv420p`,
    ].join(","),
    "-t",
    String(options.durationSeconds),
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    videoPath,
  ]);

  return videoPath;
}