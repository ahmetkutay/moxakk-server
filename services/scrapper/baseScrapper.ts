import { chromium, Browser, BrowserContext, Page } from 'playwright';
import logger from '../../utils/logger';
import { CustomError, ErrorType } from '../../utils/error-handler';
import { ScrapingRateLimiter } from '../../config/db';
import { ProxyService, ProxyConfig } from '../proxy/ProxyService';
import { delay } from '../../utils/common';

export class ScrapingError extends CustomError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, ErrorType.SCRAPING_ERROR, 500, { code, details });
    this.name = 'ScrapingError';
  }
}

export interface ScrapingConfig {
  baseUrl: string;
  baseUrlForMatch: string;
  selectors: {
    listContainer: string;
    matchItem: string;
    teamNames: string;
    theTeams: string;
    venue?: string;
    h2h?: {
      homeMatches: string;
      awayMatches: string;
      betweenMatches: string;
    };
  };
  timeouts: {
    navigation: number;
    elementWait: number;
  };
  retries: {
    maxAttempts: number;
    delayMs: number;
  };
}

export interface MatchDetails {
  homeTeam: string;
  awayTeam: string;
  venue?: string;
  date?: string;
  matchId: string;
  unavailablePlayers?: {
    home: string[];
    away: string[];
  };
}

export interface H2HData {
  recentMatches: {
    home: string[];
    away: string[];
    between: string[];
  };
}

