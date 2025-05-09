import express from 'express';
import { z } from 'zod';
import { createMatchRoute } from './base-route';
import { FootballCommentaryService } from '../services/football/matchCommentary';
import { BasketballCommentaryService } from '../services/basketball/basketballCommentary';
import { analyzeFootballMatch } from '../services/football/matchAnalyzer';
import { analyzeBasketballMatch } from '../services/basketball/basketballAnalyzer';
import { FootballMatchData, BasketballMatchData, FootballMatchResponse } from '../types/matches';
import { asyncHandler } from '../utils/error-handler';

const router = express.Router();
const v1Router = express.Router();

const matchRequestSchema = z.object({
  homeTeam: z.string().min(1, 'Home team is required'),
  awayTeam: z.string().min(1, 'Away team is required'),
});

type MatchInput = {
  homeTeam: string;
  awayTeam: string;
};

const footballCommentary = new FootballCommentaryService();
const basketballCommentary = new BasketballCommentaryService();

// Football routes
v1Router.post(
  '/football/analyze',
  createMatchRoute<MatchInput, FootballMatchData>({
    inputSchema: matchRequestSchema,
    analyzer: analyzeFootballMatch,
    commentaryGenerator: (data) => footballCommentary.generateCommentary(data, 'Football'),
  })
);

// Basketball routes
v1Router.post(
  '/basketball/analyze',
  createMatchRoute<MatchInput, BasketballMatchData>({
    inputSchema: matchRequestSchema,
    analyzer: analyzeBasketballMatch,
    commentaryGenerator: (data) => basketballCommentary.generateCommentary(data, 'Basketball'),
  })
);

// Update model accuracy with actual match results
v1Router.post(
  '/football/update-accuracy',
  asyncHandler(async (req, res) => {
    const updateSchema = z.object({
      matchId: z.string(),
      homeGoals: z.number().int().min(0),
      awayGoals: z.number().int().min(0),
      predictions: z.array(
        z.object({
          provider: z.enum(['gemini', 'openai', 'cohere', 'anthropic', 'mistral']),
          homeTeamWinPercentage: z.number().min(0).max(100),
          awayTeamWinPercentage: z.number().min(0).max(100),
          drawPercentage: z.number().min(0).max(100),
          over2_5Percentage: z.number().min(0).max(100),
          bothTeamScorePercentage: z.number().min(0).max(100),
          predictedScore: z.object({
            home: z.number(),
            away: z.number(),
          }),
        })
      ),
      league: z.string().optional(),
    });

    try {
      const data = updateSchema.parse(req.body);

      // Calculate actual results
      const actualResult = {
        homeGoals: data.homeGoals,
        awayGoals: data.awayGoals,
        homeWin: data.homeGoals > data.awayGoals,
        awayWin: data.awayGoals > data.homeGoals,
        draw: data.homeGoals === data.awayGoals,
        over2_5: data.homeGoals + data.awayGoals > 2.5,
        bothTeamScore: data.homeGoals > 0 && data.awayGoals > 0,
      };

      // Update model accuracy
      await footballCommentary.updateModelAccuracy(
        data.matchId,
        actualResult,
        data.predictions as Array<
          FootballMatchResponse & {
            provider: 'gemini' | 'openai' | 'cohere' | 'anthropic' | 'mistral';
          }
        >,
        data.league
      );

      return res.status(200).json({
        success: true,
        message: 'Model accuracy updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }
      throw error;
    }
  })
);

// Health check endpoint
v1Router.get(
  '/health',
  asyncHandler(async (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  })
);

// Mount v1 routes
router.use('/v1', v1Router);

// Legacy routes for backward compatibility
router.post(
  '/get-match',
  createMatchRoute<MatchInput, FootballMatchData>({
    inputSchema: matchRequestSchema,
    analyzer: analyzeFootballMatch,
    commentaryGenerator: (data) => footballCommentary.generateCommentary(data, 'Football'),
  })
);

router.post(
  '/get-basketball',
  createMatchRoute<MatchInput, BasketballMatchData>({
    inputSchema: matchRequestSchema,
    analyzer: analyzeBasketballMatch,
    commentaryGenerator: (data) => basketballCommentary.generateCommentary(data, 'Basketball'),
  })
);

export default router;
