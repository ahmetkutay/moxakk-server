import { BasketballMatchData } from '../../types/matches';
import { MatchRepository } from '../../repositories/MatchRepository';
import { WeatherService } from '../weather/WeatherService';
import { BasketballScrapingService } from '../scrapper/basketballScrapper';
import logger from '../../utils/logger';

export async function analyzeBasketballMatch(
  homeTeam: string,
  awayTeam: string
): Promise<BasketballMatchData> {
  const matchInput = `${homeTeam}-${awayTeam}`;
  const matchRepository = MatchRepository.getInstance();
  const weatherService = WeatherService.getInstance();
  const scraper = BasketballScrapingService.getInstance();

  try {
    // Check if the match data already exists in the database
    const existingMatch = await matchRepository.getBasketballMatch(matchInput);
    if (existingMatch) {
      logger.info(`Using cached data for basketball match: ${matchInput}`);
      return existingMatch;
    }

    // If not found, proceed with scraping
    logger.info(`Scraping data for basketball match: ${matchInput}`);
    const matchId = await scraper.searchMatch(matchInput);
    logger.info(`Match ID retrieved: ${matchId}`);

    // Run multiple scraping operations in parallel
    const [matchDetails, h2hData] = await Promise.all([
      scraper.getMatchDetails(matchId, homeTeam, awayTeam),
      scraper.getH2HData(matchId),
    ]);

    // Weather data depends on venue from matchDetails
    const weatherData = matchDetails.venue
      ? await weatherService.getWeatherData(matchDetails.venue)
      : weatherService.createDefaultWeatherData();

    logger.info('All basketball data collected successfully');

    const matchData: BasketballMatchData = {
      id: matchInput,
      matchInput,
      homeTeam,
      awayTeam,
      venue: matchDetails.venue ?? '',
      weather: weatherData,
      recentMatches: h2hData.recentMatches || { home: [], away: [], between: [] },
    };

    // Save to database
    await matchRepository.saveBasketballMatch(matchData);
    logger.info(`Basketball match data saved for: ${matchInput}`);

    return matchData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error analyzing basketball match ${matchInput}: ${errorMessage}`);
    throw error;
  }
}
