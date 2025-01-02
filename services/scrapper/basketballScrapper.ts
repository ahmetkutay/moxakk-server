import { BaseScraper, ScrapingConfig, MatchDetails } from "./baseScrapper"
import { Page } from "puppeteer"

const BASKETBALL_CONFIG: ScrapingConfig = {
    baseUrl: "https://www.bilyoner.com/iddaa/basketbol",
    selectors: {
        listContainer: ".sportsbookList",
        matchItem: ".events-container__item",
        teamNames: ".event-row-prematch__cells__teams",
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
    console.warn(`Delay warning: ${error}`)
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
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      })

      const detailsUrl = `${this.config.baseUrl}/mac-karti/${matchId}/detay`
      
      let retryCount = 0
      while (retryCount < this.config.retries.maxAttempts) {
        try {
          await page.goto(detailsUrl, { 
            waitUntil: ["load", "domcontentloaded"],
            timeout: this.config.timeouts.navigation 
          })
          
          // Wait for any one of these selectors to appear
          await Promise.race([
            page.waitForSelector(this.config.selectors.teamNames, {
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
          this.config.selectors.teamNames,
          (el) => {
            const text = el.textContent || ''
            const [homeTeam, awayTeam] = text.split('-').map(t => t.trim())
            return { homeTeam, awayTeam }
          }
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Content extraction timeout')), 10000)
        )
      ]) as { homeTeam: string, awayTeam: string }

      return {
        venue: await this.getVenue(page),
        homeTeam: teams.homeTeam,
        awayTeam: teams.awayTeam,
        matchId
      }
    } catch (error) {
      console.error(`Error in getMatchDetails for matchId ${matchId}:`, error)
      return { venue: '', homeTeam: '', awayTeam: '', matchId }
    } finally {
      await this.closeBrowser()
    }
  }

  private async getVenue(page: Page): Promise<string> {
    try {
      return await page.$eval(
        this.config.selectors.venue!,
        el => el.textContent?.trim() || ''
      )
    } catch {
      return ''
    }
  }

  protected async getTeamMatches(page: Page, team: 'home' | 'away'): Promise<string[]> {
    const selector = this.config.selectors.h2h?.[team === 'home' ? 'homeMatches' : 'awayMatches']
    if (!selector) return []

    try {
      // Navigate to the comparison page if not already there
      if (!page.url().includes('/karsilastirma')) {
        const currentUrl = page.url()
        const comparisonUrl = currentUrl.replace('/detay', '/karsilastirma')
        await page.goto(comparisonUrl, { waitUntil: 'networkidle0' })
        await delay(page, 2000)
      }

      // Try to find and click the expand button
      try {
        const expandSelector = `.quick-statistics__table__body__row__open-button`
        await page.waitForSelector(expandSelector, { timeout: 5000 })
        await page.click(expandSelector)
        await delay(page, 1000)
      } catch (e) {
        // Ignore if expand button is not found
      }

      return page.$$eval(selector, rows => 
        rows.map(row => {
          const date = row.querySelector(".team-against-row__date")?.textContent?.trim().split(" ")[0]
          const homeTeam = row.querySelector(".team-against-row__home span")?.textContent?.trim()
          const awayTeam = row.querySelector(".team-against-row__away span")?.textContent?.trim()
          const score = row.querySelector(".icon-score")?.textContent?.trim()
          const halfTimeScore = row.querySelector(".team-against-row__score--half-time")
            ?.textContent?.trim().split(":")[1]?.trim()
          return `${date}: ${homeTeam} vs ${awayTeam} (FT: ${score} - HT: ${halfTimeScore})`
        })
      )
    } catch (error) {
      console.error(`Error fetching ${team} team matches:`, error)
      return []
    }
  }

  protected async getBetweenMatches(page: Page): Promise<string[]> {
    if (!this.config.selectors.h2h?.betweenMatches) return []

    try {
      // Navigate to the comparison page if not already there
      if (!page.url().includes('/karsilastirma')) {
        const currentUrl = page.url()
        const comparisonUrl = currentUrl.replace('/detay', '/karsilastirma')
        await page.goto(comparisonUrl, { waitUntil: 'networkidle0' })
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
      console.error('Error fetching between matches:', error)
      return []
    }
  }
}