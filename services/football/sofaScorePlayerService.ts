import { BaseScraper, ScrapingConfig, ScrapingError } from '../scrapper/baseScrapper';
import { Page } from 'playwright';
import logger from '../../utils/logger';
import { delay } from '../../utils/common';
import axios from 'axios';
import {
  PlayerData,
  PlayerRating,
  LeaguePerformance,
  PlayerAttributes,
  GeneralStats,
  ShootingStats,
  PassingStats,
  AdditionalStats,
  DefendingStats,
  TeamPlayStats,
  CurrentSeasonStats,
} from '../../types/matches';

// Interface for the SofaScore API search response
interface SofaScoreApiSearchResponse {
  results: SofaScoreApiSearchResult[];
}

interface SofaScoreApiSearchResult {
  entity: {
    id: number;
    name: string;
    slug: string;
    team?: {
      id: number;
      name: string;
      nameCode: string;
      slug: string;
    };
    country?: {
      alpha2: string;
      name: string;
      slug: string;
    };
    shortName?: string;
    position?: string;
    jerseyNumber?: string;
  };
  score: number;
  type: string;
}

interface PlayerSearchResult {
  id: string;
  name: string;
  url: string;
  team?: {
    id: number;
    name: string;
  };
}

export class SofaScorePlayerService extends BaseScraper {
  constructor() {
    const config: ScrapingConfig = {
      baseUrl: 'https://www.sofascore.com',
      baseUrlForMatch: 'https://www.sofascore.com',
      selectors: {
        listContainer: '.sc-fqkvVR',
        matchItem: '.sc-dcJsrY',
        teamNames: '.sc-gFqAkR',
        theTeams: '.sc-gFqAkR',
      },
      timeouts: {
        navigation: 30000,
        elementWait: 15000,
      },
      retries: {
        maxAttempts: 3,
        delayMs: 1000,
      },
    };
    super(config);
  }

