import { AI_CONFIG } from "@/config/ai";
import type { TTSProvider } from "./ttsProvider";
import { GeminiTTSProvider } from "./geminiTTSProvider";

export function getTTSProvider(): TTSProvider {
  switch (AI_CONFIG.tts.provider) {
    case "gemini":
      return new GeminiTTSProvider();

    default:
      throw new Error(
        `Unsupported TTS provider: ${AI_CONFIG.tts.provider}`
      );
  }
}