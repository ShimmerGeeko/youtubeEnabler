import { GoogleGenAI } from "@google/genai";
import type { TTSProvider, TTSOptions } from "./ttsProvider";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const geminiTTSProvider: TTSProvider = {
  async generateSpeech(
    text: string,
    _options?: TTSOptions
  ): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: text,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Kore",
            },
          },
        },
      },
    });

    const audioData =
      response.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.data
      )?.inlineData?.data;

    if (!audioData) {
      throw new Error("Gemini TTS did not return audio data.");
    }

    // Return base64 string because TTSProvider expects Promise<string>
    return audioData;
  },
};

