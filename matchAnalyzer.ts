import axios from 'axios';
import puppeteer from 'puppeteer';

interface MatchData {
  id: string;
  venue: string;
  unavailablePlayers: {
    home: string[];
    away: string[];
  };
  recentMatches: {
    home: string[];
    away: string[];
    between: string[];
  };
  weather: WeatherData;
}

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

function createDefaultWeatherData(): WeatherData {
  return {
    temperature: 20,
    condition: "Unknown",
    humidity: 50,
    windSpeed: 5
  };
}

export async function analyzeFootballMatch(homeTeam: string, awayTeam: string): Promise<MatchData> {
  const matchInput = `${homeTeam} - ${awayTeam}`;
  const matchId = await searchMatch(matchInput);
  const matchDetails = await getMatchDetails(matchId, homeTeam, awayTeam);
  const h2hData = await getH2HData(matchId, homeTeam, awayTeam);
  const weatherData = matchDetails.venue ? await getWeatherData(matchDetails.venue) : createDefaultWeatherData();
  return {
    id: matchInput,
    unavailablePlayers: matchDetails.unavailablePlayers ?? { home: [], away: [] },
    venue: matchDetails.venue ?? '',
    weather: weatherData,
    recentMatches: h2hData.recentMatches || { home: [], away: [], between: [] },
  };
}

async function searchMatch(matchInput: string): Promise<string> {
  const url = `https://www.bilyoner.com/iddaa`;
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    const matchElement = await page.evaluate(async (input) => {
      const scrollContainer = document.querySelector('.sportsbookList');
      let matchLink = null;
      let lastHeight = 0;
      const scrollStep = 300;

      while (!matchLink) {
        const links = Array.from(document.querySelectorAll('a.event-row-prematch__cells__teams'));
        matchLink = links.find(link => link.textContent?.includes(input))?.getAttribute('href');

        if (matchLink) break;

        if (scrollContainer) {
          scrollContainer.scrollTop += scrollStep;
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const newHeight = parseFloat(scrollContainer?.querySelector('div')?.style.height ?? '0');
        if (newHeight === lastHeight) {
          break;
        }
        lastHeight = newHeight;
      }

      return matchLink;
    }, matchInput);
    
    if (!matchElement) {
      console.log(`No match found for input: ${matchInput}`);
      throw new Error('Match not found');
    }
    
    const matchId = matchElement.match(/\/futbol\/(\d+)/)?.[1];
    
    if (!matchId) {
      throw new Error('Match ID not found');
    }
    
    return matchId;
  } catch (error) {
    console.error(`Error in searchMatch: ${error}`);
    throw error;
  } finally {
    await browser.close();
  }
}

async function getMatchDetails(matchId: string, homeTeam: string, awayTeam: string): Promise<Partial<MatchData>> {
  const unavailablePlayersUrl = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/sakat-cezali`;
  const detailsUrl = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/detay`;
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  const page = await browser.newPage();

  try {
    await page.goto(detailsUrl, { waitUntil: 'networkidle0' });
    const venue = await page.$eval('.match-detail__match-info__list__item:last-child .match-detail__match-info__list__item__text', el => el.textContent?.trim() || '');

    await page.goto(unavailablePlayersUrl, { waitUntil: 'networkidle0' });
    
    const getUnavailablePlayers = async (team: string) => {
      return page.evaluate((teamName) => {
        const allAvailableMessage = 'Tüm oyuncular maç için hazır.';
        const titleElements = Array.from(document.querySelectorAll('.injured-banned__content__title'));
        const teamTitleElement = titleElements.find(el => el.textContent?.includes(teamName));
        
        if (!teamTitleElement) return [];

        const nextElement = teamTitleElement.nextElementSibling;
        
        if (nextElement && nextElement.textContent?.includes(allAvailableMessage)) {
          return [];
        }

        if (nextElement && nextElement.classList.contains('injured-banned__table')) {
          const rows = nextElement.querySelectorAll('.injured-banned__table__body__row');
          return Array.from(rows).map(row => {
            const name = row.querySelector('.injured-banned__table__body__row__columns__column strong')?.textContent?.trim();
            const status = row.querySelector('.injured-banned__table__body__row__columns__column span')?.textContent?.trim();
            return `${name} (${status})`;
          });
        }

        return [];
      }, team);
    };

    const unavailablePlayers = {
      home: await getUnavailablePlayers(homeTeam),
      away: await getUnavailablePlayers(awayTeam),
    };
    return { venue, unavailablePlayers };
  } catch (error) {
    console.error(`Error in getMatchDetails: ${error}`);
    return { venue: '', unavailablePlayers: { home: [], away: [] } };
  } finally {
    await browser.close();
  }
}

