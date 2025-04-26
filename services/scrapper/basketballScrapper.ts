import { BaseScraper, ScrapingConfig, MatchDetails } from './baseScrapper';
import { Page } from 'playwright';
import logger from '../../utils/logger';
import { delay } from '../../utils/common';

const BASKETBALL_CONFIG: ScrapingConfig = {
  baseUrl: 'https://www.bilyoner.com/iddaa/basketbol',
  baseUrlForMatch: `https://www.bilyoner.com/mac-karti/basketbol`,
  selectors: {
    listContainer: '.sportsbookList',
    matchItem: '.events-container__item',
    teamNames: '.event-row-prematch__cells__teams',
    theTeams: '.match-card__header__content__teams',
    venue:
      '.match-detail__match-info__list__item:last-child .match-detail__match-info__list__item__text',
    h2h: {
      homeMatches: '.quick-statistics__table:first-child .team-against-row',
      awayMatches: '.quick-statistics__table:nth-child(2) .team-against-row',
      betweenMatches: '.quick-statistics__table--last-5-match .team-against-row',
    },
  },
  timeouts: {
    navigation: 60000,
    elementWait: 30000,
  },
  retries: {
    maxAttempts: 3,
    delayMs: 1000,
  },
};

export class BasketballScrapingService extends BaseScraper {
  private static instance: BasketballScrapingService;

  private constructor() {
    super(BASKETBALL_CONFIG);
  }

  static getInstance(): BasketballScrapingService {
    if (!BasketballScrapingService.instance) {
      BasketballScrapingService.instance = new BasketballScrapingService();
    }
    return BasketballScrapingService.instance;
  }

