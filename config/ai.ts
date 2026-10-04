export const AI_CONFIG = {
  text: {
    provider: "gemini",
    model: "gemini-3.8-flash",
  },

  image: {
    provider: "placeholder",
  },

  video: {
    provider: "animated-image",
  },

  tts: {
    provider: "gemini",
    model: "gemini-3.8-flash-tts",
    voice: "Kore",
  },
} as const;