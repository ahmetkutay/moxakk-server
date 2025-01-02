import express from "express";
import { generateBasketballCommentary } from "../services/basketball/basketballCommentary";
import { BasketballMatchData } from "../types/matches";
import { analyzeBasketballMatch } from "../services/basketball/basketballAnalyzer";

const router = express.Router();

router.post("/get-basketball", async (req, res) => {
  try {
    const { homeTeam, awayTeam } = req.body;
    if (!homeTeam || !awayTeam) {
      return res.status(400).json({
        error: "Missing required fields: homeTeam and awayTeam are required"
      });
    }

    const result = await analyzeBasketballMatch(homeTeam, awayTeam);
    const parsedText: BasketballMatchData = result;
    
    const content = await generateBasketballCommentary(parsedText);
    
    return res.json({ success: true, content });
  } catch (error) {
    console.error("Error in /get-basketball:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
