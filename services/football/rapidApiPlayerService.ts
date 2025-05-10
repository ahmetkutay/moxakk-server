import axios from 'axios';
import logger from '../../utils/logger';
import { redisClient } from '../../config/db';
import { 
  PlayerData, 
  PlayerSearchResult,
  CurrentSeasonStats,
} from '../../types/matches';

// Interface for the RapidAPI search response
interface RapidApiSearchResponse {
  results: RapidApiSearchResult[];
}

// Interface for the RapidAPI player statistics response
interface RapidApiPlayerStatsResponse {
  seasons: RapidApiSeasonStats[];
}

interface RapidApiSeasonStats {
  statistics: {
    accurateCrosses?: number;
    accurateCrossesPercentage?: number;
    accurateLongBalls?: number;
    accurateLongBallsPercentage?: number;
    accuratePasses?: number;
    accuratePassesPercentage?: number;
    aerialDuelsWon?: number;
    assists?: number;
    bigChancesCreated?: number;
    bigChancesMissed?: number;
    blockedShots?: number;
    cleanSheet?: number;
    dribbledPast?: number;
    errorLeadToGoal?: number;
    expectedAssists?: number;
    expectedGoals?: number;
    goals?: number;
    goalsAssistsSum?: number;
    goalsConceded?: number;
    interceptions?: number;
    keyPasses?: number;
    minutesPlayed?: number;
    passToAssist?: number;
    rating?: number;
    redCards?: number;
    saves?: number;
    shotsOnTarget?: number;
    successfulDribbles?: number;
    tackles?: number;
    totalShots?: number;
    yellowCards?: number;
    totalRating?: number;
    countRating?: number;
    totalLongBalls?: number;
    totalCross?: number;
    totalPasses?: number;
    shotsFromInsideTheBox?: number;
    appearances?: number;
    type?: string;
    id?: number;
  };
  year: string;
  team: {
    id: number;
    name: string;
    slug: string;
    shortName: string;
    gender?: string;
    sport: {
      name: string;
      slug: string;
      id: number;
    };
    userCount: number;
    nameCode: string;
    disabled?: boolean;
    national: boolean;
    type?: number;
    teamColors?: {
      primary: string;
      secondary: string;
      text: string;
    };
  };
  uniqueTournament: {
    name: string;
    slug: string;
    primaryColorHex?: string;
    secondaryColorHex?: string;
    category: {
      id: number;
      name: string;
      slug: string;
      sport: {
        name: string;
        slug: string;
        id: number;
      };
      flag: string;
      alpha2?: string;
    };
    userCount: number;
    id: number;
    displayInverseHomeAwayTeams: boolean;
    competitionType?: string;
  };
  season: {
    name: string;
    year: string;
    editor: boolean;
    id: number;
    startDateTimestamp?: number;
    endDateTimestamp?: number;
  };
}

interface RapidApiSearchResult {
  entity: {
    id: number;
    name: string;
    slug: string;
    retired?: boolean;
    userCount?: number;
    team?: {
      id: number;
      name: string;
      nameCode: string;
      slug: string;
      national: boolean;
      sport: {
        id: number;
        slug: string;
        name: string;
      };
      userCount: number;
      teamColors?: {
        primary: string;
        secondary: string;
        text: string;
      };
      gender?: string;
      subTeams: any[];
    };
    deceased?: boolean;
    country?: {
      alpha2: string;
      name: string;
      slug: string;
    };
    shortName?: string;
    position?: string;
    jerseyNumber?: string;
    fieldTranslations?: any;
  };
  score: number;
  type: string;
}

export class RapidApiPlayerService {
  private readonly apiUrl: string = 'https://sofascore.p.rapidapi.com/search';
  private readonly headers: Record<string, string>;

  constructor() {
    this.headers = {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
      'X-RapidAPI-Host': 'sofascore.p.rapidapi.com'
    };
  }