  async getMatchDetails(
    matchId: string,
    homeTeam: string = '',
    awayTeam: string = ''
  ): Promise<MatchDetails> {
    return this.withRetry(async (): Promise<MatchDetails> => {
      const page = await this.createPage();
      try {
        logger.info(`Starting to scrape match details for matchId: ${matchId}`);

        const detailsUrl = `${this.config.baseUrlForMatch}/${matchId}/detay`;
        logger.info(`Navigating to match details URL: ${detailsUrl}`);

        await this.navigateToPage(page, detailsUrl);

        const teams = await page.evaluate((selector): { homeTeam: string; awayTeam: string } => {
          const teamsElement = document.querySelector(selector);
          if (!teamsElement) return { homeTeam: '', awayTeam: '' };

          const text = teamsElement.textContent || '';
          const parts = text.split('-').map((t) => t.trim());
          return {
            homeTeam: parts[0] || '',
            awayTeam: parts[1] || '',
          };
        }, this.config.selectors.theTeams);

        logger.info(`Extracted teams: ${teams.homeTeam} vs ${teams.awayTeam}`);

        const finalHomeTeam = homeTeam || teams.homeTeam;
        const finalAwayTeam = awayTeam || teams.awayTeam;

        return {
          venue: await this.getVenue(page),
          homeTeam: finalHomeTeam,
          awayTeam: finalAwayTeam,
          matchId,
          unavailablePlayers: {
            home: [],
            away: [],
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error in getMatchDetails: ${errorMessage}`);
        throw error;
      } finally {
        await page.close().catch((err) => {
          logger.warn(`Failed to close page: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    }, `Failed to get match details for matchId: ${matchId}`);
  }

  private async getVenue(page: Page): Promise<string> {
    try {
      logger.info('Extracting venue details');

      if (!this.config.selectors.venue) {
        return '';
      }

      const venueElement = await page.$(this.config.selectors.venue);
      if (!venueElement) {
        logger.warn('Venue element not found');
        return '';
      }

      const venueText = await venueElement.textContent();
      const trimmedVenue = venueText?.trim() || '';

      logger.info(`Extracted venue: ${trimmedVenue}`);
      return trimmedVenue;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to extract venue details: ${errorMessage}`);
      return '';
    }
  }

  protected async getTeamMatches(page: Page, team: 'home' | 'away'): Promise<string[]> {
    const selector = this.config.selectors.h2h?.[team === 'home' ? 'homeMatches' : 'awayMatches'];
    if (!selector) {
      logger.warn(`Selector for ${team} team matches is not defined.`);
      return [];
    }

    try {
      logger.info(`Starting to fetch ${team} team matches...`);

      if (!page.url().includes('/karsilastirma')) {
        const currentUrl = page.url();
        const comparisonUrl = currentUrl.replace('/detay', '/karsilastirma');
        logger.info(`Navigating to the comparison page: ${comparisonUrl}`);
        await page.goto(comparisonUrl, { waitUntil: 'networkidle' });
        logger.info('Successfully navigated to the comparison page.');
      }

      try {
        const expandSelector =
          team === 'home'
            ? `.quick-statistics__table__body__row__open-button`
            : `.quick-statistics__table:nth-child(2) .quick-statistics__table__body__row__open-button:nth-child(2)`;

        const expandButton = await page.$(expandSelector);
        if (expandButton) {
          await expandButton.click();
          await delay(1000);
          logger.info('Expand button clicked successfully.');
        }
      } catch (e) {
        logger.warn(
          `Expand button not found or could not be clicked: ${e instanceof Error ? e.message : String(e)}`
        );
      }

      const matchDetails = await page.$$eval(selector, (rows): string[] => {
        return rows.map((row) => {
          const date =
            row.querySelector('.team-against-row__date')?.textContent?.trim().split(' ')[0] || '';
          const homeTeam =
            row.querySelector('.team-against-row__home span')?.textContent?.trim() || '';
          const awayTeam =
            row.querySelector('.team-against-row__away span')?.textContent?.trim() || '';
          const score = row.querySelector('.icon-score')?.textContent?.trim() || '';
          const halfTimeScore =
            row.querySelector('.team-against-row__score--half-time')?.textContent?.trim() || '';

          return `${date} ${homeTeam} ${score} ${awayTeam} (${halfTimeScore})`;
        });
      });

      logger.info(`Found ${matchDetails.length} matches for ${team} team`);
      return matchDetails;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error fetching ${team} team matches: ${errorMessage}`);
      return [];
    }
  }

  protected async getBetweenMatches(page: Page): Promise<string[]> {
    if (!this.config.selectors.h2h?.betweenMatches) return [];

    try {
      if (!page.url().includes('/karsilastirma')) {
        const currentUrl = page.url();
        const comparisonUrl = currentUrl.replace('/detay', '/karsilastirma');
        await page.goto(comparisonUrl, { waitUntil: 'networkidle' });
        await delay(2000);
      }

      try {
        const h2hTab = await page.$('label[for="tab1_1"]');
        if (h2hTab) {
          await h2hTab.click();
          await delay(1000);
        }
      } catch (_e) {
        // H2H sekmesi bulunamadığında veya tıklanırken hata oluştuğunda sessizce devam et
        logger.debug(`H2H sekmesi tıklanamadı: ${_e instanceof Error ? _e.message : String(_e)}`);
      }

      return await page.$$eval(this.config.selectors.h2h.betweenMatches, (rows): string[] => {
        return rows.map((row) => {
          const date =
            row.querySelector('.team-against-row__date')?.textContent?.trim().split(' ')[0] || '';
          const homeTeam =
            row.querySelector('.team-against-row__home span')?.textContent?.trim() || '';
          const awayTeam =
            row.querySelector('.team-against-row__away span')?.textContent?.trim() || '';
          const score = row.querySelector('.icon-score')?.textContent?.trim() || '';
          const halfTimeScore =
            row
              .querySelector('.team-against-row__half-time')
              ?.textContent?.trim()
              .split(':')?.[1]
              ?.trim() || '';

          return `${date}: ${homeTeam} vs ${awayTeam} (FT: ${score} - HT: ${halfTimeScore})`;
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error fetching between matches: ${errorMessage}`);
      return [];
    }
  }
}