  /**
   * Search for a player using the SofaScore API
   * @param playerName The name of the player to search for
   * @param teamName Optional team name to match against player's team
   * @returns The player's search result if found
   */
  async searchPlayerApi(playerName: string, teamName?: string): Promise<PlayerSearchResult | null> {
    return this.withRetry(async () => {
      try {
        logger.info(`Searching for player via API: ${playerName}${teamName ? ` (team: ${teamName})` : ''}`);

        // Construct the API URL
        const apiUrl = `https://www.sofascore.com/api/v1/search/all?q=${encodeURIComponent(playerName)}&page=0`;

        // Make the API request
        const response = await axios.get<SofaScoreApiSearchResponse>(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Accept: 'application/json',
            Referer: 'https://www.sofascore.com/',
          },
        });

        // Check if we got valid results
        if (!response.data?.results || response.data.results.length === 0) {
          logger.warn(`No player found via API for: ${playerName}`);
          return null;
        }

        // Filter results to only include players
        const playerResults = response.data.results.filter(result => result.type === 'player');

        if (playerResults.length === 0) {
          logger.warn(`No player results found via API for: ${playerName}`);
          return null;
        }

        // If team name is provided, try to find a player with matching team
        if (teamName) {
          // Find players with matching team names
          const playersWithTeam = playerResults.filter(result => result.entity.team);

          // Check for team name matches
          for (const result of playersWithTeam) {
            if (this.checkTeamNameMatch(result.entity.team?.name || '', teamName)) {
              logger.info(`Found player ${result.entity.name} with matching team ${result.entity.team?.name}`);
              return {
                id: result.entity.id.toString(),
                name: result.entity.name,
                url: `/player/${result.entity.slug}/${result.entity.id}`,
                team: result.entity.team ? {
                  id: result.entity.team.id,
                  name: result.entity.team.name
                } : undefined
              };
            }
          }

          logger.warn(`No player found with matching team for: ${playerName}, team: ${teamName}`);
        }

        // If no team match or no team provided, return the first result
        const bestResult = playerResults[0];
        return {
          id: bestResult.entity.id.toString(),
          name: bestResult.entity.name,
          url: `/player/${bestResult.entity.slug}/${bestResult.entity.id}`,
          team: bestResult.entity.team ? {
            id: bestResult.entity.team.id,
            name: bestResult.entity.team.name
          } : undefined
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error searching player via API: ${errorMessage}`);
        throw new ScrapingError(`Failed to search player via API: ${errorMessage}`, 'API_SEARCH_ERROR');
      }
    }, `Failed to search for player via API: ${playerName}`);
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
      return true;
    }

    // Inclusion match
    if (normalizedTeam1.includes(normalizedTeam2) || normalizedTeam2.includes(normalizedTeam1)) {
      return true;
    }

    // Similarity check
    const similarityThreshold = 0.7;
    const similarity = this.calculateSimilarity(normalizedTeam1, normalizedTeam2);

    return similarity >= similarityThreshold;
  }

  /**
   * Calculate similarity between two strings
   * @param a First string
   * @param b Second string
   * @returns Similarity score between 0 and 1
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a.length < 2 || b.length < 2) return 0;

    if (a.includes(b) || b.includes(a)) {
      return 1;
    }

    // Simple substring match
    for (let i = 0; i < a.length - 1; i++) {
      const substring = a.substring(i, i + 2);
      if (b.includes(substring)) {
        return 0.8;
      }
    }

    return 0;
  }

  /**
   * Search for a player on SofaScore and return their ID
   * @param playerName The name of the player to search for
   * @param teamName Optional team name to match against player's team
   * @returns The player's ID and URL if found
   */
  async searchPlayer(playerName: string, teamName?: string): Promise<PlayerSearchResult | null> {
    // First try to search using the API
    try {
      const apiResult = await this.searchPlayerApi(playerName, teamName);
      if (apiResult) {
        return apiResult;
      }
    } catch (error) {
      logger.warn(`API search failed, falling back to web scraping: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Fall back to web scraping if API search fails
    return this.withRetry(async () => {
      const page = await this.createPage();
      try {
        logger.info(`Searching for player via web scraping: ${playerName}`);

        // Navigate to SofaScore search page with the player name
        const searchUrl = `${this.config.baseUrl}/search/${encodeURIComponent(playerName)}`;
        await this.navigateToSearchPage(page, searchUrl);

        // Wait for search results to load
        await delay(2000);

        // Find player in search results
        const playerResult = await this.findPlayerInSearchResults(page, playerName);

        if (!playerResult) {
          logger.warn(`No player found for: ${playerName}`);
          return null;
        }

        return playerResult;
      } finally {
        await page.close();
      }
    }, `Failed to search for player: ${playerName}`);
  }

  /**
   * Navigate to the search page
   */
  private async navigateToSearchPage(page: Page, url: string): Promise<void> {
    logger.info(`Navigating to search page: ${url}`);

    try {
      // Navigate to the search page
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeouts.navigation,
      });

      // Check if navigation was successful
      if (response && !response.ok() && response.status() !== 304) {
        throw new ScrapingError(
          `Failed to load search page: status ${response.status()}`,
          'PAGE_LOAD_ERROR'
        );
      }

      // Wait for the page to load
      await delay(2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Navigation error: ${errorMessage}`);

      // Take screenshot for debugging if in debug mode
      if (process.env.DEBUG === 'true') {
        try {
          const screenshotPath = `error-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          logger.info(`Error screenshot saved to ${screenshotPath}`);
        } catch {
          logger.debug('Failed to take error screenshot');
        }
      }

      throw error;
    }
  }

  /**
   * Find a player in the search results
   */
  private async findPlayerInSearchResults(
    page: Page,
    playerName: string
  ): Promise<PlayerSearchResult | null> {
    try {
      // Look for player cards in the search results
      const playerResult = await page.evaluate((name) => {
        // Normalize the search name for comparison
        const normalizedSearchName = name.toLowerCase().trim();

        // Find all player cards
        const playerCards = Array.from(document.querySelectorAll('a[href*="/player/"]'));

        // Find the first player card that matches the name
        for (const card of playerCards) {
          const playerNameElement = card.querySelector('.sc-gFqAkR');
          if (playerNameElement) {
            const cardPlayerName = playerNameElement.textContent?.trim().toLowerCase() || '';

            // Check if the player name matches
            if (
              cardPlayerName.includes(normalizedSearchName) ||
              normalizedSearchName.includes(cardPlayerName)
            ) {
              const href = card.getAttribute('href') || '';
              const urlParts = href.split('/');
              const id = urlParts[urlParts.length - 1];

              return {
                id,
                name: playerNameElement.textContent?.trim() || '',
                url: href,
              };
            }
          }
        }

        return null;
      }, playerName);

      return playerResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error finding player in search results: ${errorMessage}`);
      return null;
    }
  }

  // Required abstract method implementations from BaseScraper
  async getMatchDetails(matchId: string, homeTeam: string, awayTeam: string) {
    // Not used for player search, but required by BaseScraper
    return {
      homeTeam,
      awayTeam,
      matchId,
    };
  }

  protected async getTeamMatches(_page: Page, _team: 'home' | 'away'): Promise<string[]> {
    // Not used for player search, but required by BaseScraper
    return [];
  }

  protected async getBetweenMatches(_page: Page): Promise<string[]> {
    // Not used for player search, but required by BaseScraper
    return [];
  }

  /**
   * Get a player's SofaScore URL by searching for them by name
   * @param playerName The name of the player to search for
   * @param teamName Optional team name to match against player's team
   * @returns The player's SofaScore URL if found, null otherwise
   */
  async getPlayerUrl(playerName: string, teamName?: string): Promise<string | null> {
    const playerResult = await this.searchPlayer(playerName, teamName);
    if (!playerResult) {
      return null;
    }
    return getPlayerSofaScoreUrl(playerResult.name, playerResult.id);
  }

  /**
   * Get detailed player information from SofaScore
   * @param playerName The name of the player to search for
   * @param teamName Optional team name to match against player's team
   * @returns Detailed player data including strengths, weaknesses, ratings, league performance, and attributes
   */
  async getPlayerDetails(playerName: string, teamName?: string): Promise<PlayerData | null> {
    return this.withRetry(async () => {
      // First search for the player to get their ID and URL
      const playerResult = await this.searchPlayer(playerName, teamName);
      if (!playerResult) {
        logger.warn(`No player found for: ${playerName}${teamName ? ` with team ${teamName}` : ''}`);
        return null;
      }

      const page = await this.createPage();
      try {
        // Get the full URL to the player's profile
        const playerUrl = getPlayerSofaScoreUrl(playerResult.name, playerResult.id);
        logger.info(`Fetching player details from: ${playerUrl}`);

        // Navigate to the player's profile page
        await page.goto(playerUrl, {
          waitUntil: 'networkidle',
          timeout: this.config.timeouts.navigation,
        });

        // Wait for the page to load
        await delay(3000);

        // Extract player strengths and weaknesses
        const { strengths, weaknesses } = await this.extractStrengthsAndWeaknesses(page);

        // Extract player ratings
        const { averageRating, monthlyRatings } = await this.extractPlayerRatings(page);

        // Extract league performance data
        const leaguePerformance = await this.extractLeaguePerformance(page);

        // Extract player attributes
        const attributes = await this.extractPlayerAttributes(page);

        // Check if we need to click "Show more" to see all leagues
        await this.expandLeaguePerformance(page);

        // Extract league performance data again if we expanded the section
        const expandedLeaguePerformance =
          leaguePerformance.length > 0
            ? await this.extractLeaguePerformance(page)
            : leaguePerformance;

        // Extract current season statistics
        const currentSeasonStats = await this.extractCurrentSeasonStats(page);

        // Return the complete player data
        return {
          ...playerResult,
          strengths,
          weaknesses,
          averageRating,
          monthlyRatings,
          leaguePerformance: expandedLeaguePerformance,
          attributes,
          currentSeasonStats,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error fetching player details: ${errorMessage}`);

        // Return basic player data if we can't get the details
        return playerResult;
      } finally {
        await page.close();
      }
    }, `Failed to get player details: ${playerName}`);
  }

  /**
   * Expand the league performance section by clicking "Show more" if available
   */
  private async expandLeaguePerformance(page: Page): Promise<void> {
    try {
      // Check if "Show more" button exists and click it
      const showMoreExists = await page.evaluate(() => {
        const showMoreButton = document.querySelector(
          '.textStyle_display\\.small.c_primary\\.default'
        );
        if (showMoreButton && showMoreButton.textContent?.includes('Show more')) {
          (showMoreButton as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (showMoreExists) {
        logger.info('Clicked "Show more" to expand league performance data');
        // Wait for expanded content to load
        await delay(1000);
      }
    } catch (error) {
      logger.error(`Error expanding league performance: ${error}`);
      // Continue even if expansion fails
    }
  }

  /**
   * Extract player strengths and weaknesses from the profile page
   */
  private async extractStrengthsAndWeaknesses(
    page: Page
  ): Promise<{ strengths: string[]; weaknesses: string[] }> {
    try {
      return await page.evaluate(() => {
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        // Find the strengths section
        const strengthsSection = document.querySelector('div[color="success.default"]');
        if (strengthsSection && strengthsSection.parentElement) {
          // Find all strength spans in the next sibling div
          const strengthSpans = strengthsSection.parentElement
            .querySelector('.Box.klGMtt')
            ?.querySelectorAll('span[color="onSurface.nLv1"]');
          if (strengthSpans) {
            strengthSpans.forEach((span) => {
              const text = span.textContent?.trim();
              if (text) strengths.push(text);
            });
          }
        }

        // Find the weaknesses section
        const weaknessesSection = document.querySelector('div[color="error.default"]');
        if (weaknessesSection && weaknessesSection.parentElement) {
          // Find all weakness spans in the next sibling
          const weaknessSpans = weaknessesSection.parentElement.querySelectorAll(
            'span[color="onSurface.nLv1"]'
          );
          if (weaknessSpans) {
            weaknessSpans.forEach((span) => {
              const text = span.textContent?.trim();
              if (text && text !== 'No outstanding weaknesses') weaknesses.push(text);
            });
          }
        }

        return { strengths, weaknesses };
      });
    } catch (error) {
      logger.error(`Error extracting strengths and weaknesses: ${error}`);
      return { strengths: [], weaknesses: [] };
    }
  }

  /**
   * Extract player ratings from the profile page
   */
  private async extractPlayerRatings(
    page: Page
  ): Promise<{ averageRating?: number; monthlyRatings?: PlayerRating[] }> {
    try {
      return await page.evaluate(() => {
        const monthlyRatings: PlayerRating[] = [];
        let averageRating: number | undefined;

        // Extract average rating
        const ratingElement = document.querySelector('span[aria-valuenow]');
        if (ratingElement) {
          const ratingText = ratingElement.textContent?.trim();
          if (ratingText) {
            averageRating = parseFloat(ratingText);
          }
        }

        // Extract monthly ratings
        const monthElements = document.querySelectorAll('.Text.dtrnNc');
        const ratingElements = document.querySelectorAll('.Text.fnGzuT, .Text.gYPQHU');

        // Combine month and rating data
        for (let i = 0; i < monthElements.length; i++) {
          const monthText = monthElements[i].textContent?.trim();
          const ratingText = ratingElements[i]?.textContent?.trim();

          if (monthText && ratingText) {
            monthlyRatings.push({
              month: monthText,
              value: parseFloat(ratingText),
            });
          }
        }

        return { averageRating, monthlyRatings };
      });
    } catch (error) {
      logger.error(`Error extracting player ratings: ${error}`);
      return { averageRating: undefined, monthlyRatings: [] };
    }
  }

  /**
   * Extract league performance data from the profile page
   */
  private async extractLeaguePerformance(page: Page): Promise<LeaguePerformance[]> {
    try {
      return await page.evaluate(() => {
        const leaguePerformance: LeaguePerformance[] = [];

        // Find all tournament rows
        const tournamentRows = document.querySelectorAll('a[data-testid="summary_tournament_row"]');

        // Process each tournament row
        tournamentRows.forEach((row) => {
          // Extract league name
          const leagueNameElement = row.querySelector('.Text.gpUqFG');
          if (!leagueNameElement) return;

          const leagueName = leagueNameElement.textContent?.trim();
          if (!leagueName) return;

          // Extract appearances
          const appearancesElement = row.querySelector('.Text.fftNCK');
          if (!appearancesElement) return;

          const appearancesText = appearancesElement.textContent?.trim();
          if (!appearancesText) return;

          // Parse appearances number (format: "X appearances" or "X appearance")
          const appearancesMatch = appearancesText.match(/(\d+)/);
          if (!appearancesMatch) return;

          const appearances = parseInt(appearancesMatch[1], 10);

          // Extract rating
          const ratingElement = row.querySelector('span[aria-valuenow]');
          if (!ratingElement) return;

          const ratingText = ratingElement.textContent?.trim();
          if (!ratingText) return;

          const rating = parseFloat(ratingText);

          // Add to league performance array
          leaguePerformance.push({
            name: leagueName,
            appearances,
            rating,
          });
        });

        return leaguePerformance;
      });
    } catch (error) {
      logger.error(`Error extracting league performance: ${error}`);
      return [];
    }
  }

  /**
   * Extract player attributes from the profile page
   */
  private async extractPlayerAttributes(page: Page): Promise<PlayerAttributes | undefined> {
    try {
      return await page.evaluate(() => {
        // Find the attribute overview section
        const attributeOverview = document.querySelector('[data-testid="attribute_overview"]');
        if (!attributeOverview) return undefined;

        // Initialize attributes object
        const attributes: PlayerAttributes = {
          attacking: 0,
          technical: 0,
          tactical: 0,
          defending: 0,
          creativity: 0,
        };

        // Extract attacking attribute
        const attackingElement = attributeOverview.querySelector('.attacking .w_\\[20px\\] span');
        if (attackingElement) {
          attributes.attacking = parseInt(attackingElement.textContent || '0', 10);
        }

        // Extract technical attribute
        const technicalElement = attributeOverview.querySelector('.technical .w_\\[20px\\] span');
        if (technicalElement) {
          attributes.technical = parseInt(technicalElement.textContent || '0', 10);
        }

        // Extract tactical attribute
        const tacticalElement = attributeOverview.querySelector('.tactical .w_\\[20px\\] span');
        if (tacticalElement) {
          attributes.tactical = parseInt(tacticalElement.textContent || '0', 10);
        }

        // Extract defending attribute
        const defendingElement = attributeOverview.querySelector('.defending .w_\\[20px\\] span');
        if (defendingElement) {
          attributes.defending = parseInt(defendingElement.textContent || '0', 10);
        }

        // Extract creativity attribute
        const creativityElement = attributeOverview.querySelector('.creativity .w_\\[20px\\] span');
        if (creativityElement) {
          attributes.creativity = parseInt(creativityElement.textContent || '0', 10);
        }

        return attributes;
      });
    } catch (error) {
      logger.error(`Error extracting player attributes: ${error}`);
      return undefined;
    }
  }

  /**
   * Extract general statistics from the General tab
   */
  private async extractGeneralStats(page: Page): Promise<
    | {
        overall?: GeneralStats;
        competitions?: Array<{ name: string; stats: GeneralStats }>;
      }
    | undefined
  > {
    try {
      return await page.evaluate(() => {
        // Find the current season section (24/25)
        const yearElement = document.querySelector('.Text.ibDCyB');
        if (!yearElement || !yearElement.textContent?.includes('24/25')) {
          return undefined;
        }

        // Find the general stats table
        const statsTable = document.querySelector('.Box.hMcCqO');
        if (!statsTable) {
          return undefined;
        }

        // Extract overall stats (first row)
        const overallRow = statsTable.querySelector('.Box.Flex.ggRYVx.cQgcrM');
        if (!overallRow) {
          return undefined;
        }

        // Extract values from the row
        const columns = overallRow.querySelectorAll('.Box.Flex.kpWVsH.kFvGEE');
        if (columns.length < 5) {
          return undefined;
        }

        // Parse the values
        const matchesPlayed = parseInt(columns[0].textContent?.trim() || '0', 10);
        const minutesPlayed = parseInt(columns[1].textContent?.trim() || '0', 10);
        const goals = parseInt(columns[2].textContent?.trim() || '0', 10);
        const assists = parseInt(columns[3].textContent?.trim() || '0', 10);

        // Extract rating from the rating element
        const ratingElement = columns[4].querySelector('span[aria-valuenow]');
        const rating = ratingElement ? parseFloat(ratingElement.textContent?.trim() || '0') : 0;

        // Create the overall stats object
        const overall: GeneralStats = {
          matchesPlayed,
          minutesPlayed,
          goals,
          assists,
          rating,
        };

        // Extract competition-specific stats
        const competitions: Array<{ name: string; stats: GeneralStats }> = [];

        // Find all competition rows
        const competitionRows = document.querySelectorAll('.Box.Flex.gQIPzn.fRroAj');

        // Extract competition names
        const competitionNames: string[] = [];
        competitionRows.forEach((row) => {
          const nameElement = row.querySelector('.Text.eBpqWC');
          if (nameElement && nameElement.textContent) {
            competitionNames.push(nameElement.textContent.trim());
          }
        });

        // Extract competition stats
        const competitionStatsRows = document.querySelectorAll(
          '.Box.Flex.ggRYVx.iWGVcA > .Box.Flex.ggRYVx.cQgcrM'
        );

        competitionStatsRows.forEach((row, index) => {
          if (index >= competitionNames.length) return;

          const columns = row.querySelectorAll('.Box.Flex.kpWVsH.kFvGEE');
          if (columns.length < 5) return;

          // Parse the values
          const matchesPlayed = parseInt(columns[0].textContent?.trim() || '0', 10);
          const minutesPlayed = parseInt(columns[1].textContent?.trim() || '0', 10);
          const goals = parseInt(columns[2].textContent?.trim() || '0', 10);
          const assists = parseInt(columns[3].textContent?.trim() || '0', 10);

          // Extract rating from the rating element
          const ratingElement = columns[4].querySelector('span[aria-valuenow]');
          const rating = ratingElement ? parseFloat(ratingElement.textContent?.trim() || '0') : 0;

          // Add to competitions array
          competitions.push({
            name: competitionNames[index],
            stats: {
              matchesPlayed,
              minutesPlayed,
              goals,
              assists,
              rating,
            },
          });
        });

        return { overall, competitions };
      });
    } catch (error) {
      logger.error(`Error extracting general statistics: ${error}`);
      return undefined;
    }
  }

  /**
   * Extract statistics from other tabs (Shooting, Team play, Passing, Defending, Additional)
   */
  private async extractTabStats(page: Page): Promise<
    | {
        shooting?: {
          overall?: ShootingStats;
          competitions?: Array<{ name: string; stats: ShootingStats }>;
        };
        teamPlay?: {
          overall?: TeamPlayStats;
          competitions?: Array<{ name: string; stats: TeamPlayStats }>;
        };
        passing?: {
          overall?: PassingStats;
          competitions?: Array<{ name: string; stats: PassingStats }>;
        };
        defending?: {
          overall?: DefendingStats;
          competitions?: Array<{ name: string; stats: DefendingStats }>;
        };
        additional?: {
          overall?: AdditionalStats;
          competitions?: Array<{ name: string; stats: AdditionalStats }>;
        };
      }
    | undefined
  > {
    try {
      // Find and click on each tab to extract its statistics
      const tabStats = {
        shooting: await this.extractShootingStats(page),
        teamPlay: await this.extractTeamPlayStats(page),
        passing: await this.extractPassingStats(page),
        defending: await this.extractDefendingStats(page),
        additional: await this.extractAdditionalStats(page),
      };

      return tabStats;
    } catch (error) {
      logger.error(`Error extracting tab statistics: ${error}`);
      return undefined;
    }
  }

  /**
   * Click on a tab and extract its statistics
   */
  private async clickTab(page: Page, tabId: string): Promise<boolean> {
    try {
      const clicked = await page.evaluate((id) => {
        const tab = document.querySelector(`button[data-tabid="${id}"]`);
        if (tab) {
          (tab as HTMLElement).click();
          return true;
        }
        return false;
      }, tabId);

      if (clicked) {
        // Wait for tab content to load
        await delay(1000);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error clicking tab ${tabId}: ${error}`);
      return false;
    }
  }

  /**
   * Extract shooting statistics from the Shooting tab
   */
  private async extractShootingStats(page: Page): Promise<
    | {
        overall?: ShootingStats;
        competitions?: Array<{ name: string; stats: ShootingStats }>;
      }
    | undefined
  > {
    try {
      // Click on the Shooting tab
      const tabClicked = await this.clickTab(page, 'shootingGroup');
      if (!tabClicked) {
        return undefined;
      }

      // Extract shooting statistics
      return await page.evaluate(() => {
        // Implementation will be similar to extractGeneralStats but for shooting stats
        // For now, return a placeholder
        return undefined;
      });
    } catch (error) {
      logger.error(`Error extracting shooting statistics: ${error}`);
      return undefined;
    }
  }

  /**
   * Extract team play statistics from the Team play tab
   */
  private async extractTeamPlayStats(page: Page): Promise<
    | {
        overall?: TeamPlayStats;
        competitions?: Array<{ name: string; stats: TeamPlayStats }>;
      }
    | undefined
  > {
    try {
      // Click on the Team play tab
      const tabClicked = await this.clickTab(page, 'teamPlayGroup');
      if (!tabClicked) {
        return undefined;
      }

      // Extract team play statistics
      return await page.evaluate(() => {
        // Implementation will be similar to extractGeneralStats but for team play stats
        // For now, return a placeholder
        return undefined;
      });
    } catch (error) {
      logger.error(`Error extracting team play statistics: ${error}`);
      return undefined;
    }
  }

  /**
   * Extract passing statistics from the Passing tab
   */
  private async extractPassingStats(page: Page): Promise<
    | {
        overall?: PassingStats;
        competitions?: Array<{ name: string; stats: PassingStats }>;
      }
    | undefined
  > {
    try {
      // Click on the Passing tab
      const tabClicked = await this.clickTab(page, 'passingGroup');
      if (!tabClicked) {
        return undefined;
      }

      // Extract passing statistics
      return await page.evaluate(() => {
        // Implementation will be similar to extractGeneralStats but for passing stats
        // For now, return a placeholder
        return undefined;
      });
    } catch (error) {
      logger.error(`Error extracting passing statistics: ${error}`);
      return undefined;
    }
  }

  /**
   * Extract defending statistics from the Defending tab
   */
  private async extractDefendingStats(page: Page): Promise<
    | {
        overall?: DefendingStats;
        competitions?: Array<{ name: string; stats: DefendingStats }>;
      }
    | undefined
  > {
    try {
      // Click on the Defending tab
      const tabClicked = await this.clickTab(page, 'defendingGroup');
      if (!tabClicked) {
        return undefined;
      }

      // Extract defending statistics
      return await page.evaluate(() => {
        // Implementation will be similar to extractGeneralStats but for defending stats
        // For now, return a placeholder
        return undefined;
      });
    } catch (error) {
      logger.error(`Error extracting defending statistics: ${error}`);
      return undefined;
    }
  }

  /**
   * Extract additional statistics from the Additional tab
   */
  private async extractAdditionalStats(page: Page): Promise<
    | {
        overall?: AdditionalStats;
        competitions?: Array<{ name: string; stats: AdditionalStats }>;
      }
    | undefined
  > {
    try {
      // Click on the Additional tab
      const tabClicked = await this.clickTab(page, 'additionalGroup');
      if (!tabClicked) {
        return undefined;
      }

      // Extract additional statistics
      return await page.evaluate(() => {
        // Implementation will be similar to extractGeneralStats but for additional stats
        // For now, return a placeholder
        return undefined;
      });
    } catch (error) {
      logger.error(`Error extracting additional statistics: ${error}`);
      return undefined;
    }
  }

  /**
   * Extract current season statistics from the player's profile page
   */
  private async extractCurrentSeasonStats(page: Page): Promise<CurrentSeasonStats | undefined> {
    try {
      // First extract general statistics from the General tab
      const generalStats = await this.extractGeneralStats(page);

      // Initialize the current season stats object
      const currentSeasonStats: CurrentSeasonStats = {
        general: generalStats?.overall,
        competitions: [],
      };

      // Add competition-specific general stats
      if (generalStats?.competitions) {
        currentSeasonStats.competitions = generalStats.competitions.map((comp) => ({
          name: comp.name,
          general: comp.stats,
        }));
      }

      // Extract statistics from other tabs
      const tabStats = await this.extractTabStats(page);

      // Merge tab stats into current season stats
      if (tabStats) {
        currentSeasonStats.shooting = tabStats.shooting?.overall;
        currentSeasonStats.teamPlay = tabStats.teamPlay?.overall;
        currentSeasonStats.passing = tabStats.passing?.overall;
        currentSeasonStats.defending = tabStats.defending?.overall;
        currentSeasonStats.additional = tabStats.additional?.overall;

        // Merge competition-specific tab stats
        if (tabStats.shooting?.competitions) {
          tabStats.shooting.competitions.forEach((comp) => {
            const existingComp = currentSeasonStats.competitions.find((c) => c.name === comp.name);
            if (existingComp) {
              existingComp.shooting = comp.stats;
            } else {
              currentSeasonStats.competitions.push({
                name: comp.name,
                shooting: comp.stats,
              });
            }
          });
        }

        if (tabStats.teamPlay?.competitions) {
          tabStats.teamPlay.competitions.forEach((comp) => {
            const existingComp = currentSeasonStats.competitions.find((c) => c.name === comp.name);
            if (existingComp) {
              existingComp.teamPlay = comp.stats;
            } else {
              currentSeasonStats.competitions.push({
                name: comp.name,
                teamPlay: comp.stats,
              });
            }
          });
        }

        if (tabStats.passing?.competitions) {
          tabStats.passing.competitions.forEach((comp) => {
            const existingComp = currentSeasonStats.competitions.find((c) => c.name === comp.name);
            if (existingComp) {
              existingComp.passing = comp.stats;
            } else {
              currentSeasonStats.competitions.push({
                name: comp.name,
                passing: comp.stats,
              });
            }
          });
        }

        if (tabStats.defending?.competitions) {
          tabStats.defending.competitions.forEach((comp) => {
            const existingComp = currentSeasonStats.competitions.find((c) => c.name === comp.name);
            if (existingComp) {
              existingComp.defending = comp.stats;
            } else {
              currentSeasonStats.competitions.push({
                name: comp.name,
                defending: comp.stats,
              });
            }
          });
        }

        if (tabStats.additional?.competitions) {
          tabStats.additional.competitions.forEach((comp) => {
            const existingComp = currentSeasonStats.competitions.find((c) => c.name === comp.name);
            if (existingComp) {
              existingComp.additional = comp.stats;
            } else {
              currentSeasonStats.competitions.push({
                name: comp.name,
                additional: comp.stats,
              });
            }
          });
        }
      }

      return currentSeasonStats;
    } catch (error) {
      logger.error(`Error extracting current season statistics: ${error}`);
      return undefined;
    }
  }
}

/**
 * Get a player's SofaScore URL
 * @param playerName The name of the player
 * @param playerId The ID of the player
 * @returns The full SofaScore URL for the player
 */
export function getPlayerSofaScoreUrl(playerName: string, playerId: string): string {
  const formattedName = playerName.toLowerCase().replace(/\s+/g, '-');
  return `https://www.sofascore.com/player/${formattedName}/${playerId}`;
}

// Export a singleton instance
let instance: SofaScorePlayerService | null = null;

export function getSofaScorePlayerService(): SofaScorePlayerService {
  if (!instance) {
    instance = new SofaScorePlayerService();
  }
  return instance;
}
