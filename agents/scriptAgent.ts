import { GoogleGenAI } from "@google/genai";

export type VideoScene = {
  id: number;
  durationSeconds: number;
  narration: string;
  visualPrompt: string;
  caption: string;
  animationType:
    | "zoom-in"
    | "zoom-out"
    | "pan-left"
    | "pan-right"
    | "slow-drift"
    | "shake"
    | "pulse";
};

export type GeneratedScript = {
  title: string;
  hook: string;
  script: string;
  estimatedDurationSeconds: number;
  scenes: VideoScene[];
};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function cleanJson(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function runScriptAgent(topic: {
  title: string;
  description: string;
  source: string;
}): Promise<GeneratedScript> {
  const interaction = await ai.interactions.create({
    model: "gemini-3.8-flash",

    generation_config: {
      thinking_level: "low",
    },

    input: `
You are a professional YouTube Shorts documentary writer.

Create a scientifically grounded 45–60 second YouTube Short.

TOPIC:
${topic.title}

DESCRIPTION:
${topic.description}

SOURCE:
${topic.source}

IMPORTANT REQUIREMENTS:

1. The total video must be between 45 and 60 seconds.
2. Prefer approximately 50 seconds.
3. Create exactly 7 scenes.
4. Each scene should be approximately 6–8 seconds.
5. The narration must be concise enough to fit the scene duration.
6. Start with a very strong hook.
7. Keep the science accurate.
8. Never present speculation as established fact.
9. Do not invent sources.
10. Make the narration engaging and documentary-like.
11. Every scene needs a visual prompt.
12. Visual prompts must describe MOVEMENT and CAMERA behavior.
13. Visual prompts must work for a vertical 9:16 video.
14. Do not request text inside the generated visuals.
15. Do not request logos or watermarks.
16. Visuals should look cinematic and realistic.
17. The scenes should visually progress with the narration.
18. The final scene should provide a memorable conclusion.

Animation types must be one of:

zoom-in
zoom-out
pan-left
pan-right
slow-drift
shake
pulse

Return ONLY valid JSON.

FORMAT:

{
  "title": "Short title",
  "hook": "Opening hook",
  "script": "Complete narration",
  "estimatedDurationSeconds": 50,
  "scenes": [
    {
      "id": 1,
      "durationSeconds": 7,
      "narration": "Narration for this scene",
      "visualPrompt": "Detailed cinematic visual description including camera movement",
      "caption": "Short caption",
      "animationType": "zoom-in"
    }
  ]
}
`,
  });

  if (typeof interaction.output_text !== "string") {
    throw new Error("Gemini returned an empty response.");
  }

  const text = cleanJson(interaction.output_text);

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Invalid script JSON:", text);
    throw new Error("Gemini returned invalid script JSON.");
  }

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error("Invalid script response.");
  }

  const result = parsed as Record<string, unknown>;

  if (
    typeof result.title !== "string" ||
    typeof result.hook !== "string" ||
    typeof result.script !== "string" ||
    !Array.isArray(result.scenes)
  ) {
    throw new Error(
      "Script response is missing required fields."
    );
  }

  const allowedAnimations: VideoScene["animationType"][] = [
    "zoom-in",
    "zoom-out",
    "pan-left",
    "pan-right",
    "slow-drift",
    "shake",
    "pulse",
  ];

  const scenes: VideoScene[] = result.scenes.map(
    (scene: unknown, index: number) => {
      const value =
        scene !== null &&
        typeof scene === "object" &&
        !Array.isArray(scene)
          ? (scene as Record<string, unknown>)
          : {};

      const requestedAnimation =
        typeof value.animationType === "string"
          ? value.animationType
          : "slow-drift";

      return {
        id: Number(value.id) || index + 1,
        durationSeconds: Number(value.durationSeconds) || 7,
        narration:
          typeof value.narration === "string"
            ? value.narration
            : "",
        visualPrompt:
          typeof value.visualPrompt === "string"
            ? value.visualPrompt
            : "",
        caption:
          typeof value.caption === "string"
            ? value.caption
            : "",
        animationType: allowedAnimations.includes(
          requestedAnimation as VideoScene["animationType"]
        )
          ? (requestedAnimation as VideoScene["animationType"])
          : "slow-drift",
      };
    }
  );

  const duration = scenes.reduce(
    (total, scene) => total + scene.durationSeconds,
    0
  );

  if (scenes.length < 5) {
    throw new Error(
      "Script Agent generated too few scenes."
    );
  }

  return {
    title: result.title,
    hook: result.hook,
    script: result.script,
    estimatedDurationSeconds: duration,
    scenes,
  };
}