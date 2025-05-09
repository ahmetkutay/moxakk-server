import { redisClient } from '../../config/db';

export interface ModelAccuracy {
  provider: 'gemini' | 'openai' | 'cohere' | 'anthropic' | 'mistral';
  correctPredictions: number;
  totalPredictions: number;
  leagueSpecificAccuracy: Record<string, { correct: number; total: number }>;
}

export class ModelAccuracyTracker {
  private static instance: ModelAccuracyTracker | null = null;

  private constructor() {}

  static getInstance(): ModelAccuracyTracker {
    if (!this.instance) {
      this.instance = new ModelAccuracyTracker();
    }
    return this.instance;
  }

  async getModelAccuracy(provider: string): Promise<ModelAccuracy | null> {
    const key = `model:accuracy:${provider}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }

  async updateModelAccuracy(provider: string, wasCorrect: boolean, league?: string): Promise<void> {
    const key = `model:accuracy:${provider}`;
    const existingData = await this.getModelAccuracy(provider);
    const data: ModelAccuracy = existingData || {
      provider: provider as ModelAccuracy['provider'],
      correctPredictions: 0,
      totalPredictions: 0,
      leagueSpecificAccuracy: {},
    };

    // Update overall accuracy
    data.totalPredictions++;
    if (wasCorrect) data.correctPredictions++;

    // Update league-specific accuracy if provided
    if (league) {
      if (!data.leagueSpecificAccuracy[league]) {
        data.leagueSpecificAccuracy[league] = { correct: 0, total: 0 };
      }
      data.leagueSpecificAccuracy[league].total++;
      if (wasCorrect) data.leagueSpecificAccuracy[league].correct++;
    }

    await redisClient.set(key, JSON.stringify(data));
  }

  async getWeightedResponses<T>(
    responses: T[],
    providers: ('gemini' | 'openai' | 'cohere' | 'anthropic' | 'mistral')[],
    league?: string
  ): Promise<Array<T & { weight: number }>> {
    const accuracyData = await Promise.all(providers.map((p) => this.getModelAccuracy(p)));

    // Calculate weights based on historical accuracy
    const weights = accuracyData.map((data) => {
      if (!data || data.totalPredictions === 0) return 1; // Default weight

      // Use league-specific accuracy if available
      if (league && data.leagueSpecificAccuracy[league]?.total > 10) {
        const leagueAcc = data.leagueSpecificAccuracy[league];
        return (leagueAcc.correct / leagueAcc.total) * 2; // Double weight for league-specific accuracy
      }

      return data.correctPredictions / data.totalPredictions;
    });

    // Apply weights to responses
    return responses.map((response, index) => ({
      ...response,
      weight: weights[index],
    }));
  }
}
