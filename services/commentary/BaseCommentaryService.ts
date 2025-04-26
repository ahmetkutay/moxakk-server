import {
  footballMatchResponseSchema,
  matchResponseSchema,
  FootballMatchResponse,
  MatchResponse,
} from '../../types/matches';
import { AIService } from '../ai/AIService';
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
  protected abstract generatePrompt(data: T): string;
  private aiService = AIService.getInstance();

  async generateCommentary(
    data: T,
    selectionType: SelectionType
  ): Promise<(FootballMatchResponse | MatchResponse)[]> {
    const prompt = this.generatePrompt(data);
    try {
      const responses = await Promise.all([
        this.aiService.getGeminiResponse(prompt),
        this.aiService.getOpenAIResponse(prompt),
        this.aiService.getCohereResponse(prompt),
        this.aiService.getAnthropicResponse(prompt),
        this.aiService.getMistralResponse(prompt),
      ]);

      const result: (FootballMatchResponse | MatchResponse)[] = [];

      for (const response of responses) {
        try {
          // Clean the response by removing markdown formatting
          const cleanJson = response
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

          // Parse JSON and validate with schema
          const selection =
            selectionType === 'Football'
              ? footballMatchResponseSchema.parse(JSON.parse(cleanJson))
              : matchResponseSchema.parse(JSON.parse(cleanJson));

          result.push(selection);
        } catch (parseError) {
          logger.error(
            `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
          );
          // Continue with other responses instead of failing completely
        }
      }

      if (result.length === 0) {
        throw new Error('All AI responses failed validation');
      }

      return result;
    } catch (error) {
      logger.error(
        `Error generating commentary: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }
}
