import { BasketballMatchData } from "../../types/matches"
import { MatchRepository } from "../../repositories/MatchRepository"
import { WeatherService } from "../weather/WeatherService"
import { BasketballScrapingService } from "../scrapper/basketballScrapper"

export async function analyzeBasketballMatch(
  homeTeam: string,
  awayTeam: string
): Promise<BasketballMatchData> {
  const matchInput = `${homeTeam}-${awayTeam}`
  const matchRepository = MatchRepository.getInstance()
  const weatherService = WeatherService.getInstance()
  const scraper = BasketballScrapingService.getInstance()

  // Check if the match data already exists in the database
  const existingMatch = await matchRepository.getBasketballMatch(matchInput)
  if (existingMatch) return existingMatch

  // If not found, proceed with scraping
  const matchId = await scraper.searchMatch(matchInput)
  const matchDetails = await scraper.getMatchDetails(matchId)
  const h2hData = await scraper.getH2HData(matchId)
  const weatherData = matchDetails.venue
    ? await weatherService.getWeatherData(matchDetails.venue)
    : weatherService.createDefaultWeatherData()

  const matchData: BasketballMatchData = {
    id: matchInput,
    matchInput,
    homeTeam,
    awayTeam,
    venue: matchDetails.venue ?? "",
    weather: weatherData,
    recentMatches: h2hData.recentMatches || { home: [], away: [], between: [] }
  }

  // Save to PostgreSQL using repository
  await matchRepository.saveBasketballMatch(matchData)

  return matchData
}
