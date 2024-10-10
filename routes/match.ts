import express from 'express';
import { verifyToken } from '../middleware/auth';
import { generateMatchCommentary } from '../services/matchCommentary';
import { ParsedText } from '../types';
import { analyzeFootballMatch } from '../matchAnalyzer';

const router = express.Router();

router.post('/get-match', async (req, res) => {
    try {
        const result = await analyzeFootballMatch(req.body.homeTeam, req.body.awayTeam);
        //const parsedText: ParsedText = result;
        //const content = await generateMatchCommentary(parsedText);
        res.send(result);
    } catch (error) {
        console.error('Error in /get-match:', error);
        res.status(500).send(`Error generating content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});

export default router;