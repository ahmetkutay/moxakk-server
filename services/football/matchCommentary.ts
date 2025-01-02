import { FootballMatchData } from "../../types/matches"
import { BaseCommentaryService } from "../commentary/BaseCommentaryService"

export class FootballCommentaryService extends BaseCommentaryService<FootballMatchData> {
  protected generatePrompt(data: FootballMatchData): string {
    const homePlayerAvailabilityList = data.unavailablePlayers.home.join("\n")
    const awayPlayerAvailabilityList = data.unavailablePlayers.away.join("\n")
    const homeMatchResults = data.recentMatches.home.join("\n")
    const awayMatchResults = data.recentMatches.away.join("\n")
    const betweenMatchResults = data.recentMatches.between.join("\n")

    return `
You are an AI sports prediction model. Based on the provided match data, generate a JSON response with ONLY the following structure:

Input Data:
- Match: ${data.id}
- Teams: ${data.homeTeam} vs ${data.awayTeam}
- Weather: ${data.weather.temperature}°C, ${data.weather.condition}, Humidity: ${data.weather.humidity}%, Wind: ${data.weather.windSpeed} km/h
- Recent Form ${data.homeTeam}: ${homeMatchResults}
- Recent Form ${data.awayTeam}: ${awayMatchResults}
- H2H History: ${betweenMatchResults}
- ${data.homeTeam} Unavailable: ${homePlayerAvailabilityList}
- ${data.awayTeam} Unavailable: ${awayPlayerAvailabilityList}

${this.getPromptRequirements()}`
  }

  private getPromptRequirements(): string {
    return `
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
5. Consider league level, team quality differences, and weather impact
6. Base predictions on recent form, H2H history, and team compositions

Return ONLY the JSON object, no additional text.`
  }
}

export const generateMatchCommentary = new FootballCommentaryService().generateCommentary.bind(new FootballCommentaryService())