// Anti-detection measures - common user agents
const COMMON_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0',
];

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  private rateLimiter: ScrapingRateLimiter;
  private proxyService: ProxyService;
  private userAgentRotator: string[] = [...COMMON_USER_AGENTS];
  private currentProxy: ProxyConfig | null = null;
  private useProxy = false;

  constructor(protected config: ScrapingConfig) {
    if (!config.selectors) {
      throw new CustomError(
        'Selectors are missing in the configuration!',
        ErrorType.VALIDATION_ERROR,
        400
      );
    }
    this.rateLimiter = ScrapingRateLimiter.getInstance();
    this.proxyService = ProxyService.getInstance();
    this.useProxy = false;
    this.shuffleUserAgents();
  }

  private shuffleUserAgents(): void {
    // Fisher-Yates shuffle algorithm
    for (let i = this.userAgentRotator.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.userAgentRotator[i], this.userAgentRotator[j]] = [
        this.userAgentRotator[j],
        this.userAgentRotator[i],
      ];
    }
  }

  private getRandomUserAgent(): string {
    if (this.userAgentRotator.length === 0) {
      this.userAgentRotator = [...COMMON_USER_AGENTS];
      this.shuffleUserAgents();
    }
    return this.userAgentRotator.pop() || COMMON_USER_AGENTS[0];
  }

  protected async withRetry<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retries.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;
        logger.warn(
          `Attempt ${attempt}/${this.config.retries.maxAttempts} failed: ${error.message}`
        );

        if (attempt < this.config.retries.maxAttempts) {
          await delay(this.config.retries.delayMs);
          await this.resetBrowser();
        }
      }
    }

    throw new ScrapingError(errorMessage, 'SCRAPING_FAILED', {
      originalError: lastError?.message || 'Unknown error',
    });
  }

  protected async resetBrowser(): Promise<void> {
    await this.closeBrowser();
    this.browser = await this.initializeBrowser();
    await this.createContext();
  }

  protected async initializeBrowser(): Promise<Browser> {
    // For Playwright, we use the chromium browser
    return chromium.launch({
      headless: true, // Set to false for debugging
      chromiumSandbox: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--hide-scrollbars',
        '--mute-audio',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      executablePath: process.env.CHROMIUM_PATH || undefined,
    });
  }

  protected async createContext(): Promise<BrowserContext> {
    if (!this.browser) {
      this.browser = await this.initializeBrowser();
    }

    const userAgent = this.getRandomUserAgent();

    const contextOptions: {
      userAgent: string;
      viewport: { width: number; height: number };
      ignoreHTTPSErrors: boolean;
      extraHTTPHeaders: Record<string, string>;
    } = {
      userAgent,
      viewport: { width: 1366, height: 768 },
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      },
    };

    // Create browser context
    this.context = await this.browser.newContext(contextOptions);

    // Add script to mask automation flags
    await this.context.addInitScript(() => {
      // Using safer type handling
      Object.defineProperty(navigator, 'webdriver', {
        get: (): boolean => false,
      });

      // Using type-safe approach
      interface ExtendedNavigator {
        chrome?: { runtime: Record<string, unknown> };
      }
      (window.navigator as ExtendedNavigator).chrome = {
        runtime: {},
      };

      Object.defineProperty(navigator, 'languages', {
        get: (): string[] => ['en-US', 'en', 'tr'],
      });
    });

    return this.context;
  }

  protected async closeBrowser(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(`Error closing browser: ${errorMessage}`);
    }
  }

  protected async createPage(): Promise<Page> {
    if (!this.context) {
      await this.createContext();
    }

    if (!this.context) {
      throw new Error('Browser context is not initialized');
    }

    const page = await this.context.newPage();

    // Set default timeout
    page.setDefaultTimeout(this.config.timeouts.elementWait);

    return page;
  }

  async searchMatch(matchInput: string): Promise<string> {
    return this.withRetry(async () => {
      const hostUrl = new URL(this.config.baseUrl).hostname;
      await this.rateLimiter.acquireToken(hostUrl);

      const page = await this.createPage();
      logger.info(`Searching for match: ${matchInput}`);
      try {
        await this.navigateToPage(page);
        const matchId = await this.findMatchOnPage(page, matchInput);

        if (!matchId) {
          throw new ScrapingError(`No match found for input: ${matchInput}`, 'MATCH_NOT_FOUND');
        }

        return matchId;
      } finally {
        await page.close();
      }
    }, `Failed to search for match: ${matchInput}`);
  }

  protected async navigateToPage(page: Page, baseUrl?: string): Promise<void> {
    const url = baseUrl || this.config.baseUrl;
    logger.info(`Navigating to: ${url}`);

    // Introduce small random delay to make it look more human
    await delay(Math.floor(Math.random() * 500) + 500);

    // Apply rate limiting based on hostname
    const hostUrl = new URL(url).hostname;
    await this.rateLimiter.acquireToken(hostUrl);

    try {
      // Navigate to page with Playwright
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeouts.navigation,
      });

      // Check status
      if (response && !response.ok() && response.status() !== 304) {
        throw new ScrapingError(
          `Failed to load page: status ${response.status()}`,
          'PAGE_LOAD_ERROR'
        );
      }

      // Check if we're redirected to a different page (e.g., Cloudflare challenge)
      if (!page.url().includes(hostUrl)) {
        const currentUrl = page.url();
        logger.warn(`Page redirected to: ${currentUrl}, possibly due to anti-bot protection`);

        // Check for common anti-bot challenge pages
        if (
          currentUrl.includes('challenge') ||
          currentUrl.includes('captcha') ||
          currentUrl.includes('cloudflare') ||
          currentUrl.includes('security')
        ) {
          // Wait to see if the challenge resolves automatically
          await delay(5000);

          // Check again if we're still on the challenge page
          if (!page.url().includes(hostUrl)) {
            throw new ScrapingError('Blocked by anti-bot protection', 'ANTI_BOT_PROTECTION');
          }
        }
      }

      // Wait for the content to load depending on the URL type
      if (!url.includes('detay') && !url.includes('karsilastirma')) {
        logger.info('Waiting for list container to load');
        logger.info(`Using selector: ${this.config.selectors.listContainer}`);
        await page.waitForSelector(this.config.selectors.listContainer, {
          state: 'visible',
          timeout: this.config.timeouts.elementWait,
        });
        logger.info('List container loaded successfully');
      } else {
        // For detail pages, add a small delay to ensure content is loaded
        await delay(1000);
        logger.info('Match details page loaded');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Navigation error: ${errorMessage}`);

      // Take screenshot for debugging
      if (process.env.DEBUG === 'true') {
        try {
          const screenshotPath = `error-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          logger.info(`Error screenshot saved to ${screenshotPath}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e) {
          // Ekran görüntüsü alınırken oluşan hatalar göz ardı edilir
          logger.debug('Failed to take error screenshot');
        }
      }

      throw error;
    }
  }

  protected async findMatchOnPage(page: Page, matchInput: string): Promise<string> {
    await delay(1000);
    logger.info(`Searching for match: ${matchInput}`);

    try {
      // Using Playwright's evaluate to run in browser context
      const matchId = await page.evaluate(
        async ({
          matchInput,
          selectors,
        }: {
          matchInput: string;
          selectors: ScrapingConfig['selectors'];
        }) => {
          const scrollContainer = document.querySelector(selectors.listContainer);
          if (!scrollContainer) throw new Error('Scroll container not found');

          const matchId: string | null = null;
          let lastHeight = 0;
          const scrollStep = 300;
          let scrollAttempts = 0;
          const maxScrollAttempts = 20;

          function normalizeText(text: string): string {
            return text
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]/g, '')
              .replace(/\s+/g, '');
          }

          function sleep(ms: number): Promise<void> {
            return new Promise((resolve) => setTimeout(resolve, ms));
          }

          const [homeTeam, awayTeam] = matchInput.split('-').map(normalizeText);

          const checkTeamsMatch = (team1: string, team2: string): boolean => {
            // Look for teams that include or are included in the input teams
            const directMatch = team1.includes(homeTeam) || homeTeam.includes(team1);
            const reverseMatch = team2.includes(awayTeam) || awayTeam.includes(team2);

            // Compute string similarity for fuzzy matching
            const similarityThreshold = 0.7;
            const similarity = (a: string, b: string): number => {
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
            };

            const homeSimilarity = similarity(team1, homeTeam);
            const awaySimilarity = similarity(team2, awayTeam);

            return (
              (directMatch && reverseMatch) ||
              (homeSimilarity >= similarityThreshold && awaySimilarity >= similarityThreshold)
            );
          };

          while (!matchId && scrollAttempts < maxScrollAttempts) {
            const items = Array.from(document.querySelectorAll(selectors.matchItem));
            for (const item of items) {
              const linkElement = item.querySelector(selectors.teamNames);
              if (!linkElement) continue;

              const teamsText = linkElement.textContent || '';
              const teams = teamsText.split('-').map((team) => normalizeText(team.trim()));

              if (teams?.length === 2) {
                const [currentHome, currentAway] = teams;
                if (checkTeamsMatch(currentHome, currentAway)) {
                  const id = (item as HTMLElement).id;
                  if (id) return id;
                }
              }
            }

            if (scrollContainer instanceof HTMLElement) {
              scrollContainer.scrollTop += scrollStep;
            }
            await sleep(500);

            const newHeight = scrollContainer.scrollHeight;
            if (newHeight === lastHeight) scrollAttempts++;
            else {
              scrollAttempts = 0;
              lastHeight = newHeight;
            }
          }

          return matchId;
        },
        { matchInput, selectors: this.config.selectors }
      );

      if (!matchId) throw new Error(`No match found for input: ${matchInput}`);
      return matchId;
    } catch (err) {
      if (err instanceof Error) {
        logger.error(`Error in findMatchOnPage: ${err.message}`);
      } else {
        logger.error(`Error in findMatchOnPage: ${JSON.stringify(err)}`);
      }
      throw err;
    }
  }

  abstract getMatchDetails(
    matchId: string,
    homeTeam: string,
    awayTeam: string
  ): Promise<MatchDetails>;

  async getH2HData(matchId: string): Promise<H2HData> {
    const page = await this.createPage();
    try {
      // Apply rate limiting
      const hostUrl = new URL(this.config.baseUrlForMatch).hostname;
      await this.rateLimiter.acquireToken(hostUrl);

      // Navigate directly to the comparison page
      const comparisonUrl = `${this.config.baseUrlForMatch}/${matchId}/karsilastirma`;
      await page.goto(comparisonUrl, {
        waitUntil: 'networkidle',
        timeout: this.config.timeouts.navigation,
      });

      // Wait for initial content load
      await delay(2000);

      const recentMatches = {
        home: await this.getTeamMatches(page, 'home'),
        away: await this.getTeamMatches(page, 'away'),
        between: await this.getBetweenMatches(page),
      };

      return { recentMatches };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error fetching H2H data: ${errorMessage}`);

      if (process.env.DEBUG === 'true') {
        try {
          await page.screenshot({ path: `h2h-error-${Date.now()}.png` });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e) {
          // Hata ekran görüntüsü alınırken oluşan hatalar göz ardı edilir
        }
      }

      return {
        recentMatches: {
          home: [],
          away: [],
          between: [],
        },
      };
    } finally {
      await page.close();
    }
  }

  protected abstract getTeamMatches(page: Page, team: 'home' | 'away'): Promise<string[]>;

  protected abstract getBetweenMatches(page: Page): Promise<string[]>;
}
