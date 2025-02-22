import {FootballMatchData} from "../../types/matches"
import {BaseCommentaryService} from "../commentary/BaseCommentaryService"
import logger from "../../utils/logger";
import { footballMatchResponseSchema } from "../../types/matches"


export class FootballCommentaryService extends BaseCommentaryService<FootballMatchData> {
    protected generatePrompt(data: FootballMatchData): string {
        const homePlayerAvailabilityList = data.unavailablePlayers.home.join("\n")
        const awayPlayerAvailabilityList = data.unavailablePlayers.away.join("\n")
        const homeMatchResults = data.recentMatches.home.join("\n")
        const awayMatchResults = data.recentMatches.away.join("\n")
        const betweenMatchResults = data.recentMatches.between.join("\n")
        const homeTeamStanding = data.standings.home
        const awayTeamStanding = data.standings.away

        // Format lineup players
        const formatLineup = (players: any[]) => {
            return players.map(player =>
                `${player.number}. ${player.name} (${player.position})`
            ).join("\n")
        }

        // Get formations and lineups if available
        // @ts-ignore
        const homeFormation = data.teamLineups.home.formation || "Unknown"
        // @ts-ignore
        const awayFormation = data.teamLineups.away.formation || "Unknown"
        // @ts-ignore
        const homeLineup = data.teamLineups.home.players || []
        // @ts-ignore
        const awayLineup =  data.teamLineups.away.players || []
        let prompt = `
You are an expert football analyst and prediction model. Based on the provided match data, generate a detailed predictive analysis.

Match Information:
- ID: ${data.id}
- Teams: ${data.homeTeam} vs ${data.awayTeam}

Team Formations and Lineups:
${data.homeTeam} (${homeFormation}):
${formatLineup(homeLineup)}

${data.awayTeam} (${awayFormation}):
${formatLineup(awayLineup)}

Standings:
${data.homeTeam} Standings:
- Position: ${homeTeamStanding.overall.position}
- Played: ${homeTeamStanding.overall.played}
- Won: ${homeTeamStanding.overall.won}
- Drawn: ${homeTeamStanding.overall.drawn}
- Lost: ${homeTeamStanding.overall.lost}
- Goals For: ${homeTeamStanding.overall.goalsFor}
- Goals Against: ${homeTeamStanding.overall.goalsAgainst}
- Goal Difference: ${homeTeamStanding.overall.goalDifference}
- Points: ${homeTeamStanding.overall.points}

${data.homeTeam} Home Standings:
- Position: ${homeTeamStanding.homeForm.position}
- Played: ${homeTeamStanding.homeForm.played}
- Won: ${homeTeamStanding.homeForm.won}
- Drawn: ${homeTeamStanding.homeForm.drawn}
- Lost: ${homeTeamStanding.homeForm.lost}
- Goals For: ${homeTeamStanding.homeForm.goalsFor}
- Goals Against: ${homeTeamStanding.homeForm.goalsAgainst}
- Goal Difference: ${homeTeamStanding.homeForm.goalDifference}

$data.homeTeam} Away Standings:
- Position: ${homeTeamStanding.awayForm.position}
- Played: ${homeTeamStanding.awayForm.played}
- Won: ${homeTeamStanding.awayForm.won}
- Drawn: ${homeTeamStanding.awayForm.drawn}
- Lost: ${homeTeamStanding.awayForm.lost}
- Goals For: ${homeTeamStanding.awayForm.goalsFor}
- Goals Against: ${homeTeamStanding.awayForm.goalsAgainst}
- Goal Difference: ${homeTeamStanding.awayForm.goalDifference}

${data.awayTeam} Standings:
- Position: ${awayTeamStanding.overall.position}
- Played: ${awayTeamStanding.overall.played}
- Won: ${awayTeamStanding.overall.won}
- Drawn: ${awayTeamStanding.overall.drawn}
- Lost: ${awayTeamStanding.overall.lost}
- Goals For: ${awayTeamStanding.overall.goalsFor}
- Goals Against: ${awayTeamStanding.overall.goalsAgainst}
- Goal Difference: ${awayTeamStanding.overall.goalDifference}
- Points: ${awayTeamStanding.overall.points}

${data.awayTeam} Home Standings:
- Position: ${awayTeamStanding.homeForm.position}
- Played: ${awayTeamStanding.homeForm.played}
- Won: ${awayTeamStanding.homeForm.won}
- Drawn: ${awayTeamStanding.homeForm.drawn}
- Lost: ${awayTeamStanding.homeForm.lost}
- Goals For: ${awayTeamStanding.homeForm.goalsFor}
- Goals Against: ${awayTeamStanding.homeForm.goalsAgainst}
- Goal Difference: ${awayTeamStanding.homeForm.goalDifference}

${data.awayTeam} Away Standings:
- Position: ${awayTeamStanding.awayForm.position}
- Played: ${awayTeamStanding.awayForm.played}
- Won: ${awayTeamStanding.awayForm.won}
- Drawn: ${awayTeamStanding.awayForm.drawn}
- Lost: ${awayTeamStanding.awayForm.lost}
- Goals For: ${awayTeamStanding.awayForm.goalsFor}
- Goals Against: ${awayTeamStanding.awayForm.goalsAgainst}
- Goal Difference: ${awayTeamStanding.awayForm.goalDifference}

Environmental Conditions:
- Temperature: ${data.weather.temperature}°C
- Weather: ${data.weather.condition}
- Humidity: ${data.weather.humidity}%
- Wind Speed: ${data.weather.windSpeed} km/h

Team Form Analysis:
${data.homeTeam} Recent Form:
${homeMatchResults}

${data.awayTeam} Recent Form:
${awayMatchResults}

Head-to-Head History:
${betweenMatchResults}

Squad Status:
${data.homeTeam} Unavailable Players:
${homePlayerAvailabilityList || 'No reported absences'}

${data.awayTeam} Unavailable Players:
${awayPlayerAvailabilityList || 'No reported absences'}

${this.getPromptRequirements()}`
        logger.info(`Generated prompt: ${prompt}`)
        return prompt;
    }