  /**
   * Search for a player using the RapidAPI
   * @param playerName The name of the player to search for
   * @param teamName Optional team name to match against player's team
   * @returns The player's search result if found
   */
  async searchPlayer(playerName: string, teamName?: string): Promise<PlayerSearchResult | null> {
    // Check cache first
    const cacheKey = `player:search:${playerName}${teamName ? `:${teamName}` : ''}`;
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info(`Using cached search result for: ${playerName}`);
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      logger.warn(`Error checking cache for search result: ${cacheError}`);
      // Continue with API request if cache fails
    }

    try {
      logger.info(`Searching for player via RapidAPI: ${playerName}${teamName ? ` (team: ${teamName})` : ''}`);

      // Construct the API URL with the player name
      const searchUrl = `${this.apiUrl}?q=${encodeURIComponent(playerName)}&type=all&page=0`;

      // Make the API request
      const response = await axios.get<RapidApiSearchResponse>(searchUrl, {
        headers: this.headers
      });

      // Check if we got valid results
      if (!response.data?.results || response.data.results.length === 0) {
        logger.warn(`No player found via API for: ${playerName}`);
        return null;
      }

      // Log the raw results for debugging
      logger.debug(`Search results for ${playerName}: ${JSON.stringify(response.data.results)}`);

      // Filter results to include players and managers
      const playerResults = response.data.results.filter(result => result.type === 'player' || result.type === 'manager');

      logger.info(`Found ${playerResults.length} player/manager results for: ${playerName}`);

      if (playerResults.length === 0) {
        logger.warn(`No player or manager results found via API for: ${playerName}`);
        return null;
      }

      // Log the first result for debugging
      if (playerResults.length > 0) {
        const firstResult = playerResults[0];
        logger.info(`First result: id=${firstResult.entity.id}, name=${firstResult.entity.name}, type=${firstResult.type}`);
      }

      // If team name is provided, try to find a player with matching team
      if (teamName) {
        // Find players with matching team names
        const playersWithTeam = playerResults.filter(result => result.entity.team);

        logger.info(`Found ${playersWithTeam.length} players with team information for: ${playerName}`);

        // Check for team name matches
        for (const result of playersWithTeam) {
          if (this.checkTeamNameMatch(result.entity.team?.name || '', teamName)) {
            logger.info(`Found player ${result.entity.name} with matching team ${result.entity.team?.name}`);
            const searchResult = {
              id: result.entity.id.toString(),
              name: result.entity.name,
              url: `/player/${result.entity.slug}/${result.entity.id}`,
              team: result.entity.team ? {
                id: result.entity.team.id,
                name: result.entity.team.name
              } : undefined
            };

            // Cache the search result for 24 hours
            try {
              await redisClient.set(cacheKey, JSON.stringify(searchResult), {
                EX: 60 * 60 * 24 // 24 hours
              });
              logger.info(`Cached search result for: ${playerName}`);
            } catch (cacheError) {
              logger.warn(`Error caching search result: ${cacheError}`);
              // Continue even if caching fails
            }

            return searchResult;
          }
        }

        logger.warn(`No player found with matching team for: ${playerName}, team: ${teamName}`);
        // Even if no team match is found, we'll still return the first result below
      }

      // If no team match or no team provided, return the first result
      const bestResult = playerResults[0];
      logger.info(`Returning best result: id=${bestResult.entity.id}, name=${bestResult.entity.name}, type=${bestResult.type}`);
      const searchResult = {
        id: bestResult.entity.id.toString(),
        name: bestResult.entity.name,
        url: `/player/${bestResult.entity.slug}/${bestResult.entity.id}`,
        team: bestResult.entity.team ? {
          id: bestResult.entity.team.id,
          name: bestResult.entity.team.name
        } : undefined
      };

      // Cache the search result for 24 hours
      try {
        await redisClient.set(cacheKey, JSON.stringify(searchResult), {
          EX: 60 * 60 * 24 // 24 hours
        });
        logger.info(`Cached search result for: ${playerName}`);
      } catch (cacheError) {
        logger.warn(`Error caching search result: ${cacheError}`);
        // Continue even if caching fails
      }

      return searchResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error searching player via API: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Check if two team names match or are similar
   * @param team1 First team name
   * @param team2 Second team name
   * @returns True if the team names match or are similar
   */
  private checkTeamNameMatch(team1: string, team2: string): boolean {
    // Normalize team names
    const normalizedTeam1 = team1.toLowerCase().trim();
    const normalizedTeam2 = team2.toLowerCase().trim();

    // Direct match
    if (normalizedTeam1 === normalizedTeam2) {
      logger.debug(`Team names match exactly: "${team1}" and "${team2}"`);
      return true;
    }

    // Inclusion match
    if (normalizedTeam1.includes(normalizedTeam2) || normalizedTeam2.includes(normalizedTeam1)) {
      logger.debug(`Team name inclusion match: "${team1}" and "${team2}"`);
      return true;
    }

    // Similarity check
    const similarityThreshold = 0.6; // Lower threshold for Levenshtein distance
    const similarity = this.calculateSimilarity(normalizedTeam1, normalizedTeam2);

    logger.debug(`Team name similarity between "${team1}" and "${team2}": ${similarity.toFixed(2)}`);

    return similarity >= similarityThreshold;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   * @param a First string
   * @param b Second string
   * @returns Similarity score between 0 and 1
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a.length < 2 || b.length < 2) return 0;

    // Direct inclusion check
    if (a.includes(b) || b.includes(a)) {
      return 1;
    }

    // Check for common words
    const aWords = a.split(/\s+/);
    const bWords = b.split(/\s+/);

    // If they share significant words, consider them similar
    const commonWords = aWords.filter(word => 
      word.length > 3 && bWords.some(bWord => bWord.includes(word) || word.includes(bWord))
    );

    if (commonWords.length > 0) {
      return 0.8 + (0.2 * (commonWords.length / Math.max(aWords.length, bWords.length)));
    }

    // Calculate Levenshtein distance
    const levenshteinDistance = (str1: string, str2: string): number => {
      const track = Array(str2.length + 1).fill(null).map(() => 
        Array(str1.length + 1).fill(null));

      for (let i = 0; i <= str1.length; i += 1) {
        track[0][i] = i;
      }

      for (let j = 0; j <= str2.length; j += 1) {
        track[j][0] = j;
      }

      for (let j = 1; j <= str2.length; j += 1) {
        for (let i = 1; i <= str1.length; i += 1) {
          const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
          track[j][i] = Math.min(
            track[j][i - 1] + 1, // deletion
            track[j - 1][i] + 1, // insertion
            track[j - 1][i - 1] + indicator, // substitution
          );
        }
      }

      return track[str2.length][str1.length];
    };

    const distance = levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);

