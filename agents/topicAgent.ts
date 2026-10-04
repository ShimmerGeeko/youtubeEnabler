
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function runTopicAgent() {
  const interaction = await ai.interactions.create({
    model: "gemini-3.8-flash",
    input: `
Generate 5 interesting, scientifically grounded topics for a
documentary-style YouTube channel about doomsday and extreme-event scenarios.

Focus on topics such as:
- asteroid impacts
- supervolcanoes
- solar storms
- extreme climate events
- pandemics
- earthquakes
- AI-related risks
- large-scale natural disasters

Avoid unsupported predictions and sensational claims.

Return ONLY a valid JSON array.

Each item must contain exactly these fields:
- title
- description
- source

Example:
[
  {
    "title": "Example title",
    "description": "Short description",
    "source": "NASA"
  }
]
    `,
  });

  const text = interaction.output_text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const cleanedText = text
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleanedText);
}

