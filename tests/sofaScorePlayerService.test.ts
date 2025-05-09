import {
  getSofaScorePlayerService,
  getPlayerSofaScoreUrl,
} from '../services/football/sofaScorePlayerService';
import logger from '../utils/logger';

async function testPlayerSearch() {
  try {
    const playerService = getSofaScorePlayerService();

    // Test with a well-known player name
    const playerName = 'Arda Guler';
    logger.info(`Searching for player: ${playerName}`);

    // Test the detailed search method
    logger.info('Testing searchPlayer method:');
    const result = await playerService.searchPlayer(playerName);

    if (result) {
      logger.info('Player found:');
      logger.info(`Name: ${result.name}`);
      logger.info(`ID: ${result.id}`);
      logger.info(`URL: ${result.url}`);
      logger.info(`Full SofaScore URL: ${getPlayerSofaScoreUrl(result.name, result.id)}`);
    } else {
      logger.error(`Player not found: ${playerName}`);
    }

    // Test the convenience method
    logger.info('\nTesting getPlayerUrl method:');
    const playerUrl = await playerService.getPlayerUrl(playerName);

    if (playerUrl) {
      logger.info(`Player URL: ${playerUrl}`);
    } else {
      logger.error(`Could not get URL for player: ${playerName}`);
    }

    // Test the new getPlayerDetails method
    logger.info('\nTesting getPlayerDetails method:');
    const playerDetails = await playerService.getPlayerDetails(playerName);

    if (playerDetails) {
      logger.info('Player details found:');
      logger.info(`Name: ${playerDetails.name}`);
      logger.info(`ID: ${playerDetails.id}`);
      logger.info(`URL: ${playerDetails.url}`);

      // Log strengths
      if (playerDetails.strengths && playerDetails.strengths.length > 0) {
        logger.info(`Strengths: ${playerDetails.strengths.join(', ')}`);
      } else {
        logger.info('No strengths data available');
      }

      // Log weaknesses
      if (playerDetails.weaknesses && playerDetails.weaknesses.length > 0) {
        logger.info(`Weaknesses: ${playerDetails.weaknesses.join(', ')}`);
      } else {
        logger.info('No weaknesses data available');
      }

      // Log average rating
      if (playerDetails.averageRating) {
        logger.info(`Average Rating: ${playerDetails.averageRating}`);
      } else {
        logger.info('No average rating available');
      }

      // Log monthly ratings
      if (playerDetails.monthlyRatings && playerDetails.monthlyRatings.length > 0) {
        logger.info('Monthly Ratings:');
        playerDetails.monthlyRatings.forEach((rating) => {
          logger.info(`  ${rating.month}: ${rating.value}`);
        });
      } else {
        logger.info('No monthly ratings available');
      }

      // Log league performance
      if (playerDetails.leaguePerformance && playerDetails.leaguePerformance.length > 0) {
        logger.info('League Performance:');
        playerDetails.leaguePerformance.forEach((league) => {
          logger.info(
            `  ${league.name}: ${league.appearances} appearances, Rating: ${league.rating}`
          );
        });
      } else {
        logger.info('No league performance data available');
      }

      // Log player attributes
      if (playerDetails.attributes) {
        logger.info('Player Attributes:');
        logger.info(`  Attacking: ${playerDetails.attributes.attacking}`);
        logger.info(`  Technical: ${playerDetails.attributes.technical}`);
        logger.info(`  Tactical: ${playerDetails.attributes.tactical}`);
        logger.info(`  Defending: ${playerDetails.attributes.defending}`);
        logger.info(`  Creativity: ${playerDetails.attributes.creativity}`);
      } else {
        logger.info('No player attributes data available');
      }

      // Log current season statistics
      if (playerDetails.currentSeasonStats) {
        logger.info('\nCurrent Season Statistics (24/25):');

        // Log general stats
        if (playerDetails.currentSeasonStats.general) {
          const stats = playerDetails.currentSeasonStats.general;
          logger.info('General Stats:');
          logger.info(`  Matches Played: ${stats.matchesPlayed}`);
          logger.info(`  Minutes Played: ${stats.minutesPlayed}`);
          logger.info(`  Goals: ${stats.goals}`);
          logger.info(`  Assists: ${stats.assists}`);
          logger.info(`  Rating: ${stats.rating}`);
        } else {
          logger.info('No general stats available');
        }

        // Log shooting stats
        if (playerDetails.currentSeasonStats.shooting) {
          const stats = playerDetails.currentSeasonStats.shooting;
          logger.info('Shooting Stats:');
          logger.info(`  Total Shots: ${stats.totalShots}`);
          logger.info(`  Shots On Target: ${stats.shotsOnTarget}`);
          logger.info(`  Shots Off Target: ${stats.shotsOffTarget}`);
          logger.info(`  Blocked Shots: ${stats.blockedShots}`);
          logger.info(`  Shot Accuracy: ${stats.shotAccuracy}%`);
        } else {
          logger.info('No shooting stats available');
        }

        // Log team play stats
        if (playerDetails.currentSeasonStats.teamPlay) {
          const stats = playerDetails.currentSeasonStats.teamPlay;
          logger.info('Team Play Stats:');
          logger.info(`  Dribble Attempts: ${stats.dribbleAttempts}`);
          logger.info(`  Successful Dribbles: ${stats.successfulDribbles}`);
          logger.info(`  Dribble Success: ${stats.dribbleSuccess}%`);
          logger.info(`  Fouls Drawn: ${stats.foulsDrawn}`);
          logger.info(`  Offsides: ${stats.offsides}`);
          logger.info(`  Dispossessed: ${stats.dispossessed}`);
        } else {
          logger.info('No team play stats available');
        }

        // Log passing stats
        if (playerDetails.currentSeasonStats.passing) {
          const stats = playerDetails.currentSeasonStats.passing;
          logger.info('Passing Stats:');
          logger.info(`  Total Passes: ${stats.totalPasses}`);
          logger.info(`  Accurate Passes: ${stats.accuratePasses}`);
          logger.info(`  Pass Accuracy: ${stats.passAccuracy}%`);
          logger.info(`  Key Passes: ${stats.keyPasses}`);
          logger.info(`  Big Chances Created: ${stats.bigChancesCreated}`);
        } else {
          logger.info('No passing stats available');
        }

        // Log defending stats
        if (playerDetails.currentSeasonStats.defending) {
          const stats = playerDetails.currentSeasonStats.defending;
          logger.info('Defending Stats:');
          logger.info(`  Tackles: ${stats.tackles}`);
          logger.info(`  Interceptions: ${stats.interceptions}`);
          logger.info(`  Clearances: ${stats.clearances}`);
          logger.info(`  Blocked Shots: ${stats.blockedShots}`);
          logger.info(`  Duels Won: ${stats.duelsWon}`);
          logger.info(`  Duels Lost: ${stats.duelsLost}`);
        } else {
          logger.info('No defending stats available');
        }

        // Log additional stats
        if (playerDetails.currentSeasonStats.additional) {
          const stats = playerDetails.currentSeasonStats.additional;
          logger.info('Additional Stats:');
          logger.info(`  Yellow Cards: ${stats.yellowCards}`);
          logger.info(`  Red Cards: ${stats.redCards}`);
          logger.info(`  Fouls Committed: ${stats.foulsCommitted}`);
          logger.info(`  Aerial Duels Won: ${stats.aerialDuelsWon}`);
          logger.info(`  Aerial Duels Lost: ${stats.aerialDuelsLost}`);
        } else {
          logger.info('No additional stats available');
        }

        // Log competition-specific stats
        if (
          playerDetails.currentSeasonStats.competitions &&
          playerDetails.currentSeasonStats.competitions.length > 0
        ) {
          logger.info('Competition Breakdown:');
          playerDetails.currentSeasonStats.competitions.forEach((comp) => {
            logger.info(`  ${comp.name}:`);

            if (comp.general) {
              logger.info(
                `    Matches: ${comp.general.matchesPlayed}, Goals: ${comp.general.goals}, Assists: ${comp.general.assists}, Rating: ${comp.general.rating}`
              );
            }

            // Log other competition-specific stats if available
          });
        } else {
          logger.info('No competition-specific stats available');
        }
      } else {
        logger.info('No current season statistics available');
      }
    } else {
      logger.error(`Could not get details for player: ${playerName}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Test failed: ${errorMessage}`);
  } finally {
    // Exit the process after the test
    process.exit(0);
  }
}

// Run the test
testPlayerSearch();
