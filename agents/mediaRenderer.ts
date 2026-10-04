import { GoogleGenAI } from "@google/genai";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const VIDEO_FPS = 24;

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
  }[];
};

type Scene = {
  visual: string;
  narration: string;
};

export type RenderedVideo = {
  id: string;
  title: string;
  durationSeconds: number;
};

function cleanNarration(text: string) {
  return text
    .replace(/\[SCENE (?:START|END)\]/gi, "")
    .replace(/\[VISUAL:[\s\S]*?\]/gi, "")
    .replace(/NARRATOR\s*\(V\.O\.\)/gi, "")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

function makeScenes(script: Script): Scene[] {
  if (Array.isArray(script.scenes)) {
    const generatedScenes = script.scenes
      .map((scene) => ({
        visual:
          scene.visualPrompt.trim() ||
          scene.caption.trim() ||
          `Scene ${scene.id}`,
        narration: scene.narration.trim(),
      }))
      .filter((scene) => scene.narration.length > 0);

    if (generatedScenes.length > 0) return generatedScenes;
  }

  const scriptText = script.script;
  const scenes: Scene[] = [];
  const visualCue = /\[VISUAL:\s*([\s\S]*?)\]/gi;
  let cursor = 0;
  let activeVisual = "Opening sequence";
  let match: RegExpExecArray | null;

  while ((match = visualCue.exec(scriptText)) !== null) {
    const narration = cleanNarration(scriptText.slice(cursor, match.index));
    if (narration) scenes.push({ visual: activeVisual, narration });

    activeVisual = match[1].replace(/\s+/g, " ").trim();
    cursor = visualCue.lastIndex;
  }

  const finalNarration = cleanNarration(scriptText.slice(cursor));
  if (finalNarration) scenes.push({ visual: activeVisual, narration: finalNarration });

  if (scenes.length > 0) return scenes;

  const paragraphs = cleanNarration(scriptText)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.map((narration, index) => ({
    visual: `Scene ${index + 1}`,
    narration,
  }));
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxCharacters: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (nextLine.length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  }
  if (line) lines.push(line);

  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:]?$/, "")}...`;
  }

  return lines;
}

function makeSceneSvg(
  title: string,
  scene: Scene,
  sceneNumber: number,
  sceneCount: number
) {
  const titleLines = wrapText(scene.visual, 38, 3);
  const narrationLines = wrapText(scene.narration, 76, 3);
  const titleMarkup = titleLines
    .map(
      (line, index) =>
        `<tspan x="104" dy="${index === 0 ? 0 : 62}">${escapeXml(line)}</tspan>`
    )
    .join("");
  const narrationMarkup = narrationLines
    .map(
      (line, index) =>
        `<tspan x="108" dy="${index === 0 ? 0 : 30}">${escapeXml(line)}</tspan>`
    )
    .join("");
  const progressWidth = Math.round((sceneNumber / sceneCount) * 1072);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" viewBox="0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#101a2a" />
      <stop offset="0.56" stop-color="#173642" />
      <stop offset="1" stop-color="#8b4b31" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-opacity=".055" stroke-width="1" />
    </pattern>
    <linearGradient id="rule" x1="0" x2="1">
      <stop offset="0" stop-color="#e5ad57" />
      <stop offset="1" stop-color="#69c6bd" />
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#background)" />
  <rect width="1280" height="720" fill="url(#grid)" />
  <circle cx="1090" cy="175" r="174" fill="#e5ad57" fill-opacity=".12" />
  <circle cx="1090" cy="175" r="128" fill="none" stroke="#f1d39d" stroke-opacity=".28" stroke-width="2" />
  <path d="M 878 548 C 1002 443 1094 650 1270 510" fill="none" stroke="#69c6bd" stroke-opacity=".7" stroke-width="3" />
  <path d="M 920 588 C 1044 483 1136 690 1312 550" fill="none" stroke="#69c6bd" stroke-opacity=".3" stroke-width="2" />
  <text x="106" y="82" fill="#8ed9d1" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2">FIELD NOTES  /  ${String(sceneNumber).padStart(2, "0")}</text>
  <text x="106" y="128" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="17" opacity=".76">${escapeXml(title)}</text>
  <text x="104" y="270" fill="#fff8ec" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="700">${titleMarkup}</text>
  <path d="M 108 482 H 438" stroke="url(#rule)" stroke-width="4" />
  <text x="108" y="530" fill="#e4e8e6" font-family="Segoe UI, Arial, sans-serif" font-size="21" opacity=".88">${narrationMarkup}</text>
  <text x="108" y="650" fill="#d5c29f" font-family="Segoe UI, Arial, sans-serif" font-size="15" letter-spacing="1">DOCUMENTARY AUTOMATION  /  ${String(sceneNumber).padStart(2, "0")} OF ${String(sceneCount).padStart(2, "0")}</text>
  <rect x="108" y="674" width="1072" height="3" rx="2" fill="#ffffff" fill-opacity=".24" />
  <rect x="108" y="674" width="${progressWidth}" height="3" rx="2" fill="url(#rule)" />
</svg>`;
}

