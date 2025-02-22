import { BasketballMatchData } from "../../types/matches"
import { BaseCommentaryService } from "../commentary/BaseCommentaryService"
import { matchResponseSchema } from "../../types/matches"

export class BasketballCommentaryService extends BaseCommentaryService<BasketballMatchData> {
  protected getResponseSchema() {
    return matchResponseSchema
  }

  protected generatePrompt(data: BasketballMatchData): string {
    const homeMatchResults = data.recentMatches.home.join("\n")
    const awayMatchResults = data.recentMatches.away.join("\n")
    const betweenMatchResults = data.recentMatches.between.join("\n")

    return `
You are an AI sports prediction model. Based on the provided match data, generate a JSON response with ONLY the following structure:
You are a renowned sports commentator known for providing insightful, engaging, and data-driven commentary.

Input Data:
- Basketball Match: ${data.id}
- Teams: ${data.homeTeam} vs ${data.awayTeam}
- Weather: ${data.weather.temperature}°C, ${data.weather.condition}, Humidity: ${data.weather.humidity}%, Wind: ${data.weather.windSpeed} km/h
- Recent Form ${data.homeTeam}: ${homeMatchResults}
- Recent Form ${data.awayTeam}: ${awayMatchResults}
- H2H History: ${betweenMatchResults}

${this.getPromptRequirements()}`
  }

  private getPromptRequirements(): string {
    return `
Analyze the above data and respond ONLY with a JSON object in this exact format:
{
    "homeTeamWinPercentage": number,
    "awayTeamWinPercentage": number,
    "predictedScore": {
        "home": number,
        "away": number
    },
    "predictionConfidence": number,
    "briefComment": "two sentences about the match"
}

Requirements:
1. All percentages must be numbers between 0-100
2. Home and away win percentages must sum to 100
3. Brief comment must be two sentences only
4. Prediction confidence should reflect how certain the prediction is (0-100)
5. Consider league level, team quality differences, and weather impact
6. Base predictions on recent form, H2H history, and team compositions

Return ONLY the JSON object, no additional text.`
  }
}

export const generateBasketballCommentary = new BasketballCommentaryService().generateCommentary.bind(new BasketballCommentaryService())
