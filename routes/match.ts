import express from "express";
import { generateMatchCommentary } from "../services/matchCommentary";
import { ParsedText } from "../types";
import { analyzeFootballMatch } from "../services/matchAnalyzer";

const router = express.Router();

router.post("/get-match", async (req, res) => {
  try {
    const { homeTeam, awayTeam } = req.body;
    if (!homeTeam || !awayTeam) {
      return res.status(400).json({
        error: "Missing required fields: homeTeam and awayTeam are required"
      });
    }

    const result = await analyzeFootballMatch(homeTeam, awayTeam);
    const parsedText: ParsedText = result;
    
    const content = await generateMatchCommentary(parsedText);
    
    return res.json({ success: true, content });
  } catch (error) {
    console.error("Error in /get-match:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
