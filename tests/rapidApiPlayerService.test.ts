import {
  getRapidApiPlayerService,
} from '../services/football/rapidApiPlayerService';
import logger from '../utils/logger';

async function testPlayerSearch() {
  try {
    const playerService = getRapidApiPlayerService();

    // Test with a well-known player name
    const playerName = 'Arda Guler';
    logger.info(`Searching for player: ${playerName}`);

    // Test the search method
    logger.info('Testing searchPlayer method:');
    const result = await playerService.searchPlayer(playerName);

    if (result) {
      logger.info('Player found:');
      logger.info(`Name: ${result.name}`);
      logger.info(`ID: ${result.id}`);
      logger.info(`URL: ${result.url}`);
      if (result.team) {
        logger.info(`Team: ${result.team.name}`);
      }
    } else {
      logger.error(`Player not found: ${playerName}`);
    }

    // Test with team name
    logger.info('\nTesting searchPlayer method with team name:');
    const resultWithTeam = await playerService.searchPlayer(playerName, 'Real Madrid');

    if (resultWithTeam) {
      logger.info('Player found with team:');
      logger.info(`Name: ${resultWithTeam.name}`);
      logger.info(`ID: ${resultWithTeam.id}`);
      logger.info(`URL: ${resultWithTeam.url}`);
      if (resultWithTeam.team) {
        logger.info(`Team: ${resultWithTeam.team.name}`);
      }
    } else {
      logger.error(`Player not found with team: ${playerName}, Real Madrid`);
    }

    // Test the getPlayerDetails method
    logger.info('\nTesting getPlayerDetails method:');
    const playerDetails = await playerService.getPlayerDetails(playerName);

    if (playerDetails) {
      logger.info('Player details found:');
      logger.info(`Name: ${playerDetails.name}`);
      logger.info(`ID: ${playerDetails.id}`);
      logger.info(`URL: ${playerDetails.url}`);
      if (playerDetails.team) {
        logger.info(`Team: ${playerDetails.team.name}`);
      }

      // Log current season stats if available
      if (playerDetails.currentSeasonStats) {
        logger.info('\nCurrent season statistics:');
        const stats = playerDetails.currentSeasonStats;

        logger.info('\nGeneral Stats:');
        logger.info(`- Matches Played: ${stats.general?.matchesPlayed}`);
        logger.info(`- Minutes Played: ${stats.general?.minutesPlayed}`);
        logger.info(`- Goals: ${stats.general?.goals}`);
        logger.info(`- Assists: ${stats.general?.assists}`);
        logger.info(`- Rating: ${stats.general?.rating}`);

        if (stats.competitions && stats.competitions.length > 0) {
          logger.info('\nCompetitions:');
          stats.competitions.forEach(comp => {
            logger.info(`\n- ${comp.name}:`);
            logger.info(`  - Matches: ${comp.general?.matchesPlayed}`);
            logger.info(`  - Goals: ${comp.general?.goals}`);
            logger.info(`  - Assists: ${comp.general?.assists}`);
          });
        }
      } else {
        logger.info('No current season statistics available');
      }
    } else {
      logger.error(`Could not get details for player: ${playerName}`);
    }

    // Test the getPlayerStats method directly
    if (result) {
      logger.info('\nTesting getPlayerStats method:');
      const playerStats = await playerService.getPlayerStats(result.id);

      if (playerStats) {
        logger.info('Player statistics found:');
        logger.info(`- Matches Played: ${playerStats.general?.matchesPlayed}`);
        logger.info(`- Goals: ${playerStats.general?.goals}`);
        logger.info(`- Assists: ${playerStats.general?.assists}`);

        if (playerStats.competitions && playerStats.competitions.length > 0) {
          logger.info(`- Main Competition: ${playerStats.competitions[0].name}`);
        }
      } else {
        logger.error(`Could not get statistics for player ID: ${result.id}`);
      }
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
