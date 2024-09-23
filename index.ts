import express from 'express';
import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = 8080;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Define TypeScript interfaces
interface Player {
    player: string;
    availability: string;
}

interface Availability {
    availabilityList: Player[];
}

interface MatchDetail {
    type: string;
    result: string;
}

interface ParsedText {
    match: string;
    importance: string;
    temperature: string;
    rain: string;
    wind: string;
    pitchCondition: string;
    homeAvailabilityList: Player[];
    awayAvailabilityList: Player[];
    homeForm: string;
    awayForm: string;
    homeRank: string;
    awayRank: string;
    matchDetails: MatchDetail[];
}

async function generateVacationRoute(parsedText: ParsedText): Promise<string> {
    if (!process.env.GOOGLE_API_KEY) {
        throw new Error('Google API key is missing');
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string);
    const model: GenerativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert players list to a formatted string
    const homePlayerAvailabilityList = parsedText.homeAvailabilityList.map(player =>
        `Name: ${player.player}, Status: ${player.availability}`).join('\n');

    const awayPlayerAvailabilityList = parsedText.awayAvailabilityList.map(player =>
        `Name: ${player.player}, Status: ${player.availability}`).join('\n');

    // Prepare match results from matchDetails
    const homeMatchResults = parsedText.matchDetails
        .filter(detail => detail.type === 'Home Match')
        .map(detail => detail.result).join('\n');

    const awayMatchResults = parsedText.matchDetails
        .filter(detail => detail.type === 'Away Match')
        .map(detail => detail.result).join('\n');

    const betweenMatchResults = parsedText.matchDetails
        .filter(detail => detail.type === 'Between Match')
        .map(detail => detail.result).join('\n');

    const prompt = `
You are a renowned sports commentator known for providing insightful and engaging commentary. Use the data provided below and your expertise to comment on the upcoming match.

*Match:* ${parsedText.match}
*Importance:* ${parsedText.importance}
The Match Weather is ${parsedText.temperature}, rain: ${parsedText.rain}, the wind: ${parsedText.wind}, the pitch condition: ${parsedText.pitchCondition}

Home Team Form is old to recent: ${parsedText.homeForm}
Away Team Form is old to recent: ${parsedText.awayForm}

### Home Team Availability:
Here these are not playing due to their reasoning:
${homePlayerAvailabilityList}

### Away Team Availability:
Here these are not playing due to their reasoning:
${awayPlayerAvailabilityList}

### Home Team Previous Matches and use Table format:
${homeMatchResults}

### Away Team Previous Matches and use Table format:
${awayMatchResults}

### Previous Matches Between Teams and use Table format:
${betweenMatchResults}

Now, using the information provided and your expertise, please provide a detailed commentary on the match and also return the probabilities of the side. And return and extended comment from your side for the following teams.

Then you should return HomeTeam,AwayTeam and Draw possibilities,
then look for both team score,over/under
then possible score you expect
please return as table format
`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating content:', error);
        throw error;
    }
}


app.post('/get-match', async (req, res) => {
    try {
        const parsedText: ParsedText = req.body;

        const content = await generateVacationRoute(parsedText);
        res.send(content);
    } catch (error) {
        console.error('Error in /get-match:', error);
        res.status(500).send('Error generating content');
    }
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack); // Log error details
    res.status(500).send('Something went wrong!');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
