import express from 'express';
import { z } from 'zod';
import { createMatchRoute } from './base-route';
import { FootballCommentaryService } from '../services/football/matchCommentary';
import { BasketballCommentaryService } from '../services/basketball/basketballCommentary';
import { analyzeFootballMatch } from '../services/football/matchAnalyzer';
import { analyzeBasketballMatch } from '../services/basketball/basketballAnalyzer';
import { FootballMatchData, BasketballMatchData } from '../types/matches';
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