function runProcess(executable: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = `${stdout}${chunk.toString()}`.slice(-12000);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-12000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `${path.basename(executable)} exited with code ${code}.`));
    });
  });
}

async function makeNarration(script: string, destination: string) {
  const narration = cleanNarration(script);
  if (!narration) throw new Error("This script has no narration to render.");

  const interaction = await ai.interactions.create({
    model: "gemini-3.8-flash-tts",
    input: [
      {
        type: "user_input",
        content: [{ type: "text", text: narration }],
      },
    ],
    response_format: { type: "audio" },
    generation_config: {
      speech_config: [{ voice: "Charon" }],
    },
  });

  const audioData = interaction.output_audio?.data;
  if (typeof audioData !== "string") {
    throw new Error("Gemini TTS did not return audio data.");
  }

  await writeFile(destination, Buffer.from(audioData, "base64"));
}

async function getMediaDuration(filePath: string) {
  if (!ffprobe.path) throw new Error("FFprobe is not available on this system.");

  const output = await runProcess(ffprobe.path, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number(output.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not determine the generated narration duration.");
  }
  return duration;
}

async function renderScene(
  scene: Scene,
  index: number,
  sceneCount: number,
  title: string,
  durationSeconds: number,
  directory: string
) {
  if (!ffmpegPath) throw new Error("FFmpeg is not available on this system.");

  const imagePath = path.join(directory, `scene-${index}.png`);
  const videoPath = path.join(directory, `scene-${index}.mp4`);

  await sharp(Buffer.from(makeSceneSvg(title, scene, index + 1, sceneCount)))
    .png()
    .toFile(imagePath);

  const zoompan =
    "zoompan=z='min(zoom+0.00035,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=24,format=yuv420p";

  await runProcess(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-loop", "1", "-framerate", String(VIDEO_FPS), "-i", imagePath,
    "-vf", zoompan,
    "-t", durationSeconds.toFixed(3),
    "-r", String(VIDEO_FPS),
    "-an",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "27",
    "-movflags", "+faststart",
    videoPath,
  ]);

  return videoPath;
}

export async function renderScriptVideo(script: Script): Promise<RenderedVideo> {
  if (!script.title || !script.script) {
    throw new Error("A script title and narration are required to render a video.");
  }

  const outputDirectory = path.join(process.cwd(), ".generated-media");
  await mkdir(outputDirectory, { recursive: true });

  const id = randomUUID();
  const tempDirectory = await mkdtemp(path.join(tmpdir(), "ai-content-video-"));
  const narrationPath = path.join(tempDirectory, "narration.wav");
  const concatPath = path.join(tempDirectory, "scenes.txt");
  const outputPath = path.join(outputDirectory, `${id}.mp4`);

  try {
    await makeNarration(script.script, narrationPath);
    const audioDuration = await getMediaDuration(narrationPath);
    const scenes = makeScenes(script);
    const wordCounts = scenes.map(
      (scene) => scene.narration.split(/\s+/).filter(Boolean).length
    );
    const totalWords = wordCounts.reduce((total, words) => total + words, 0);

    if (totalWords === 0) throw new Error("No narration scenes could be prepared.");

    const sceneFiles: string[] = [];
    let usedDuration = 0;

    for (let index = 0; index < scenes.length; index++) {
      const duration =
        index === scenes.length - 1
          ? audioDuration - usedDuration
          : (audioDuration * wordCounts[index]) / totalWords;
      usedDuration += duration;
      sceneFiles.push(
        await renderScene(
          scenes[index],
          index,
          scenes.length,
          script.title,
          duration,
          tempDirectory
        )
      );
    }

    const concatEntries = sceneFiles
      .map((file) => `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(concatPath, concatEntries, "utf8");

    if (!ffmpegPath) throw new Error("FFmpeg is not available on this system.");
    await runProcess(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "concat", "-safe", "0", "-i", concatPath,
      "-i", narrationPath,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
      "-shortest", "-movflags", "+faststart",
      outputPath,
    ]);

    return {
      id,
      title: script.title,
      durationSeconds: Math.round(audioDuration),
    };
  } catch (error) {
    await rm(outputPath, { force: true });
    throw error;
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}