export interface ImageProvider {
  generateImage(prompt: string): Promise<string>;
}