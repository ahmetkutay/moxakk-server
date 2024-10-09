import { ParsedText } from '../types';
import { getGeminiResponse, getOpenAIResponse, getCohereResponse, getAnthropicResponse } from '../utils/ai';

export async function generateMatchCommentary(parsedText: ParsedText): Promise<Object> {
    const prompt = generatePrompt(parsedText);
    console.log(prompt);
    try {
        const [geminiResponse, openaiResponse, cohereResponse, anthropicResponse] = await Promise.all([
            getGeminiResponse(prompt),
            getOpenAIResponse(prompt),
            getCohereResponse(prompt),
            getAnthropicResponse(prompt)
        ]);
        
        return {
            gemini: geminiResponse,
            openai: openaiResponse,
            cohere: cohereResponse,
            anthropic: anthropicResponse
        };
    } catch (error) {
        console.error('Error generating content:', error);
        throw error;
    }
}

function generatePrompt(parsedText: ParsedText): string {
    const homePlayerAvailabilityList = parsedText.unavailablePlayers.home.join('\n');
    const awayPlayerAvailabilityList = parsedText.unavailablePlayers.away.join('\n');

    const homeMatchResults = parsedText.recentMatches.home.join('\n');
    const awayMatchResults = parsedText.recentMatches.away.join('\n');
    const betweenMatchResults = parsedText.recentMatches.between.join('\n');

    const prompt = `
You are a renowned sports commentator known for providing insightful, engaging, and data-driven commentary. Analyze the provided information and offer a comprehensive preview for the upcoming match.

*Match:* ${parsedText.id}
*Weather:* ${parsedText.weather.temperature}°C, Condition: ${parsedText.weather.condition}, Humidity: ${parsedText.weather.humidity}%, Wind Speed: ${parsedText.weather.windSpeed} km/h

1. Recent Form Analysis:
   Home Team 
   ${homeMatchResults}

   Away Team
   ${awayMatchResults}

   Analyze the recent performance of both teams, highlighting any trends, strengths, or weaknesses.

2. Head-to-Head History:
   ${betweenMatchResults}

   Discuss the historical performance between these two teams and how it might influence this match.

3. Team Composition:
   Home Team Unavailable Players:
   ${homePlayerAvailabilityList}

   Away Team Unavailable Players:
   ${awayPlayerAvailabilityList}

   Evaluate how the unavailable players might impact each team's strategy and performance.

4. Weather Impact:
   Analyze how the current weather conditions might affect the game play and strategy of both teams.

5. Match Importance:
   Discuss the significance of this match in the context of the current season, league standings, or any relevant competitions.

6. Key Players:
   Identify and discuss key players from both teams who are likely to have a significant impact on the match outcome.

7. Tactical Analysis:
   Based on recent performances and team compositions, predict potential tactical approaches for both teams.

8. Match Prediction:
   Provide a detailed prediction for the match outcome, including:
   - Win probabilities for Home Team, Away Team, and Draw (in percentage)
   - Likely scoreline
   - Over/Under prediction for total goals
   - Any other relevant predictions (e.g., first goal scorer, number of cards)

   Present this information in a clear, tabular format.

9. Final Thoughts:
   Offer any additional insights, exciting elements to watch for, or potential game-changing factors.

Please structure your response clearly, using headings for each section. Aim for a comprehensive, engaging, and insightful match preview that captures the excitement and nuances of the upcoming game.
`;

    return prompt;
}