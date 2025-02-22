import express from "express";
import { z } from "zod";
import { createMatchRoute } from "./base-route";
import { FootballCommentaryService } from "../services/football/matchCommentary";
import { BasketballCommentaryService } from "../services/basketball/basketballCommentary";
import { analyzeFootballMatch } from "../services/football/matchAnalyzer";
import { analyzeBasketballMatch } from "../services/basketball/basketballAnalyzer";
import { FootballMatchData, BasketballMatchData } from "../types/matches";

const router = express.Router();

const matchRequestSchema = z.object({
  homeTeam: z.string().min(1, "Home team is required"),
  awayTeam: z.string().min(1, "Away team is required"),
});

type MatchInput = {
  homeTeam: string
  awayTeam: string
}

const footballCommentary = new FootballCommentaryService()
const basketballCommentary = new BasketballCommentaryService()

// Football route
router.post("/get-match", createMatchRoute<MatchInput, FootballMatchData>({
  inputSchema: matchRequestSchema,
  analyzer: analyzeFootballMatch,
  commentaryGenerator: (data) => footballCommentary.generateCommentary(data, "Football")
}));

// Basketball route
router.post("/get-basketball", createMatchRoute<MatchInput, BasketballMatchData>({
  inputSchema: matchRequestSchema,
  analyzer: analyzeBasketballMatch,
  commentaryGenerator: (data) => basketballCommentary.generateCommentary(data, "Basketball")
}));

export default router;
