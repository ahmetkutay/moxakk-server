import { FootballMatchData } from '../../types/matches';
import { BaseCommentaryService } from '../commentary/BaseCommentaryService';
import logger from '../../utils/logger';

export class FootballCommentaryService extends BaseCommentaryService<FootballMatchData> {
  protected generatePrompt(data: FootballMatchData): string {
    const homePlayerAvailabilityList = data.unavailablePlayers.home.join('\n');
    const awayPlayerAvailabilityList = data.unavailablePlayers.away.join('\n');
    const homeMatchResults = data.recentMatches.home.join('\n');
    const awayMatchResults = data.recentMatches.away.join('\n');
    const betweenMatchResults = data.recentMatches.between.join('\n');
    const homeTeamStanding = data.standings.home;
    const awayTeamStanding = data.standings.away;
    const homePlayerData = data.playerData?.home || [];
    const awayPlayerData = data.playerData?.away || [];

    // Format lineup players
    const formatLineup = (players: any[]) => {
      return players
        .map((player) => `${player.number}. ${player.name} (${player.position})`)
        .join('\n');
    };

    // Get formations and lineups if available
    const homeFormation = data.teamLineups.home.formation || 'Unknown';
    const awayFormation = data.teamLineups.away.formation || 'Unknown';
    const homeLineup = data.teamLineups.home.players || [];
    const awayLineup = data.teamLineups.away.players || [];

    // Referee info
    let refereeSection = '';
    if (data.refereeStats) {
      const ref = data.refereeStats;
      refereeSection = `\nReferee Information:\n- Name: ${ref.name}\n- Country: ${ref.country}`;
      if (ref.summary) {
        refereeSection += `\n- Home Win: ${ref.summary.homeWin}, Draw: ${ref.summary.draw}, Away Win: ${ref.summary.awayWin}`;
        refereeSection += `\n- Yellow Cards: ${ref.summary.yellowCards}, Red Cards: ${ref.summary.redCards}, Penalties: ${ref.summary.penalties}`;
      }
      if (ref.tournaments && ref.tournaments.length > 0) {
        refereeSection +=
          '\n- Tournaments: ' +
          ref.tournaments.map((t) => `${t.name} (${t.matchCount})`).join(', ');
      }
    }

    const prompt = `
You are an expert football analyst and prediction model. Based on the provided match data, generate a detailed predictive analysis. Use all available data, especially referee statistics, weather, and squad status. If referee stats indicate a tendency for more cards, penalties, or home/away bias, reflect this in your analysis and in the predicted outcomes (e.g., more cards, higher/lower score, penalty likelihood). If data is missing or incomplete, lower the prediction confidence and mention this in your comment.

Match Information:
- ID: ${data.id}
- Teams: ${data.homeTeam} vs ${data.awayTeam}
${refereeSection}

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

${data.homeTeam} Away Standings:
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

Player Analysis (SofaScore Data):
${data.homeTeam} Key Players:
${
  homePlayerData
    .map((player) => {
      let playerInfo = `- ${player.name} (${player.averageRating ? `Rating: ${player.averageRating}` : 'No rating'})`;

      if (player.strengths && player.strengths.length > 0) {
        playerInfo += `\n  Strengths: ${player.strengths.join(', ')}`;
      }

      if (player.weaknesses && player.weaknesses.length > 0) {
        playerInfo += `\n  Weaknesses: ${player.weaknesses.join(', ')}`;
      }

      if (player.monthlyRatings && player.monthlyRatings.length > 0) {
        const recentRatings = player.monthlyRatings.slice(0, 3);
        playerInfo += `\n  Recent form: ${recentRatings.map((r) => `${r.month}: ${r.value}`).join(', ')}`;
      }

      if (player.attributes) {
        playerInfo += `\n  Attributes: ATT:${player.attributes.attacking}, TEC:${player.attributes.technical}, TAC:${player.attributes.tactical}, DEF:${player.attributes.defending}, CRE:${player.attributes.creativity}`;
      }

      if (player.leaguePerformance && player.leaguePerformance.length > 0) {
        playerInfo += `\n  League Performance:`;
        player.leaguePerformance.forEach((league) => {
          playerInfo += `\n    - ${league.name}: ${league.appearances} appearances, Rating: ${league.rating}`;
        });
      }

      if (player.currentSeasonStats) {
        playerInfo += `\n  Current Season (24/25):`;

        // Add general stats if available
        if (player.currentSeasonStats.general) {
          const stats = player.currentSeasonStats.general;
          playerInfo += `\n    General: ${stats.matchesPlayed} matches, ${stats.minutesPlayed} minutes, ${stats.goals} goals, ${stats.assists} assists, Rating: ${stats.rating.toFixed(2)}`;
        }

        // Add shooting stats if available
        if (player.currentSeasonStats.shooting) {
          const stats = player.currentSeasonStats.shooting;
          playerInfo += `\n    Shooting: ${stats.totalShots} shots (${stats.shotsOnTarget} on target), ${stats.shotAccuracy.toFixed(1)}% accuracy`;
        }

        // Add team play stats if available
        if (player.currentSeasonStats.teamPlay) {
          const stats = player.currentSeasonStats.teamPlay;
          playerInfo += `\n    Team Play: ${stats.successfulDribbles}/${stats.dribbleAttempts} dribbles (${stats.dribbleSuccess.toFixed(1)}%), ${stats.foulsDrawn} fouls drawn`;
        }

        // Add passing stats if available
        if (player.currentSeasonStats.passing) {
          const stats = player.currentSeasonStats.passing;
          playerInfo += `\n    Passing: ${stats.accuratePasses}/${stats.totalPasses} passes (${stats.passAccuracy.toFixed(1)}%), ${stats.keyPasses} key passes, ${stats.bigChancesCreated} big chances created`;
        }

        // Add defending stats if available
        if (player.currentSeasonStats.defending) {
          const stats = player.currentSeasonStats.defending;
          playerInfo += `\n    Defending: ${stats.tackles} tackles, ${stats.interceptions} interceptions, ${stats.clearances} clearances, ${stats.duelsWon}/${stats.duelsWon + stats.duelsLost} duels won`;
        }

        // Add additional stats if available
        if (player.currentSeasonStats.additional) {
          const stats = player.currentSeasonStats.additional;
          playerInfo += `\n    Additional: ${stats.yellowCards} yellow cards, ${stats.redCards} red cards, ${stats.foulsCommitted} fouls committed, ${stats.aerialDuelsWon}/${stats.aerialDuelsWon + stats.aerialDuelsLost} aerial duels won`;
        }

        // Add competition-specific stats if available
        if (
          player.currentSeasonStats.competitions &&
          player.currentSeasonStats.competitions.length > 0
        ) {
          playerInfo += `\n    Competition Breakdown:`;
          player.currentSeasonStats.competitions.forEach((comp) => {
            if (comp.general) {
              playerInfo += `\n      - ${comp.name}: ${comp.general.matchesPlayed} matches, ${comp.general.goals} goals, ${comp.general.assists} assists, Rating: ${comp.general.rating.toFixed(2)}`;
            }
          });
        }
      }

      return playerInfo;
    })
    .join('\n\n') || 'No player data available'
}

${data.awayTeam} Key Players:
${
  awayPlayerData
    .map((player) => {
      let playerInfo = `- ${player.name} (${player.averageRating ? `Rating: ${player.averageRating}` : 'No rating'})`;

      if (player.strengths && player.strengths.length > 0) {
        playerInfo += `\n  Strengths: ${player.strengths.join(', ')}`;
      }

      if (player.weaknesses && player.weaknesses.length > 0) {
        playerInfo += `\n  Weaknesses: ${player.weaknesses.join(', ')}`;
      }

      if (player.monthlyRatings && player.monthlyRatings.length > 0) {
        const recentRatings = player.monthlyRatings.slice(0, 3);
        playerInfo += `\n  Recent form: ${recentRatings.map((r) => `${r.month}: ${r.value}`).join(', ')}`;
      }

      if (player.attributes) {
        playerInfo += `\n  Attributes: ATT:${player.attributes.attacking}, TEC:${player.attributes.technical}, TAC:${player.attributes.tactical}, DEF:${player.attributes.defending}, CRE:${player.attributes.creativity}`;
      }

      if (player.leaguePerformance && player.leaguePerformance.length > 0) {
        playerInfo += `\n  League Performance:`;
        player.leaguePerformance.forEach((league) => {
          playerInfo += `\n    - ${league.name}: ${league.appearances} appearances, Rating: ${league.rating}`;
        });
      }

      if (player.currentSeasonStats) {
        playerInfo += `\n  Current Season (24/25):`;

        // Add general stats if available
        if (player.currentSeasonStats.general) {
          const stats = player.currentSeasonStats.general;
          playerInfo += `\n    General: ${stats.matchesPlayed} matches, ${stats.minutesPlayed} minutes, ${stats.goals} goals, ${stats.assists} assists, Rating: ${stats.rating.toFixed(2)}`;
        }

        // Add shooting stats if available
        if (player.currentSeasonStats.shooting) {
          const stats = player.currentSeasonStats.shooting;
          playerInfo += `\n    Shooting: ${stats.totalShots} shots (${stats.shotsOnTarget} on target), ${stats.shotAccuracy.toFixed(1)}% accuracy`;
        }

        // Add team play stats if available
        if (player.currentSeasonStats.teamPlay) {
          const stats = player.currentSeasonStats.teamPlay;
          playerInfo += `\n    Team Play: ${stats.successfulDribbles}/${stats.dribbleAttempts} dribbles (${stats.dribbleSuccess.toFixed(1)}%), ${stats.foulsDrawn} fouls drawn`;
        }

        // Add passing stats if available
        if (player.currentSeasonStats.passing) {
          const stats = player.currentSeasonStats.passing;
          playerInfo += `\n    Passing: ${stats.accuratePasses}/${stats.totalPasses} passes (${stats.passAccuracy.toFixed(1)}%), ${stats.keyPasses} key passes, ${stats.bigChancesCreated} big chances created`;
        }

        // Add defending stats if available
        if (player.currentSeasonStats.defending) {
          const stats = player.currentSeasonStats.defending;
          playerInfo += `\n    Defending: ${stats.tackles} tackles, ${stats.interceptions} interceptions, ${stats.clearances} clearances, ${stats.duelsWon}/${stats.duelsWon + stats.duelsLost} duels won`;
        }

        // Add additional stats if available
        if (player.currentSeasonStats.additional) {
          const stats = player.currentSeasonStats.additional;
          playerInfo += `\n    Additional: ${stats.yellowCards} yellow cards, ${stats.redCards} red cards, ${stats.foulsCommitted} fouls committed, ${stats.aerialDuelsWon}/${stats.aerialDuelsWon + stats.aerialDuelsLost} aerial duels won`;
        }

        // Add competition-specific stats if available
        if (
          player.currentSeasonStats.competitions &&
          player.currentSeasonStats.competitions.length > 0
        ) {
          playerInfo += `\n    Competition Breakdown:`;
          player.currentSeasonStats.competitions.forEach((comp) => {
            if (comp.general) {
              playerInfo += `\n      - ${comp.name}: ${comp.general.matchesPlayed} matches, ${comp.general.goals} goals, ${comp.general.assists} assists, Rating: ${comp.general.rating.toFixed(2)}`;
            }
          });
        }
      }

      return playerInfo;
    })
    .join('\n\n') || 'No player data available'
}

${this.getPromptRequirements()}`;
    logger.info(`Generated prompt: ${prompt}`);
    return prompt;
  }

