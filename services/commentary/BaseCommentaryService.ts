import {
  footballMatchResponseSchema,
  matchResponseSchema,
  FootballMatchResponse,
  MatchResponse,
} from '../../types/matches';
import { AIService } from '../ai/AIService';
import { ModelAccuracyTracker } from '../ai/ModelAccuracyTracker';
import logger from '../../utils/logger';

export interface BaseMatchData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  weather: {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
  };
  recentMatches: {
    home: string[];
    away: string[];
    between: string[];
  };
}

export type SelectionType = 'Football' | 'Basketball';

export abstract class BaseCommentaryService<T extends BaseMatchData> {
  private aiService = AIService.getInstance();
  private modelAccuracyTracker = ModelAccuracyTracker.getInstance();
  protected abstract generatePrompt(data: T): string;

  /**
   * Updates the accuracy of AI models based on actual match outcomes
   * @param matchId The ID of the match
   * @param actualResult The actual result of the match
   * @param predictions The predictions made by different AI models
   * @param league Optional league information for more specific tracking
   */
  async updateModelAccuracy(
    matchId: string,
    actualResult: {
      homeGoals: number;
      awayGoals: number;
      homeWin: boolean;
      awayWin: boolean;
      draw: boolean;
      over2_5: boolean;
      bothTeamScore: boolean;
    },
    predictions: Array<
      FootballMatchResponse & { provider: 'gemini' | 'openai' | 'cohere' | 'anthropic' | 'mistral' }
    >,
    league?: string
  ): Promise<void> {
    for (const prediction of predictions) {
      // Check if home/away/draw prediction was correct
      const homeWinCorrect =
        prediction.homeTeamWinPercentage > prediction.awayTeamWinPercentage &&
        prediction.homeTeamWinPercentage > prediction.drawPercentage &&
        actualResult.homeWin;

      const awayWinCorrect =
        prediction.awayTeamWinPercentage > prediction.homeTeamWinPercentage &&
        prediction.awayTeamWinPercentage > prediction.drawPercentage &&
        actualResult.awayWin;

      const drawCorrect =
        prediction.drawPercentage > prediction.homeTeamWinPercentage &&
        prediction.drawPercentage > prediction.awayTeamWinPercentage &&
        actualResult.draw;

      // Check if over/under 2.5 prediction was correct
      const over2_5Correct =
        (prediction.over2_5Percentage > 50 && actualResult.over2_5) ||
        (prediction.over2_5Percentage <= 50 && !actualResult.over2_5);

      // Check if both team score prediction was correct
      const bothTeamScoreCorrect =
        (prediction.bothTeamScorePercentage > 50 && actualResult.bothTeamScore) ||
        (prediction.bothTeamScorePercentage <= 50 && !actualResult.bothTeamScore);

      // Check if exact score prediction was correct
      const exactScoreCorrect =
        prediction.predictedScore.home === actualResult.homeGoals &&
        prediction.predictedScore.away === actualResult.awayGoals;

      // Calculate overall correctness (weighted average of different predictions)
      const correctPredictions = [
        homeWinCorrect || awayWinCorrect || drawCorrect ? 1 : 0, // Match outcome
        over2_5Correct ? 1 : 0, // Over/under 2.5
        bothTeamScoreCorrect ? 1 : 0, // Both team score
        exactScoreCorrect ? 1 : 0, // Exact score (weighted more)
      ];

      const weights = [0.4, 0.2, 0.2, 0.2]; // Weights for different prediction types
      const overallCorrectness =
        correctPredictions.reduce((sum, val, idx) => sum + val * weights[idx], 0) >= 0.5;

      // Update model accuracy
      await this.modelAccuracyTracker.updateModelAccuracy(
        prediction.provider,
        overallCorrectness,
        league
      );

      logger.info(
        `Updated accuracy for ${prediction.provider} model: ${overallCorrectness ? 'correct' : 'incorrect'}`
      );
    }
  }

  async generateCommentary(
    data: T,
    selectionType: SelectionType
  ): Promise<(FootballMatchResponse | MatchResponse)[]> {
    const prompt = this.generatePrompt(data);
    try {
      // Get responses from all AI providers
      const responsePromises = [
        this.aiService.getGeminiResponse(prompt),
        this.aiService.getOpenAIResponse(prompt),
        this.aiService.getCohereResponse(prompt),
        this.aiService.getAnthropicResponse(prompt),
        this.aiService.getMistralResponse(prompt),
      ];

      const responses = await Promise.all(responsePromises);
      const providers = ['gemini', 'openai', 'cohere', 'anthropic', 'mistral'] as const;

      const parsedResponses: Array<FootballMatchResponse | MatchResponse> = [];
      const providerIndices: number[] = [];

      // Parse responses
      for (let i = 0; i < responses.length; i++) {
        try {
          // Clean the response by removing markdown formatting
          const cleanJson = (responses[i] || '')
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

          // Parse JSON and validate with schema
          const selection =
            selectionType === 'Football'
              ? footballMatchResponseSchema.parse(JSON.parse(cleanJson))
              : matchResponseSchema.parse(JSON.parse(cleanJson));

          parsedResponses.push(selection);
          providerIndices.push(i);
        } catch (parseError) {
          logger.error(
            `Failed to parse ${providers[i]} response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
          );
          // Continue with other responses instead of failing completely
        }
      }

      if (parsedResponses.length === 0) {
        throw new Error('All AI responses failed validation');
      }

      // Get league information if available
      const league = (data as any).league || undefined;

      // Apply weights based on historical accuracy
      const usedProviders = providerIndices.map((i) => providers[i]);
      const weightedResponses = await this.modelAccuracyTracker.getWeightedResponses(
        parsedResponses,
        usedProviders,
        league
      );

      // Sort by weight (higher weights first)
      weightedResponses.sort((a, b) => b.weight - a.weight);

      // Return the weighted responses (without the weight property in the final result)
      const result = weightedResponses.map(({ weight: _weight, ...rest }) => rest);

      return result;
    } catch (error) {
      logger.error(
        `Error generating commentary: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }
}
