import { env, FeatureExtractionPipeline, pipeline } from '@xenova/transformers';

import { AI_CONFIG } from '@/config/ai.config';

env.cacheDir = './.cache/transformers_cache';
env.allowLocalModels = true;
env.allowRemoteModels = true;

export class LocalEmbeddingService {
  private modelPromise: Promise<FeatureExtractionPipeline>;

  constructor() {
    this.modelPromise = pipeline(
      AI_CONFIG.EMBEDDING_TOPIC as 'feature-extraction',
      AI_CONFIG.EMBEDDING_MODEL
    ) as Promise<FeatureExtractionPipeline>;

    this.modelPromise.catch((error) => {
      console.error(
        `FATAL: Failed to initialize embedding model ${AI_CONFIG.EMBEDDING_MODEL}:`,
        error
      );
      throw error;
    });
  }

  /**
   * Convert text into a fixed-size vector embedding.
   * Ensures the model is loaded before attempting to embed.
   * @param text The input string to embed.
   * @returns A Promise resolving to an array of numbers representing the embedding.
   */
  async embedText(text: string): Promise<number[]> {
    try {
      const model: FeatureExtractionPipeline = await this.modelPromise;

      // Perform embedding
      // `pooling: 'mean'` averages token embeddings. `normalize: true` normalizes the resulting vector.
      const output = await model(text, { pooling: 'mean', normalize: true });

      // Extract the vector data.
      if (output && output.data && typeof output.data[0] === 'number') {
        return Array.from(output.data as Float32Array);
      } else if (
        output &&
        Array.isArray(output.data) &&
        Array.isArray(output.data[0]) &&
        typeof output.data[0][0] === 'number'
      ) {
        return output.data[0] as number[];
      }

      console.warn('Unexpected embedding output structure in LocalEmbeddingService:', output);
      throw new Error('Failed to extract embedding vector from model output.');
    } catch (error) {
      console.error(`Error during text embedding with model ${AI_CONFIG.EMBEDDING_MODEL}:`, error);
      throw new Error(`Text embedding failed for input: "${text.substring(0, 30)}..."`);
    }
  }
}