  private getPromptRequirements(): string {
    return `
        Simulate the match based on the data provided and generate a detailed predictive analysis.
        Analyze all provided data and respond with a single JSON object in exactly this format:
        {
            "homeTeamWinPercentage": number,     // Probability of home team victory (0-100)
            "homeTeamConfidenceInterval": {
                "lower": number,                 // Lower bound of confidence interval (0-100)
                "upper": number                  // Upper bound of confidence interval (0-100)
            },
            "awayTeamWinPercentage": number,     // Probability of away team victory (0-100)
            "awayTeamConfidenceInterval": {
                "lower": number,
                "upper": number
            },
            "drawPercentage": number,            // Probability of a draw (0-100)
            "drawConfidenceInterval": {
                "lower": number,
                "upper": number
            },
            "over2_5Percentage": number,         // Likelihood of over 2.5 goals
            "over2_5ConfidenceInterval": {
                "lower": number,
                "upper": number
            },
            "bothTeamScorePercentage": number,   // Probability of both teams scoring
            "bothTeamScoreConfidenceInterval": {
                "lower": number,
                "upper": number
            },
            "halfTimeWinner": "home" | "away" | "draw",  // Predicted half-time result
            "halfTimeWinnerPercentage": number,  // Confidence in half-time prediction
            "halfTimeWinnerConfidenceInterval": {
                "lower": number,
                "upper": number
            },
            "predictedScore": {
                "home": number,                  // Predicted goals for home team
                "away": number                   // Predicted goals for away team
            },
            "predictionConfidence": number,      // Overall confidence in prediction
            "briefComment": string,              // Analytical comment explaining key factors and prediction rationale (must mention referee, weather, and squad if relevant)
            "refereeImpact": string,             // Short summary of how referee stats may affect the match (e.g. card/penalty tendency, home/away bias)
            "weatherImpact": string              // Short summary of how weather may affect the match
        }

        Critical Requirements:
        1. All percentages must be numbers from 0 to 100
        2. Win percentages (home, away, draw) must sum exactly to 100
        3. For each percentage, provide a confidence interval with lower and upper bounds
        4. Confidence intervals should be narrower when you have high confidence in the prediction
        5. Confidence intervals should be wider when data is incomplete or contradictory
        6. Brief comment should explain the prediction rationale considering team strengths, formations, referee, weather, squad status, and key player information
        7. If referee or weather data is missing, note this and lower prediction confidence
        8. If referee stats show a bias or tendency, reflect this in the prediction and comment
        9. Consider the SofaScore player data when analyzing team strengths and potential match-winners
        10. If key players are available in the SofaScore data, incorporate their potential impact in your analysis
        11. Return ONLY the JSON object without any additional text or formatting.`;
  }
}
