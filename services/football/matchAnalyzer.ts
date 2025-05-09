import { chromium } from 'playwright';
import { redisClient } from '../../config/db';
import { WeatherService } from '../weather/WeatherService';
import logger from '../../utils/logger';
import { ScrapingError } from '../scrapper/baseScrapper';
import { delay } from '../../utils/common';
import { RefereeStats, PlayerData, TeamPlayerData } from '../../types/matches';
import { getSofaScorePlayerService } from './sofaScorePlayerService';

interface MatchData {
  id: string;
  matchInput: string;
  homeTeam: string;
  awayTeam: string;
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
  teamLineups: {
    home: {
      formation: string;
      players: PlayerPosition[];
    };
    away: {
      formation: string;
      players: PlayerPosition[];
    };
  };
  standings: StandingsResult;
}

interface PlayerPosition {
  number: number | undefined;
  name: string | undefined;
  position: string | undefined;
}

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

interface TeamFormation {
  formation: string; // The actual formation like "4-4-2"
  players: PlayerPosition[];
}

interface PlayerPosition {
  name: string | undefined;
  number: number | undefined;
  position: string | undefined;
}

interface TeamLineups {
  home: TeamFormation;
  away: TeamFormation;
}

interface TeamStandingData {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface TeamStanding {
  overall: TeamStandingData;
  homeForm: TeamStandingData;
  awayForm: TeamStandingData;
}

interface StandingsResult {
  home: TeamStanding;
  away: TeamStanding;
}

async function getRefereeStats(matchId: string): Promise<RefereeStats | undefined> {
  const url = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/hakem-istatistikleri`;
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    // Dinamik veri için 5 sn bekle
    await new Promise((resolve) => setTimeout(resolve, 5000));
    // Hakem adı ve ülke
    const refereeInfo = await page.evaluate(() => {
      const name = document.querySelector('.broadage-referee-name')?.textContent?.trim() || '';
      const country =
        document
          .querySelector('.broadage-referee-country')
          ?.textContent?.replace('Ülke:', '')
          .trim() || '';
      return { name, country };
    });
    // Turnuva özetleri (doğru şekilde çek)
    const tournaments = await page.$$eval(
      '.broadage-static-table table.broadage-table.broadage-data-list-table.broadage-home-team tbody tr.broadage-row.broadage-body-row',
      (rows) =>
        rows
          .filter((row) => !row.textContent?.includes('TOPLAM'))
          .map((row) => {
            const cells = row.querySelectorAll('td');
            const name = cells[0]?.querySelector('.broadage-tournament')?.textContent?.trim() || '';
            const matchCount = parseInt(cells[1]?.textContent?.trim() || '0', 10);
            return { name, matchCount };
          })
    );
    // Genel özet (galibiyet, kart, penaltı)
    const summary = await page.evaluate(() => {
      const summaryTable = Array.from(
        document.querySelectorAll(
          '.broadage-scrolled-table table.broadage-table.broadage-data-list-table.broadage-home-team'
        )
      ).find((table) => {
        const ths = table.querySelectorAll('thead th');
        return ths.length >= 6 && ths[0].textContent?.trim() === '1';
      });
      if (!summaryTable)
        return {
          homeWin: 0,
          draw: 0,
          awayWin: 0,
          yellowCards: '',
          redCards: '',
          penalties: '',
        };
      // TOPLAM satırını bul, yoksa son satırı kullan
      let totalRow = Array.from(summaryTable.querySelectorAll('tbody tr')).find((tr) =>
        tr.textContent?.toUpperCase().includes('TOPLAM')
      );
      if (!totalRow) {
        const allRows = Array.from(summaryTable.querySelectorAll('tbody tr'));
        totalRow = allRows[allRows.length - 1];
      }
      const tds = totalRow ? totalRow.querySelectorAll('td') : [];
      const parseCell = (idx: number) => {
        const val = tds[idx]?.textContent?.replace(/[^0-9]/g, '').trim();
        if (!val || isNaN(Number(val))) return 0;
        return parseInt(val, 10);
      };
      return {
        homeWin: parseCell(0),
        draw: parseCell(1),
        awayWin: parseCell(2),
        yellowCards: tds[3]?.textContent?.trim() || '',
        redCards: tds[4]?.textContent?.trim() || '',
        penalties: tds[5]?.textContent?.trim() || '',
      };
    });
    // Hakemin yönettiği maçlar tablosunu daha doğru parse et
    const recentMatches = await page.$$eval(
      '.broadage-fixture-content tbody tr.broadage-football-line',
      (rows) =>
        Array.from(rows).map((row) => {
          const cells = row.querySelectorAll('td');
          const getText = (cellIdx: number): string => {
            const cell = cells[cellIdx];
            if (!cell) return '';
            const div = cell.querySelector('div');
            return div ? div.textContent?.trim() || '' : cell.textContent?.trim() || '';
          };
          return {
            date: getText(0) || '',
            tournament: getText(1) || '',
            homeTeam: getText(2) || '',
            awayTeam: getText(6) || '',
            score: getText(4) || '',
            halfTimeScore: getText(7) || '',
            yellowCards: parseInt(getText(8) || '0', 10),
            redCards: parseInt(getText(9) || '0', 10),
            penalties: parseInt(getText(10) || '0', 10),
          };
        })
    );
    return {
      name: refereeInfo.name,
      country: refereeInfo.country,
      tournaments,
      summary,
      recentMatches,
    };
  } catch (error) {
    logger.error('Error scraping referee stats:', error);
    return undefined;
  } finally {
    await browser.close();
  }
}

export async function analyzeFootballMatch(
  homeTeam: string,
  awayTeam: string
): Promise<MatchData & { refereeStats?: RefereeStats; playerData?: { home: any[]; away: any[] } }> {
  const matchInput = `${homeTeam}-${awayTeam}`;

  // Check if the match data already exists in Redis
  try {
    const key = `football:${matchInput}`;
    const existingMatch = await redisClient.json.get(key);

    if (existingMatch) {
      // Type assertion since we know the structure of the data
      const matchData = existingMatch as any;

      return {
        id: matchData.id,
        matchInput: matchData.match_input,
        homeTeam,
        awayTeam,
        venue: matchData.venue,
        unavailablePlayers: {
          home: matchData.unavailable_players_home || [],
          away: matchData.unavailable_players_away || [],
        },
        recentMatches: {
          home: matchData.recent_matches_home,
          away: matchData.recent_matches_away,
          between: matchData.recent_matches_between,
        },
        weather: {
          temperature: matchData.weather_temperature,
          condition: matchData.weather_condition,
          humidity: matchData.weather_humidity,
          windSpeed: matchData.weather_wind_speed,
        },
        teamLineups: {
          home: {
            formation: matchData.home_formation,
            players: matchData.home_lineups ? JSON.parse(matchData.home_lineups) : [],
          },
          away: {
            formation: matchData.away_formation,
            players: matchData.away_lineups ? JSON.parse(matchData.away_lineups) : [],
          },
        },
        playerData: {
          home: matchData.player_data_home ? JSON.parse(matchData.player_data_home) : [],
          away: matchData.player_data_away ? JSON.parse(matchData.player_data_away) : [],
        },
        standings: {
          home: {
            overall: {
              position: matchData.home_standing_position,
              team: homeTeam,
              played: matchData.home_standing_played,
              won: matchData.home_standing_won,
              drawn: matchData.home_standing_drawn,
              lost: matchData.home_standing_lost,
              goalsFor: matchData.home_standing_goals_for,
              goalsAgainst: matchData.home_standing_goals_against,
              goalDifference: matchData.home_standing_goal_difference,
              points: matchData.home_standing_points,
            },
            homeForm: {
              position: matchData.home_home_position,
              team: homeTeam,
              played: matchData.home_home_played,
              won: matchData.home_home_won,
              drawn: matchData.home_home_drawn,
              lost: matchData.home_home_lost,
              goalsFor: matchData.home_home_goals_for,
              goalsAgainst: matchData.home_home_goals_against,
              goalDifference: matchData.home_home_goal_difference,
              points: matchData.home_home_points,
            },
            awayForm: {
              position: matchData.home_away_position,
              team: homeTeam,
              played: matchData.home_away_played,
              won: matchData.home_away_won,
              drawn: matchData.home_away_drawn,
              lost: matchData.home_away_lost,
              goalsFor: matchData.home_away_goals_for,
              goalsAgainst: matchData.home_away_goals_against,
              goalDifference: matchData.home_away_goal_difference,
              points: matchData.home_away_points,
            },
          },
          away: {
            overall: {
              position: matchData.away_standing_position,
              team: awayTeam,
              played: matchData.away_standing_played,
              won: matchData.away_standing_won,
              drawn: matchData.away_standing_drawn,
              lost: matchData.away_standing_lost,
              goalsFor: matchData.away_standing_goals_for,
              goalsAgainst: matchData.away_standing_goals_against,
              goalDifference: matchData.away_standing_goal_difference,
              points: matchData.away_standing_points,
            },
            homeForm: {
              position: matchData.away_home_position,
              team: awayTeam,
              played: matchData.away_home_played,
              won: matchData.away_home_won,
              drawn: matchData.away_home_drawn,
              lost: matchData.away_home_lost,
              goalsFor: matchData.away_home_goals_for,
              goalsAgainst: matchData.away_home_goals_against,
              goalDifference: matchData.away_home_goal_difference,
              points: matchData.away_home_points,
            },
            awayForm: {
              position: matchData.away_away_position,
              team: awayTeam,
              played: matchData.away_away_played,
              won: matchData.away_away_won,
              drawn: matchData.away_away_drawn,
              lost: matchData.away_away_lost,
              goalsFor: matchData.away_away_goals_for,
              goalsAgainst: matchData.away_away_goals_against,
              goalDifference: matchData.away_away_goal_difference,
              points: matchData.away_away_points,
            },
          },
        },
      };
    }
  } catch (error) {
    logger.error('Error retrieving match data from Redis:', error);
    // Continue with scraping if there's an error retrieving data
  }

  // If not found, proceed with scraping
  // First, we need to search for the match to get the ID
  const matchId = await searchMatch(matchInput);
  logger.info(`Match ID retrieved: ${matchId}`);

  // Referee stats'i paralel olarak çek
  const [matchDetails, h2hData, teamLineups, teamStands, refereeStats] = await Promise.all([
    getMatchDetails(matchId, homeTeam, awayTeam),
    getH2HData(matchId, homeTeam, awayTeam),
    getTeamLineups(matchId),
    getCurrentStandings(matchId, homeTeam, awayTeam),
    getRefereeStats(matchId),
  ]);

  // Weather data depends on venue from matchDetails, but can be fetched in parallel with player data
  const weatherService = WeatherService.getInstance();

  // Fetch weather data and player data in parallel
  const [weatherData, playerData] = await Promise.all([
    matchDetails.venue
      ? weatherService.getWeatherData(matchDetails.venue)
      : weatherService.createDefaultWeatherData(),
    getPlayerData(teamLineups),
  ]);

  logger.info('All data collected successfully');

  const matchData: MatchData & { refereeStats?: RefereeStats; playerData?: TeamPlayerData } = {
    id: matchInput,
    matchInput,
    homeTeam,
    awayTeam,
    unavailablePlayers: matchDetails.unavailablePlayers ?? {
      home: [],
      away: [],
    },
    venue: matchDetails.venue ?? '',
    weather: weatherData,
    recentMatches: h2hData.recentMatches || { home: [], away: [], between: [] },
    teamLineups: {
      home: teamLineups.home as unknown as any,
      away: teamLineups.away as unknown as any,
    },
    standings: {
      home: teamStands.home,
      away: teamStands.away,
    },
    refereeStats,
    playerData,
  };

  // Save to Redis
  try {
    const key = `football:${matchInput}`;
    await redisClient.json.set(key, '$', {
      id: matchData.id,
      match_input: matchData.matchInput,
      venue: matchData.venue,
      unavailable_players_home: matchData.unavailablePlayers.home,
      unavailable_players_away: matchData.unavailablePlayers.away,
      recent_matches_home: matchData.recentMatches.home,
      recent_matches_away: matchData.recentMatches.away,
      recent_matches_between: matchData.recentMatches.between,
      weather_temperature: parseFloat(matchData.weather.temperature.toString()),
      weather_condition: matchData.weather.condition,
      weather_humidity: parseFloat(matchData.weather.humidity.toString()),
      weather_wind_speed: parseFloat(matchData.weather.windSpeed.toString()),
      home_lineups: JSON.stringify(matchData.teamLineups.home.players),
      away_lineups: JSON.stringify(matchData.teamLineups.away.players),
      home_formation: matchData.teamLineups.home.formation,
      away_formation: matchData.teamLineups.away.formation,
      player_data_home: JSON.stringify(matchData.playerData?.home || []),
      player_data_away: JSON.stringify(matchData.playerData?.away || []),

      // Home team - Overall standings
      home_standing_position: teamStands.home.overall.position,
      home_standing_played: teamStands.home.overall.played,
      home_standing_won: teamStands.home.overall.won,
      home_standing_drawn: teamStands.home.overall.drawn,
      home_standing_lost: teamStands.home.overall.lost,
      home_standing_goals_for: teamStands.home.overall.goalsFor,
      home_standing_goals_against: teamStands.home.overall.goalsAgainst,
      home_standing_goal_difference: teamStands.home.overall.goalDifference,
      home_standing_points: teamStands.home.overall.points,

      // Home team - Home form
      home_home_position: teamStands.home.homeForm.position,
      home_home_played: teamStands.home.homeForm.played,
      home_home_won: teamStands.home.homeForm.won,
      home_home_drawn: teamStands.home.homeForm.drawn,
      home_home_lost: teamStands.home.homeForm.lost,
      home_home_goals_for: teamStands.home.homeForm.goalsFor,
      home_home_goals_against: teamStands.home.homeForm.goalsAgainst,
      home_home_goal_difference: teamStands.home.homeForm.goalDifference,
      home_home_points: teamStands.home.homeForm.points,

      // Home team - Away form
      home_away_position: teamStands.home.awayForm.position,
      home_away_played: teamStands.home.awayForm.played,
      home_away_won: teamStands.home.awayForm.won,
      home_away_drawn: teamStands.home.awayForm.drawn,
      home_away_lost: teamStands.home.awayForm.lost,
      home_away_goals_for: teamStands.home.awayForm.goalsFor,
      home_away_goals_against: teamStands.home.awayForm.goalsAgainst,
      home_away_goal_difference: teamStands.home.awayForm.goalDifference,
      home_away_points: teamStands.home.awayForm.points,

      // Away team - Overall standings
      away_standing_position: teamStands.away.overall.position,
      away_standing_played: teamStands.away.overall.played,
      away_standing_won: teamStands.away.overall.won,
      away_standing_drawn: teamStands.away.overall.drawn,
      away_standing_lost: teamStands.away.overall.lost,
      away_standing_goals_for: teamStands.away.overall.goalsFor,
      away_standing_goals_against: teamStands.away.overall.goalsAgainst,
      away_standing_goal_difference: teamStands.away.overall.goalDifference,
      away_standing_points: teamStands.away.overall.points,

      // Away team - Home form
      away_home_position: teamStands.away.homeForm.position,
      away_home_played: teamStands.away.homeForm.played,
      away_home_won: teamStands.away.homeForm.won,
      away_home_drawn: teamStands.away.homeForm.drawn,
      away_home_lost: teamStands.away.homeForm.lost,
      away_home_goals_for: teamStands.away.homeForm.goalsFor,
      away_home_goals_against: teamStands.away.homeForm.goalsAgainst,
      away_home_goal_difference: teamStands.away.homeForm.goalDifference,
      away_home_points: teamStands.away.homeForm.points,

      // Away team - Away form
      away_away_position: teamStands.away.awayForm.position,
      away_away_played: teamStands.away.awayForm.played,
      away_away_won: teamStands.away.awayForm.won,
      away_away_drawn: teamStands.away.awayForm.drawn,
      away_away_lost: teamStands.away.awayForm.lost,
      away_away_goals_for: teamStands.away.awayForm.goalsFor,
      away_away_goals_against: teamStands.away.awayForm.goalsAgainst,
      away_away_goal_difference: teamStands.away.awayForm.goalDifference,
      away_away_points: teamStands.away.awayForm.points,
    });
  } catch (error) {
    logger.error('Error saving match data to Redis:', error);
    // Continue even if there's an error saving data
  }

  return matchData;
}

async function searchMatch(matchInput: string): Promise<string> {
  const url = `https://www.bilyoner.com/iddaa`;
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    // Check if we're redirected to a different page (e.g., Cloudflare challenge)
    if (!page.url().includes('bilyoner.com')) {
      throw new Error('Page redirected, possibly due to anti-bot protection');
    }

    // Wait for the content to load
    await page.waitForSelector('.sportsbookList', { timeout: 10000 });

    const matchElement = await page.evaluate(async (input) => {
      const scrollContainer = document.querySelector('.sportsbookList');
      let matchId = null;
      let lastHeight = 0;
      const scrollStep = 300;
      let scrollAttempts = 0;
      const maxScrollAttempts = 20;

      while (!matchId && scrollAttempts < maxScrollAttempts) {
        const items = Array.from(document.querySelectorAll('.events-container__item'));
        for (const item of items) {
          const linkElement = item.querySelector('.event-row-prematch__cells__teams');
          if (linkElement) {
            const teams = linkElement.textContent?.split('-').map((team) => team.trim());
            if (
              teams &&
              teams.length === 2 &&
              teams[0].includes(input.split('-')[0]) &&
              teams[1].includes(input.split('-')[1])
            ) {
              matchId = item.id;
              break;
            }
          }
        }

        if (matchId) break;

        if (scrollContainer) {
          scrollContainer.scrollTop += scrollStep;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const newHeight = scrollContainer?.scrollHeight || 0;
        if (newHeight === lastHeight) {
          scrollAttempts++;
        } else {
          scrollAttempts = 0;
        }
        lastHeight = newHeight;
      }

      return matchId;
    }, matchInput);

    if (!matchElement) {
      console.log(`No match found for input: ${matchInput}`);
      throw new Error('Match not found');
    }

    console.log('Match found. ID:', matchElement);
    return matchElement;
  } catch (error) {
    console.error(`Error in searchMatch: ${error}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function getMatchDetails(
  matchId: string,
  homeTeam: string,
  awayTeam: string
): Promise<Partial<MatchData>> {
  const unavailablePlayersUrl = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/sakat-cezali`;
  const detailsUrl = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/detay`;

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(detailsUrl, { waitUntil: 'networkidle' });
    const venue = await page.$eval(
      '.match-detail__match-info__list__item:last-child .match-detail__match-info__list__item__text',
      (el) => el.textContent?.trim() ?? ''
    );

    await page.goto(unavailablePlayersUrl, { waitUntil: 'networkidle' });

    const getUnavailablePlayers = async (team: string) => {
      return page.evaluate((teamName) => {
        const allAvailableMessage = 'Tüm oyuncular maç için hazır.';
        const titleElements = Array.from(
          document.querySelectorAll('.injured-banned__content__title')
        );
        const teamTitleElement = titleElements.find((el) => el.textContent?.includes(teamName));

        if (!teamTitleElement) return [];

        const nextElement = teamTitleElement.nextElementSibling;

        if (nextElement?.textContent?.includes(allAvailableMessage)) {
          return [];
        }

        if (nextElement?.classList.contains('injured-banned__table')) {
          const rows = nextElement.querySelectorAll('.injured-banned__table__body__row');
          return Array.from(rows).map((row) => {
            const name = row
              .querySelector('.injured-banned__table__body__row__columns__column strong')
              ?.textContent?.trim();
            const status = row
              .querySelector('.injured-banned__table__body__row__columns__column span')
              ?.textContent?.trim();
            return `${name} (${status})`;
          });
        }

        return [];
      }, team);
    };

    // Fetch unavailable players for home and away teams in parallel
    const [homeUnavailable, awayUnavailable] = await Promise.all([
      getUnavailablePlayers(homeTeam),
      getUnavailablePlayers(awayTeam),
    ]);

    const unavailablePlayers = {
      home: homeUnavailable,
      away: awayUnavailable,
    };
    return { venue, unavailablePlayers };
  } catch (error) {
    console.error(`Error in getMatchDetails: ${error}`);
    return { venue: '', unavailablePlayers: { home: [], away: [] } };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function getH2HData(
  matchId: string,
  homeTeam: string,
  awayTeam: string
): Promise<Partial<MatchData>> {
  const url = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/karsilastirma`;
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    const getMatches = async (selector: string, _type: string) => {
      // Check if the "expand" button exists and click it if present
      const expandButtonSelector = `${selector} .quick-statistics__table__body__row__open-button`;
      const expandButton = await page.$(expandButtonSelector);
      if (expandButton) {
        await expandButton.click();
        await page.waitForLoadState('networkidle');
      }

      return page.$$eval(`${selector} .team-against-row`, (rows) =>
        rows.map((row) => {
          const date = row
            .querySelector('.team-against-row__date')
            ?.textContent?.trim()
            .split(' ')[0];
          const homeTeam = row.querySelector('.team-against-row__home span')?.textContent?.trim();
          const awayTeam = row.querySelector('.team-against-row__away span')?.textContent?.trim();
          const score = row.querySelector('.icon-score')?.textContent?.trim();
          const halfTimeScore = row
            .querySelector('.team-against-row__score--half-time')
            ?.textContent?.trim()
            .split(':')[1]
            .trim();
          return `${date}: ${homeTeam} vs ${awayTeam} (FT: ${score} - HT: ${halfTimeScore})`;
        })
      );
    };

    const getBetweenMatches = async () => {
      return page.$$eval(
        '.quick-statistics__table--last-5-match .quick-statistics__table__body .team-against-row',
        (rows) =>
          rows.map((row) => {
            const date = row
              .querySelector('.team-against-row__date')
              ?.textContent?.trim()
              .split(' ')[0];
            const homeTeam = row.querySelector('.team-against-row__home span')?.textContent?.trim();
            const awayTeam = row.querySelector('.team-against-row__away span')?.textContent?.trim();
            const score = row.querySelector('.icon-score')?.textContent?.trim();
            const halfTimeScore = row
              .querySelector('.team-against-row__half-time')
              ?.textContent?.trim()
              .split(':')[1]
              .trim();
            return `${date}: ${homeTeam} vs ${awayTeam} (FT: ${score} - HT: ${halfTimeScore})`;
          })
      );
    };

    const recentMatches: {
      home: string[];
      away: string[];
      between: string[];
    } = { home: [], away: [], between: [] };

    // Fetch home and away team matches in parallel
    const [homeMatches, awayMatches] = await Promise.all([
      getMatches(
        '.quick-statistics__table:nth-child(1) .quick-statistics__table__body',
        `${homeTeam}`
      ),
      getMatches(
        '.quick-statistics__table:nth-child(2) .quick-statistics__table__body',
        `${awayTeam}`
      ),
    ]);

    recentMatches.home = homeMatches;
    recentMatches.away = awayMatches;

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
    if (browser) {
      await browser.close();
    }
  }
}

async function getTeamLineups(matchId: string): Promise<TeamLineups> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
  });

  logger.info('Browser launched successfully');
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const detailsUrl = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/kadro`;
    logger.info(`Navigating to: ${detailsUrl}`);

    await page.goto(detailsUrl, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Wait for the squad content to load
    await page.waitForSelector('.match-detail__squad', { timeout: 30000 });
    // Extract lineups using Bilyoner's specific HTML structure
    const lineups = await page.evaluate(() => {
      const teams = {
        home: { formation: '', players: [] as any[] },
        away: { formation: '', players: [] as any[] },
      };
      // Function to extract players for a team
      const extractPlayers = () => {
        const players: any[] = [];
        const playerElements = document.querySelectorAll(
          '.match-detail__squad__formation__list__item'
        );

        playerElements.forEach((element) => {
          const numberElement = element.querySelector(
            '.match-detail__squad__formation__list__item__shirt__number'
          );
          const nameElement = element.querySelector(
            '.match-detail__squad__formation__list__item__player'
          );
          const positionElement = element.querySelector(
            '.match-detail__squad__formation__list__item__position'
          );

          if (nameElement && nameElement.textContent !== 'Teknik Direktör') {
            const player = {
              number:
                numberElement && numberElement.textContent
                  ? parseInt(numberElement.textContent.trim(), 10)
                  : undefined,
              name:
                nameElement && nameElement.textContent ? nameElement.textContent.trim() : undefined,
              position:
                positionElement && positionElement.textContent
                  ? positionElement.textContent.trim()
                  : undefined,
            };
            players.push(player);
          }
        });

        return players;
      };
      // Get home team data
      const homeTeamTab = document.querySelector('input[id="match-detail-squad-tab_0"]');
      if (homeTeamTab) {
        (homeTeamTab as HTMLInputElement).click();
        teams.home.players = extractPlayers();
        teams.home.formation =
          (document.querySelector('.line-up__formation') as HTMLElement)?.textContent?.trim() ||
          'Unknown';
      }
      // Get away team data
      const awayTeamTab = document.querySelector('input[id="match-detail-squad-tab_1"]');
      if (awayTeamTab) {
        (awayTeamTab as HTMLInputElement).click();
        teams.away.players = extractPlayers();
        teams.away.formation =
          (document.querySelector('.line-up__formation') as HTMLElement)?.textContent?.trim() ||
          'Unknown';
      }

      return teams;
    });
    logger.info('Lineups extracted successfully');

    if (!lineups?.home?.players?.length && !lineups?.away?.players?.length) {
      throw new ScrapingError('No lineup data found', 'NO_LINEUP_DATA');
    }
    logger.info(`Home Team Formation: ${lineups.home.formation}`);
    logger.info(`Away Team Formation: ${lineups.away.formation}`);
    return {
      home: {
        formation: lineups.home.formation || 'Unknown',
        players: lineups.home.players.map((player) => ({
          name: player.name,
          number: player.number,
          position: player.position,
        })),
      },
      away: {
        formation: lineups.away.formation || 'Unknown',
        players: lineups.away.players.map((player) => ({
          name: player.name,
          number: player.number,
          position: player.position,
        })),
      },
    };
  } catch (error: any) {
    logger.error('Error fetching team lineups:', {
      error: error.message,
      stack: error.stack,
    });
    throw new ScrapingError('Failed to fetch team lineups', 'LINEUP_FETCH_FAILED', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function getPlayerData(teamLineups: TeamLineups): Promise<TeamPlayerData> {
  const playerService = getSofaScorePlayerService();

  logger.info(
    'Fetching detailed player data from SofaScore in batches to avoid anti-bot detection'
  );

  // Create fetch functions for home team players
  const homePlayerPromises = teamLineups.home.players
    .filter((player) => player.name) // Filter out players without names
    .map((player) => {
      return async () => {
        try {
          // Use getPlayerDetails to get extended player information
          const playerResult = await playerService.getPlayerDetails(player.name!);
          if (playerResult) {
            logger.info(`Found detailed player data for ${player.name}: ${playerResult.url}`);

            // Log additional data if available
            if (playerResult.strengths && playerResult.strengths.length > 0) {
              logger.info(`Player ${player.name} strengths: ${playerResult.strengths.join(', ')}`);
            }
            if (playerResult.averageRating) {
              logger.info(`Player ${player.name} average rating: ${playerResult.averageRating}`);
            }
            return playerResult;
          }
          return null;
        } catch (error) {
          logger.error(`Error fetching player data for ${player.name}: ${error}`);
          return null;
        }
      };
    });

  // Create fetch functions for away team players
  const awayPlayerPromises = teamLineups.away.players
    .filter((player) => player.name) // Filter out players without names
    .map((player) => {
      return async () => {
        try {
          // Use getPlayerDetails to get extended player information
          const playerResult = await playerService.getPlayerDetails(player.name!);
          if (playerResult) {
            logger.info(`Found detailed player data for ${player.name}: ${playerResult.url}`);

            // Log additional data if available
            if (playerResult.strengths && playerResult.strengths.length > 0) {
              logger.info(`Player ${player.name} strengths: ${playerResult.strengths.join(', ')}`);
            }
            if (playerResult.averageRating) {
              logger.info(`Player ${player.name} average rating: ${playerResult.averageRating}`);
            }
            return playerResult;
          }
          return null;
        } catch (error) {
          logger.error(`Error fetching player data for ${player.name}: ${error}`);
          return null;
        }
      };
    });

  // Process player data in batches to avoid triggering anti-bot measures
  const homePlayerResults = await processBatches(homePlayerPromises);
  const awayPlayerResults = await processBatches(awayPlayerPromises);

  // Filter out null results
  const homePlayerData = homePlayerResults.filter((result) => result !== null) as PlayerData[];
  const awayPlayerData = awayPlayerResults.filter((result) => result !== null) as PlayerData[];

  logger.info(
    `Successfully fetched data for ${homePlayerData.length} home players and ${awayPlayerData.length} away players`
  );

  return {
    home: homePlayerData,
    away: awayPlayerData,
  };
}

/**
 * Process an array of promise-returning functions in batches with delays between batches
 * to avoid triggering anti-bot measures.
 * Uses a 3-3-3-2 pattern for batch sizes.
 * @param promiseFunctions Array of functions that return promises
 * @returns Array of resolved promise results
 */
async function processBatches<T>(promiseFunctions: Array<() => Promise<T>>): Promise<T[]> {
  const results: T[] = [];

  // If no functions to process, return empty array
  if (promiseFunctions.length === 0) {
    return results;
  }

  // Define batch sizes in 3-3-3-2 pattern
  const batchSizes = [3, 3, 3, 2];
  let currentIndex = 0;

  // Process each batch
  while (currentIndex < promiseFunctions.length) {
    // Determine batch size for current batch
    const batchSizeIndex = Math.floor(currentIndex / 11) % batchSizes.length;
    const batchSize = Math.min(batchSizes[batchSizeIndex], promiseFunctions.length - currentIndex);

    logger.info(
      `Processing batch of ${batchSize} players (${currentIndex + 1}-${currentIndex + batchSize} of ${promiseFunctions.length})`
    );

    // Get the current batch of functions
    const currentBatch = promiseFunctions.slice(currentIndex, currentIndex + batchSize);

    // Process the current batch in parallel
    const batchResults = await Promise.all(currentBatch.map((fn) => fn()));

    // Add results to the results array
    results.push(...batchResults);

    // Move to the next batch
    currentIndex += batchSize;

    // Add delay between batches if there are more batches to process
    if (currentIndex < promiseFunctions.length) {
      const delayTime = Math.floor(Math.random() * 1000) + 1500; // Random delay between 1.5-2.5 seconds
      logger.info(`Waiting ${delayTime}ms before processing next batch...`);
      await delay(delayTime);
    }
  }

  return results;
}

async function getCurrentStandings(
  matchId: string,
  homeTeam: string,
  awayTeam: string
): Promise<StandingsResult> {
  const url = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/puan-durumu`;
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    logger.info(`Navigating to standings page for match ${matchId}`);
    logger.info(`Looking for teams - Home: ${homeTeam}, Away: ${awayTeam}`);

    const getStandingsForTab = async (tabId: string) => {
      // Click the tab
      await page.evaluate((id) => {
        const tab = document.querySelector(
          `input[id="match-card-standing-tab_${id}"]`
        ) as HTMLInputElement;
        if (tab) tab.click();
      }, tabId);

      // Wait for content to load
      await delay(1000);

      // Get all team data with their names
      const teamsData = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.team-info-row__row--bold'))
          .map((row) => {
            const columns = Array.from(row.querySelectorAll('.team-info-row__row__column'));
            const teamInfo = columns[0];
            const teamName = teamInfo.querySelector('span')?.textContent?.trim() || '';

            if (columns.length < 9) return null;

            return {
              name: teamName,
              standing: {
                position: parseInt(teamInfo.querySelector('.icon-order')?.textContent || '0'),
                team: teamName,
                played: parseInt(columns[1]?.textContent?.trim() || '0'),
                won: parseInt(columns[2]?.textContent?.trim() || '0'),
                drawn: parseInt(columns[3]?.textContent?.trim() || '0'),
                lost: parseInt(columns[4]?.textContent?.trim() || '0'),
                goalsFor: parseInt(columns[5]?.textContent?.trim() || '0'),
                goalsAgainst: parseInt(columns[6]?.textContent?.trim() || '0'),
                goalDifference: parseInt(columns[7]?.textContent?.trim() || '0'),
                points: parseInt(columns[8]?.textContent?.trim() || '0'),
              },
            };
          })
          .filter(Boolean);
      });

      logger.info(`Found ${teamsData.length} teams in tab ${tabId}`);
      logger.info(
        'Team names:',
        teamsData.map((t) => t?.name || 'Unknown')
      );

      // Get similarity scores for each team
      const getTeamScores = (
        targetTeam: string,
        rawTeams: Array<{ name: string; standing: any } | null>
      ) => {
        // Null değerleri filtreleyerek temiz bir dizi oluştur
        const teams = rawTeams.filter(
          (team): team is { name: string; standing: any } => team !== null
        );

        const normalize = (str: string) =>
          str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');

        const getLongestCommonSubsequence = (s1: string, s2: string) => {
          const m = s1.length;
          const n = s2.length;
          const dp = Array(m + 1)
            .fill(0)
            .map(() => Array(n + 1).fill(0));

          for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
              if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
              } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
              }
            }
          }

          return dp[m][n];
        };

        const normalizedTarget = normalize(targetTeam);
        return teams.map((team) => {
          const normalizedTeam = normalize(team.name);

          // Calculate different similarity metrics
          const lcs = getLongestCommonSubsequence(normalizedTarget, normalizedTeam);
          const directIncludes =
            normalizedTeam.includes(normalizedTarget) || normalizedTarget.includes(normalizedTeam);

          // Combined score
          const score =
            lcs / Math.max(normalizedTarget.length, normalizedTeam.length) +
            (directIncludes ? 0.5 : 0);

          return {
            team: team.name,
            standing: team.standing,
            score,
          };
        });
      };

      // Find best matches for both teams
      const homeScores = getTeamScores(homeTeam, teamsData);
      const awayScores = getTeamScores(awayTeam, teamsData);

      // Sort by score and get best matches
      const bestHomeMatch = homeScores.sort((a, b) => b.score - a.score)[0];
      const bestAwayMatch = awayScores.sort((a, b) => b.score - a.score)[0];

      if (!bestHomeMatch && !bestAwayMatch) {
        return {};
      }

      return {
        home: bestHomeMatch.standing,
        away: bestAwayMatch.standing,
      };
    };

    // Get data for all three views
    const overallStandings = await getStandingsForTab('0'); // Genel
    const homeFormStandings = await getStandingsForTab('1'); // İç Saha
    const awayFormStandings = await getStandingsForTab('2'); // Dış Saha

    return {
      home: {
        overall: overallStandings.home,
        homeForm: homeFormStandings.home,
        awayForm: awayFormStandings.home,
      },
      away: {
        overall: overallStandings.away,
        homeForm: homeFormStandings.away,
        awayForm: awayFormStandings.away,
      },
    };
  } catch (error) {
    logger.error('Error in getCurrentStandings:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