    private getPromptRequirements(): string {
        return `
        Simulate the match based on the data provided and generate a detailed predictive analysis.
        Analyze all provided data and respond with a single JSON object in exactly this format:
        {
            "homeTeamWinPercentage": number,     // Probability of home team victory (0-100)
            "awayTeamWinPercentage": number,     // Probability of away team victory (0-100)
            "drawPercentage": number,            // Probability of a draw (0-100)
            "over2_5Percentage": number,         // Likelihood of over 2.5 goals
            "bothTeamScorePercentage": number,   // Probability of both teams scoring
            "halfTimeWinner": "home" | "away" | "draw",  // Predicted half-time result
            "halfTimeWinnerPercentage": number,  // Confidence in half-time prediction
            "predictedScore": {
                "home": number,                  // Predicted goals for home team
                "away": number                   // Predicted goals for away team
            },
            "predictionConfidence": number,      // Overall confidence in prediction
            "briefComment": string              // Analytical comment explaining key factors and prediction rationale
        }

        Critical Requirements:
        1. All percentages must be numbers from 0 to 100
        2. Win percentages (home, away, draw) must sum exactly to 100
        3. Brief comment should explain the prediction rationale considering team strengths and formations
        4. Predication confidence should reflect:
           - Data completeness
           - Form consistency
           - Weather impact
           - Squad availability
           - Starting lineup quality
           - Tactical matchup (formations)
        5. Consider:
           - Team formations and player positions
           - Individual player matchups
           - Recent form and consistency
           - Head-to-head history
           - Weather conditions impact
           - Available players and team strength
           - Home/away advantage

        Return ONLY the JSON object without any additional text or formatting.`
    }

    protected getResponseSchema() {
        return footballMatchResponseSchema
    }
}

export const generateMatchCommentary = new FootballCommentaryService().generateCommentary.bind(new FootballCommentaryService())