async function getH2HData(matchId: string, homeTeam: string, awayTeam: string): Promise<Partial<MatchData>> {
  const url = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/karsilastirma`;
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    const getMatches = async (selector: string, type: string) => {
      return page.$$eval(selector, rows => 
        rows.slice(0, 5).map(row => {
          const date = row.querySelector('.team-against-row__date')?.textContent?.trim().split(' ')[0];
          const homeTeam = row.querySelector('.team-against-row__home span')?.textContent?.trim();
          const awayTeam = row.querySelector('.team-against-row__away span')?.textContent?.trim();
          const score = row.querySelector('.icon-score')?.textContent?.trim();
          const halfTimeScore = row.querySelector('.team-against-row__score--half-time')?.textContent?.trim().split(':')[1].trim();
          return `${date}: ${homeTeam} vs ${awayTeam} (FT: ${score} - HT: ${halfTimeScore})`;
        })
      );
    };

    const getBetweenMatches = async () => {
      return page.$$eval('.quick-statistics__table--last-5-match .quick-statistics__table__body .team-against-row', rows => 
        rows.map(row => {
          const date = row.querySelector('.team-against-row__date')?.textContent?.trim().split(' ')[0];
          const homeTeam = row.querySelector('.team-against-row__home span')?.textContent?.trim();
          const awayTeam = row.querySelector('.team-against-row__away span')?.textContent?.trim();
          const score = row.querySelector('.icon-score')?.textContent?.trim();
          const halfTimeScore = row.querySelector('.team-against-row__half-time')?.textContent?.trim().split(':')[1].trim();
          return `${date}: ${homeTeam} vs ${awayTeam} (FT: ${score} - HT: ${halfTimeScore})`;
        })
      );
    };

    const recentMatches: {
      home: string[];
      away: string[];
      between: string[];
    } = { home: [], away: [], between: [] };

    recentMatches.home = await getMatches('.quick-statistics__table:nth-child(1) .quick-statistics__table__body--short .team-against-row', `${homeTeam}`);
    recentMatches.away = await getMatches('.quick-statistics__table:nth-child(2) .quick-statistics__table__body--short .team-against-row', `${awayTeam}`);
    
    await page.evaluate(() => {
      const tabElement = document.querySelector('label[for="tab1_1"]');
      if (tabElement) {
        (tabElement as HTMLElement).click();
      } else {
        console.error('Tab element not found');
      }
    });

    try {
      const betweenMatches = await getBetweenMatches();
      recentMatches.between = betweenMatches;
    } catch (fetchError) {
      console.error('Error fetching head-to-head matches:', fetchError);
      recentMatches.between = [];
    }

    return { recentMatches };
  } catch (error) {
    console.error(`Error fetching H2H data: ${error}`);
    throw error;
  } finally {
    console.log('Closing browser');
    await browser.close();
  }
}

async function getWeatherData(venue: string): Promise<WeatherData> {
  try {
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(venue)}&format=json&limit=1`;
    const geocodeResponse = await axios.get(geocodeUrl, {
      headers: { 'User-Agent': 'MoxakkMatchAnalyzer/1.0' }
    });

    if (geocodeResponse.data.length === 0) {
      console.error('Unable to geocode venue:', venue);
      return createDefaultWeatherData();
    }

    const location = geocodeResponse.data[0];

    const lat = location.lat;
    const lon = location.lon;

    if (!lat || !lon) {
      console.error('Unable to determine coordinates for venue:', venue);
      return createDefaultWeatherData();
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;
    const weatherResponse = await axios.get(weatherUrl);
    const data = weatherResponse.data;

    return {
      temperature: data.main.temp,
      condition: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return createDefaultWeatherData();
  }
}
