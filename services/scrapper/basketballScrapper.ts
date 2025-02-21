import {BaseScraper, ScrapingConfig, MatchDetails, PUPPETEER_CONFIG} from "./baseScrapper"
import {Page} from "puppeteer"
import logger from "../../utils/logger" // Import your custom logger
import puppeteer from "puppeteer"
import { Browser } from "puppeteer"

const BASKETBALL_CONFIG: ScrapingConfig = {
    baseUrl: "https://www.bilyoner.com/iddaa/basketbol",
    baseUrlForMatch: `https://www.bilyoner.com/mac-karti/basketbol`,
    selectors: {
        listContainer: ".sportsbookList",
        matchItem: ".events-container__item",
        teamNames: ".event-row-prematch__cells__teams",
        theTeams: ".match-card__header__content__teams",
        venue: ".match-detail__match-info__list__item:last-child .match-detail__match-info__list__item__text",
        h2h: {
            homeMatches: ".quick-statistics__table:first-child .team-against-row",
            awayMatches: ".quick-statistics__table:nth-child(2) .team-against-row",
            betweenMatches: ".quick-statistics__table--last-5-match .team-against-row"
        }
    },
    timeouts: {
        navigation: 60000,
        elementWait: 30000
    },
    retries: {
        maxAttempts: 3,
        delayMs: 1000
    }
}

async function delay(page: Page, ms: number): Promise<void> {
    try {
        await Promise.race([
            page.waitForFunction(`new Promise(r => setTimeout(r, ${ms}))`),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Delay timeout')), ms + 5000)
            )
        ])
    } catch (error) {
        logger.warn(`Delay warning: ${error}`)
        // Fallback to basic setTimeout if page.waitForFunction fails
        await new Promise(resolve => setTimeout(resolve, ms))
    }
}

export class BasketballScrapingService extends BaseScraper {
    private static instance: BasketballScrapingService

    private constructor() {
        super(BASKETBALL_CONFIG)
    }

    static getInstance(): BasketballScrapingService {
        if (!BasketballScrapingService.instance) {
            BasketballScrapingService.instance = new BasketballScrapingService()
        }
        return BasketballScrapingService.instance
    }

