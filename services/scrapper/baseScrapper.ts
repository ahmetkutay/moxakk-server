import puppeteer, {Browser, Page} from "puppeteer";
import logger from "../../utils/logger"; // Import your custom logger

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class ScrapingError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: any
    ) {
        super(message);
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
}

export interface H2HData {
    recentMatches: {
        home: string[];
        away: string[];
        between: string[];
    };
}

export abstract class BaseScraper {
    protected browser: Browser | null = null;
    constructor(
        protected config: ScrapingConfig,
    ) {
        if (!config.selectors) {
            throw new Error("Selectors are missing in the configuration!");
        }
    }

    protected async withRetry<T>(
        operation: () => Promise<T>,
        errorMessage: string
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.config.retries.maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (err) {
                const error = err as Error;
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

        throw new ScrapingError(
            errorMessage,
            'SCRAPING_FAILED',
            {originalError: lastError}
        );
    }

    protected async resetBrowser(): Promise<void> {
        await this.closeBrowser();
        this.browser = await this.initializeBrowser();
    }

    protected async initializeBrowser(): Promise<Browser> {
        return puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        });
    }

    protected async closeBrowser(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    protected async createPage(): Promise<Page> {
        if (!this.browser) {
            this.browser = await this.initializeBrowser();
        }
        return this.browser.newPage();
    }

    async searchMatch(matchInput: string): Promise<string> {
        return this.withRetry(
            async () => {
                const page = await this.createPage();
                logger.info(`Searching for match: ${matchInput}`);
                try {
                    await this.navigateToPage(page);
                    const matchId = await this.findMatchOnPage(page, matchInput);

                    if (!matchId) {
                        throw new ScrapingError(
                            `No match found for input: ${matchInput}`,
                            'MATCH_NOT_FOUND'
                        );
                    }

                    return matchId;
                } finally {
                    await page.close();
                }
            },
            `Failed to search for match: ${matchInput}`
        );
    }

    protected async navigateToPage(page: Page, baseUrl?: string): Promise<void> {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9'
        });

        const url = baseUrl || this.config.baseUrl;
        logger.info(`Navigating to: ${url}`);
        await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: this.config.timeouts.navigation
        });

        if (!page.url().includes("bilyoner.com")) {
            logger.warn("Page redirected, possibly due to anti-bot protection");
            throw new ScrapingError(
                "Page redirected, possibly due to anti-bot protection",
                'ANTI_BOT_PROTECTION'
            );
        }

        if (!url.includes("detay") || !url.includes("karsilastirma")) {
            logger.info("Waiting for list container to load");
            logger.info(`Using selector: ${this.config.selectors.listContainer}`);
            await page.waitForSelector(this.config.selectors.listContainer, {
                timeout: this.config.timeouts.elementWait
            });
            logger.info("List container loaded successfully");
        } else {
            logger.info("Match details loaded successfully");
        }
    }

    protected async findMatchOnPage(page: Page, matchInput: string): Promise<string> {
        await delay(2000);
        logger.info(`Searching for match: ${matchInput}`);

        try {
            const matchId = await page.evaluate(
                async ({matchInput, selectors}) => {
                    const scrollContainer = document.querySelector(selectors.listContainer);
                    if (!scrollContainer) throw new Error("Scroll container not found");

                    let matchId: string | null = null;
                    let lastHeight = 0;
                    const scrollStep = 300;
                    let scrollAttempts = 0;
                    const maxScrollAttempts = 20;

                    function normalizeText(text: string): string {
                        return text.toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .replace(/[^a-z0-9]/g, '')
                            .replace(/\s+/g, '');
                    }

                    function sleep(ms: number): Promise<void> {
                        return new Promise(resolve => setTimeout(resolve, ms));
                    }

                    const [homeTeam, awayTeam] = matchInput.split("-").map(normalizeText);
                    while (!matchId && scrollAttempts < maxScrollAttempts) {
                        const items = Array.from(document.querySelectorAll(selectors.matchItem));
                        for (const item of items) {
                            const linkElement = item.querySelector(selectors.teamNames);
                            if (!linkElement) continue;

                            const teams = linkElement.textContent
                                ?.split("-")
                                .map(team => normalizeText(team.trim()));

                            if (teams?.length === 2) {
                                const [currentHome, currentAway] = teams;
                                if (
                                    (currentHome.includes(homeTeam) || homeTeam.includes(currentHome)) &&
                                    (currentAway.includes(awayTeam) || awayTeam.includes(currentAway))
                                ) {
                                    return item.id;
                                }
                            }
                        }

                        scrollContainer.scrollTop += scrollStep;
                        await sleep(500);

                        if (scrollContainer.scrollHeight === lastHeight) scrollAttempts++;
                        else lastHeight = scrollContainer.scrollHeight;
                    }

                    return matchId;
                },
                {matchInput, selectors: this.config.selectors}
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

    abstract getMatchDetails(matchId: string, homeTeam: string, awayTeam: string): Promise<MatchDetails>;

    async getH2HData(matchId: string): Promise<H2HData> {
        const page = await this.createPage();
        try {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9'
            });

            // Navigate directly to the comparison page
            const comparisonUrl = `${this.config.baseUrlForMatch}/${matchId}/karsilastirma`;
            await page.goto(comparisonUrl, {
                waitUntil: "networkidle0",
                timeout: this.config.timeouts.navigation
            });

            // Wait for initial content load
            await delay(2000);

            const recentMatches = {
                home: await this.getTeamMatches(page, 'home'),
                away: await this.getTeamMatches(page, 'away'),
                between: await this.getBetweenMatches(page)
            };

            return {recentMatches};
        } catch (error) {
            logger.error(`Error fetching H2H data: ${error}`);
            return {
                recentMatches: {
                    home: [],
                    away: [],
                    between: []
                }
            };
        } finally {
            await this.closeBrowser();
        }
    }

    protected abstract getTeamMatches(page: Page, team: 'home' | 'away'): Promise<string[]>;

    protected abstract getBetweenMatches(page: Page): Promise<string[]>;
}