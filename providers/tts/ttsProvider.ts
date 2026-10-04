export type TTSOptions = {
  voice?: string;
  style?: string;
};

export interface TTSProvider {
  generateSpeech(
    text: string,
    options?: TTSOptions
  ): Promise<string>;
}