    async getMatchDetails(matchId: string): Promise<MatchDetails> {
        const page = await this.createPage()
        try {
            logger.info(`Starting to scrape match details for matchId: ${matchId}`)
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

            const detailsUrl = `${this.config.baseUrlForMatch}/${matchId}/detay`
            logger.info(`Navigating to match details URL: ${detailsUrl}`)
            let retryCount = 0
            while (retryCount < this.config.retries.maxAttempts) {
                try {
                    await page.goto(detailsUrl, {
                        waitUntil: ["load", "domcontentloaded"],
                        timeout: this.config.timeouts.navigation
                    })
                    logger.info(`Page loaded: ${page.url()}`)
                    await delay(page, 2000)

                    // Wait for any one of these selectors to appear
                    await Promise.race([
                        page.waitForSelector(this.config.selectors.theTeams, {
                            timeout: this.config.timeouts.elementWait
                        }),
                        page.waitForSelector('.error-page', {
                            timeout: this.config.timeouts.elementWait
                        })
                    ])

                    // Check if error page is shown
                    const isErrorPage = await page.$('.error-page')
                    if (isErrorPage) throw new Error('Match details page not available')

                    break
                } catch (error) {
                    retryCount++
                    console.warn(`Retry ${retryCount}/${this.config.retries.maxAttempts}: ${error}`)
                    if (retryCount === this.config.retries.maxAttempts) throw error
                    await new Promise(resolve => setTimeout(resolve, this.config.retries.delayMs))
                }
            }

            // Use a shorter timeout for content extraction
            const teams = await Promise.race([
                page.$eval(
                    this.config.selectors.theTeams,
                    (el) => {
                        const text = el.textContent || ''
                        const [homeTeam, awayTeam] = text.split('-').map(t => t.trim())
                        return {homeTeam, awayTeam}
                    }
                ),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Content extraction timeout')), 10000)
                )
            ]) as { homeTeam: string, awayTeam: string }

            logger.info(`Extracted teams: ${teams.homeTeam} vs ${teams.awayTeam}`)
            return {
                venue: await this.getVenue(page),
                homeTeam: teams.homeTeam,
                awayTeam: teams.awayTeam,
                matchId
            }
        } catch (error) {
            console.error(`Error in getMatchDetails for matchId ${matchId}:`, error)
            return {venue: '', homeTeam: '', awayTeam: '', matchId}
        } finally {
            await this.closeBrowser()
        }
    }

    private async getVenue(page: Page): Promise<string> {
        try {
            logger.info('Extracting venue details');
            logger.info(`Page URL: ${page.url()}`);

            // First, validate selector exists
            if (!this.config.selectors.venue) {
                throw new Error("Venue selector is not defined in the configuration");
            }

            // Wait for the main container or parent element
            await page.waitForSelector('.match-detail__match-info__list__item', {timeout: 5000});

            // Verify if the selector is visible
            const isElementVisible = await page.evaluate((selector) => {
                const el = document.querySelector(selector);
                if (!el) return false;
                const style = window.getComputedStyle(el);
                return style && style.display !== 'none' && style.visibility !== 'hidden';
            }, this.config.selectors.venue!);

            if (!isElementVisible) {
                logger.warn("Venue element is present but not visible");
                return '';
            }

            // Extract the content of the venue element
            const venueText = await page.$eval(
                this.config.selectors.venue!,
                (el) => el.textContent?.trim() || ''
            );

            if (!venueText) {
                logger.warn("Venue text is empty");
            }

            logger.info(`Extracted venue: ${venueText}`);
            return venueText;
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

                try {
                    await this.navigateToPage(page, comparisonUrl);
                    await page.goto(comparisonUrl, {waitUntil: 'networkidle0'});
                    logger.info("Successfully navigated to the comparison page.");
                    await delay(page, 2000);
                } catch (e) {
                    logger.error(`Error while navigating to the comparison page: ${e instanceof Error ? e.message : e}`);
                    return [];
                }
            } else {
                logger.info("Already on the comparison page.");
                logger.info(`Current URL: ${page.url()}`);
            }

            try {
                const expandSelector = team == 'home'
                    ? `.quick-statistics__table__body__row__open-button` : `.quick-statistics__table:nth-child(2) .quick-statistics__table__body__row__open-button:nth-child(2)`;
                logger.info("Checking for the expand button...");
                logger.info(`Expand button selector: ${expandSelector}`);
                await page.waitForSelector(expandSelector, {timeout: 5000});
                logger.info("Expand button found. Clicking it...");

                await page.click(expandSelector);
                await delay(page, 1000);
                logger.info("Expand button clicked successfully.");
            } catch (e) {
                logger.warn(`Expand button not found or could not be clicked: ${e instanceof Error ? e.message : e}`);
            }

            // Step 3: Extract match details
            logger.info(`Using selector for extracting matches: ${selector}`);
            logger.info(await page.$$eval(selector, rows => rows.map(row => row.textContent?.trim())));
            const matchDetails = await page.$$eval(selector, rows => {
                return rows.map(row => {
                    const date = row.querySelector(".team-against-row__date")?.textContent?.trim().split(" ")[0];
                    const homeTeam = row.querySelector(".team-against-row__home span")?.textContent?.trim();
                    const awayTeam = row.querySelector(".team-against-row__away span")?.textContent?.trim();
                    const score = row.querySelector(".icon-score")?.textContent?.trim();
                    const halfTimeScore = row.querySelector(".team-against-row__score--half-time")
                        ?.textContent?.trim().split(":")[1]?.trim();

                    return `${date}: ${homeTeam} vs ${awayTeam} (FT: ${score} - HT: ${halfTimeScore})`;
                });
            });

            if (matchDetails.length === 0) {
                logger.warn(`No match details found for ${team} team.`);
            } else {
                logger.info(`Successfully extracted ${matchDetails.length} matches for ${team} team.`);
            }

            return matchDetails;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error fetching ${team} team matches: ${errorMessage}`);
            return [];
        }
    }

    protected async getBetweenMatches(page: Page): Promise<string[]> {
        if (!this.config.selectors.h2h?.betweenMatches) return []

        try {
            // Navigate to the comparison page if not already there
            if (!page.url().includes('/karsilastirma')) {
                const currentUrl = page.url()
                const comparisonUrl = currentUrl.replace('/detay', '/karsilastirma')
                await this.navigateToPage(page, comparisonUrl)
                await page.goto(comparisonUrl, {waitUntil: 'networkidle0'})
                await delay(page, 2000)
            }

            // Try to click the H2H tab
            try {
                await page.evaluate(() => {
                    const tabElement = document.querySelector('label[for="tab1_1"]')
                    if (tabElement) (tabElement as HTMLElement).click()
                })
                await delay(page, 1000)
            } catch (e) {
                // Ignore if tab click fails
            }

            return page.$$eval(this.config.selectors.h2h.betweenMatches, rows =>
                rows.map(row => {
                    const date = row.querySelector(".team-against-row__date")?.textContent?.trim().split(" ")[0]
                    const homeTeam = row.querySelector(".team-against-row__home span")?.textContent?.trim()
                    const awayTeam = row.querySelector(".team-against-row__away span")?.textContent?.trim()
                    const score = row.querySelector(".icon-score")?.textContent?.trim()
                    const halfTimeScore = row.querySelector(".team-against-row__half-time")
                        ?.textContent?.trim().split(":")[1]?.trim()
                    return `${date}: ${homeTeam} vs ${awayTeam} (FT: ${score} - HT: ${halfTimeScore})`
                })
            )
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error fetching between matches: ${errorMessage}`);
            return []
        }
    }

    protected async initializeBrowser(): Promise<Browser> {
        return puppeteer.launch(PUPPETEER_CONFIG);
    }
}