    // Convert distance to similarity score (0-1)
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  /**
   * Get player statistics by ID
   * @param playerId The ID of the player to get statistics for
   * @returns The player's statistics if found, null otherwise
   */
  async getPlayerStats(playerId: string): Promise<CurrentSeasonStats | null> {
    // Check cache first
    const cacheKey = `player:stats:${playerId}`;
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info(`Using cached statistics for player ID: ${playerId}`);
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      logger.warn(`Error checking cache for player statistics: ${cacheError}`);
      // Continue with API request if cache fails
    }

    try {
      logger.info(`Fetching player statistics for player ID: ${playerId}`);

      // Construct the API URL for player statistics
      const statsUrl = `https://sofascore.p.rapidapi.com/players/get-all-statistics?playerId=${playerId}`;

      // Make the API request
      const response = await axios.get<RapidApiPlayerStatsResponse>(statsUrl, {
        headers: this.headers
      });

      // Check if we got valid results
      if (!response.data?.seasons || response.data.seasons.length === 0) {
        logger.warn(`No statistics found for player ID: ${playerId}`);
        return null;
      }

      // Get the current year
      const currentYear = new Date().getFullYear();

      // Find the latest season based on the current year
      // If current year is 2025, look for "24/25"
      // If current year is 2026, look for "25/26"
      const currentSeasonPrefix = `${(currentYear - 1) % 100}/${currentYear % 100}`;

      logger.info(`Looking for season with prefix: ${currentSeasonPrefix}`);

      // Find the season that matches the current season prefix
      let latestSeason = response.data.seasons.find(season => 
        season.year === currentSeasonPrefix
      );

      // If no exact match, find the most recent season
      if (!latestSeason && response.data.seasons.length > 0) {
        logger.info(`No exact match for current season, finding most recent season`);

        // Sort seasons by year in descending order (assuming format like "24/25")
        const sortedSeasons = [...response.data.seasons].sort((a, b) => {
          // Extract the first year from the season (e.g., "24" from "24/25")
          const yearA = parseInt(a.year.split('/')[0]);
          const yearB = parseInt(b.year.split('/')[0]);

          // If years are the same, compare the second part
          if (yearA === yearB) {
            const secondYearA = parseInt(a.year.split('/')[1]);
            const secondYearB = parseInt(b.year.split('/')[1]);
            return secondYearB - secondYearA;
          }

          return yearB - yearA;
        });

        latestSeason = sortedSeasons[0];
      }

      if (!latestSeason) {
        logger.warn(`Could not determine latest season for player ID: ${playerId}`);
        return null;
      }

      logger.info(`Found latest season: ${latestSeason.year} for player ID: ${playerId}`);

      // Map the statistics to our CurrentSeasonStats interface
      const stats = latestSeason.statistics;
      const tournamentName = latestSeason.uniqueTournament.name;

      const currentSeasonStats: CurrentSeasonStats = {
        general: {
          matchesPlayed: stats.appearances || 0,
          minutesPlayed: stats.minutesPlayed || 0,
          goals: stats.goals || 0,
          assists: stats.assists || 0,
          rating: stats.rating || 0
        },
        shooting: {
          totalShots: stats.totalShots || 0,
          shotsOnTarget: stats.shotsOnTarget || 0,
          shotsOffTarget: (stats.totalShots || 0) - (stats.shotsOnTarget || 0) - (stats.blockedShots || 0),
          blockedShots: stats.blockedShots || 0,
          shotAccuracy: stats.totalShots ? (stats.shotsOnTarget || 0) / stats.totalShots * 100 : 0
        },
        teamPlay: {
          dribbleAttempts: (stats.successfulDribbles || 0) / (stats.successfulDribbles ? 1 : 0),
          successfulDribbles: stats.successfulDribbles || 0,
          dribbleSuccess: 0, // Cannot calculate without dribble attempts
          foulsDrawn: 0, // Not available in the API response
          offsides: 0, // Not available in the API response
          dispossessed: 0 // Not available in the API response
        },
        passing: {
          totalPasses: stats.totalPasses || 0,
          accuratePasses: stats.accuratePasses || 0,
          passAccuracy: stats.accuratePassesPercentage || 0,
          keyPasses: stats.keyPasses || 0,
          bigChancesCreated: stats.bigChancesCreated || 0
        },
        defending: {
          tackles: stats.tackles || 0,
          interceptions: stats.interceptions || 0,
          clearances: 0, // Not available in the API response
          blockedShots: stats.blockedShots || 0,
          duelsWon: 0, // Not available in the API response
          duelsLost: 0 // Not available in the API response
        },
        additional: {
          yellowCards: stats.yellowCards || 0,
          redCards: stats.redCards || 0,
          foulsCommitted: 0, // Not available in the API response
          aerialDuelsWon: stats.aerialDuelsWon || 0,
          aerialDuelsLost: 0 // Not available in the API response
        },
        competitions: [
          {
            name: tournamentName,
            general: {
              matchesPlayed: stats.appearances || 0,
              minutesPlayed: stats.minutesPlayed || 0,
              goals: stats.goals || 0,
              assists: stats.assists || 0,
              rating: stats.rating || 0
            },
            shooting: {
              totalShots: stats.totalShots || 0,
              shotsOnTarget: stats.shotsOnTarget || 0,
              shotsOffTarget: (stats.totalShots || 0) - (stats.shotsOnTarget || 0) - (stats.blockedShots || 0),
              blockedShots: stats.blockedShots || 0,
              shotAccuracy: stats.totalShots ? (stats.shotsOnTarget || 0) / stats.totalShots * 100 : 0
            },
            passing: {
              totalPasses: stats.totalPasses || 0,
              accuratePasses: stats.accuratePasses || 0,
              passAccuracy: stats.accuratePassesPercentage || 0,
              keyPasses: stats.keyPasses || 0,
              bigChancesCreated: stats.bigChancesCreated || 0
            },
            defending: {
              tackles: stats.tackles || 0,
              interceptions: stats.interceptions || 0,
              clearances: 0, // Not available in the API response
              blockedShots: stats.blockedShots || 0,
              duelsWon: 0, // Not available in the API response
              duelsLost: 0 // Not available in the API response
            },
            additional: {
              yellowCards: stats.yellowCards || 0,
              redCards: stats.redCards || 0,
              foulsCommitted: 0, // Not available in the API response
              aerialDuelsWon: stats.aerialDuelsWon || 0,
              aerialDuelsLost: 0 // Not available in the API response
            }
          }
        ]
      };

      // Cache the player statistics for 24 hours
      try {
        await redisClient.set(cacheKey, JSON.stringify(currentSeasonStats), {
          EX: 60 * 60 * 24 // 24 hours
        });
        logger.info(`Cached statistics for player ID: ${playerId}`);
      } catch (cacheError) {
        logger.warn(`Error caching player statistics: ${cacheError}`);
        // Continue even if caching fails
      }

      return currentSeasonStats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error fetching player statistics: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get a player's details by searching for them by name
   * @param playerName The name of the player to search for
   * @param teamName Optional team name to match against player's team
   * @returns The player's details if found, null otherwise
   */
  async getPlayerDetails(playerName: string, teamName?: string): Promise<PlayerData | null> {
    // Check cache first
    const cacheKey = `player:${playerName}${teamName ? `:${teamName}` : ''}`;
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info(`Using cached player data for: ${playerName}`);
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      logger.warn(`Error checking cache for player data: ${cacheError}`);
      // Continue with API request if cache fails
    }

    // First search for the player to get their ID
    const playerResult = await this.searchPlayer(playerName, teamName);
    if (!playerResult) {
      logger.warn(`No player found for: ${playerName}${teamName ? ` with team ${teamName}` : ''}`);
      return null;
    }

    try {
      // Get player statistics
      const playerStats = await this.getPlayerStats(playerResult.id);

      // Create player data with statistics
      const playerData = {
        ...playerResult,
        currentSeasonStats: playerStats || undefined
      };

      // Cache the player data for 24 hours
      try {
        await redisClient.set(cacheKey, JSON.stringify(playerData), {
          EX: 60 * 60 * 24 // 24 hours
        });
        logger.info(`Cached player data for: ${playerName}`);
      } catch (cacheError) {
        logger.warn(`Error caching player data: ${cacheError}`);
        // Continue even if caching fails
      }

      return playerData;
    } catch (error) {
      logger.warn(`Error getting player statistics, returning basic player data: ${error}`);
      return playerResult;
    }
  }
}

// Export a singleton instance
let instance: RapidApiPlayerService | null = null;

export function getRapidApiPlayerService(): RapidApiPlayerService {
  if (!instance) {
    instance = new RapidApiPlayerService();
  }
  return instance;
}
