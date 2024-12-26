import { MatchParsedText } from "../../types";
import {
  getGeminiResponse,
  getOpenAIResponse,
  getCohereResponse,
  getAnthropicResponse,
  getMistralResponse,
} from "../../utils/ai";

export async function generateMatchCommentary(
  parsedText: MatchParsedText
): Promise<Object> {
  const prompt = generatePrompt(parsedText);
  try {
    const responses = await Promise.all([
      getGeminiResponse(prompt),
      getOpenAIResponse(prompt),
      getCohereResponse(prompt),
      getAnthropicResponse(prompt),
      getMistralResponse(prompt),
    ]);

    return responses;
  } catch (error) {
    console.error("Error generating content:", error);
    throw error;
  }
}

function generatePrompt(parsedText: MatchParsedText): string {
  const homePlayerAvailabilityList =
    parsedText.unavailablePlayers.home.join("\n");
  const awayPlayerAvailabilityList =
    parsedText.unavailablePlayers.away.join("\n");

  const homeMatchResults = parsedText.recentMatches.home.join("\n");
  const awayMatchResults = parsedText.recentMatches.away.join("\n");
  const betweenMatchResults = parsedText.recentMatches.between.join("\n");

  const prompt = `
You are an AI sports prediction model. Based on the provided match data, generate a JSON response with ONLY the following structure:

Input Data:
- Match: ${parsedText.id}
- Teams: ${parsedText.homeTeam} vs ${parsedText.awayTeam}
- Weather: ${parsedText.weather.temperature}°C, ${parsedText.weather.condition}, Humidity: ${parsedText.weather.humidity}%, Wind: ${parsedText.weather.windSpeed} km/h
- Recent Form ${parsedText.homeTeam}: ${homeMatchResults}
- Recent Form ${parsedText.awayTeam}: ${awayMatchResults}
- H2H History: ${betweenMatchResults}
- ${parsedText.homeTeam} Unavailable: ${homePlayerAvailabilityList}
- ${parsedText.awayTeam} Unavailable: ${awayPlayerAvailabilityList}

Analyze the above data and respond ONLY with a JSON object in this exact format:
{
    "homeTeamWinPercentage": number,
    "awayTeamWinPercentage": number,
    "drawPercentage": number,
    "over2_5Percentage": number,
    "bothTeamScorePercentage": number,
    "halfTimeWinner": "home" | "away" | "draw",
    "halfTimeWinnerPercentage": number,
    "predictedScore": {
        "home": number,
        "away": number
    },
    "predictionConfidence": number,
    "briefComment": "two sentences about the match"
}

Requirements:
1. All percentages must be numbers between 0-100
2. All three win percentages must sum to 100
3. Brief comment must be two sentences only
4. Prediction confidence should reflect how certain the prediction is (0-100)
5. Consider league level, team quality differences, and weather impact in your calculations
6. Base predictions on recent form, H2H history, and team compositions

Return ONLY the JSON object, no additional text.`;

  return prompt;
}

