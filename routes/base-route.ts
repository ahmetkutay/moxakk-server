import { z } from 'zod';
import { Request, Response } from 'express';
import { FootballMatchResponse, MatchResponse } from '../types/matches';
import logger from '../utils/logger';

interface BaseInput {
  homeTeam: string;
  awayTeam: string;
}

export interface RouteConfig<TInput extends BaseInput, TData> {
  inputSchema: z.ZodType<TInput>;
  analyzer: (homeTeam: string, awayTeam: string) => Promise<TData>;
  commentaryGenerator: (data: TData) => Promise<(FootballMatchResponse | MatchResponse)[]>;
}

export function createMatchRoute<TInput extends BaseInput, TData>({
  inputSchema,
  analyzer,
  commentaryGenerator,
}: RouteConfig<TInput, TData>) {
  return async (req: Request, res: Response): Promise<Response> => {
    try {
      const validatedInput = inputSchema.parse(req.body) as TInput;

      const result = await analyzer(validatedInput.homeTeam, validatedInput.awayTeam);

      const content = await commentaryGenerator(result);

      return res.status(200).json({
        success: true,
        content,
        refereeStats: (result as any).refereeStats || undefined,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Validation error: ${JSON.stringify(error.errors)}`);
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error in match route: ${errorMessage}`);

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: errorMessage,
      });
    }
  };
}
