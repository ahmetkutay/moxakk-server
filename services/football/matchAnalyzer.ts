import puppeteer from "puppeteer";
import {pool} from "../../config/db";
import {WeatherService} from "../weather/WeatherService";
import logger from "../../utils/logger";
import {ScrapingError} from "../scrapper/baseScrapper";

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
    }
    standings: StandingsResult
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
    formation: string;  // The actual formation like "4-4-2"
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

export async function analyzeFootballMatch(
    homeTeam: string,
    awayTeam: string
): Promise<MatchData> {
    const matchInput = `${homeTeam}-${awayTeam}`;

    // Check if the match data already exists in the database
    const existingMatch = await pool.query(
        'SELECT * FROM match_data WHERE id = $1',
        [matchInput]
    );

    const weatherService = WeatherService.getInstance()

    if (existingMatch.rows.length > 0) {
        return {
            id: existingMatch.rows[0].id,
            matchInput: existingMatch.rows[0].match_input,
            homeTeam,
            awayTeam,
            venue: existingMatch.rows[0].venue,
            unavailablePlayers: {
                home: existingMatch.rows[0].unavailable_players_home,
                away: existingMatch.rows[0].unavailable_players_away
            },
            recentMatches: {
                home: existingMatch.rows[0].recent_matches_home,
                away: existingMatch.rows[0].recent_matches_away,
                between: existingMatch.rows[0].recent_matches_between
            },
            weather: {
                temperature: existingMatch.rows[0].weather_temperature,
                condition: existingMatch.rows[0].weather_condition,
                humidity: existingMatch.rows[0].weather_humidity,
                windSpeed: existingMatch.rows[0].weather_wind_speed
            },
            teamLineups: {
                home: {
                    formation: existingMatch.rows[0].homeFormation,
                    players: existingMatch.rows[0].homeLineUps
                },
                away: {
                    formation: existingMatch.rows[0].awayFormation,
                    players: existingMatch.rows[0].awayLineUps
                }
            },
            standings: {
                home: {
                    overall: {
                        position: existingMatch.rows[0].home_standing_position,
                        team: homeTeam,
                        played: existingMatch.rows[0].home_standing_played,
                        won: existingMatch.rows[0].home_standing_won,
                        drawn: existingMatch.rows[0].home_standing_drawn,
                        lost: existingMatch.rows[0].home_standing_lost,
                        goalsFor: existingMatch.rows[0].home_standing_goals_for,
                        goalsAgainst: existingMatch.rows[0].home_standing_goals_against,
                        goalDifference: existingMatch.rows[0].home_standing_goal_difference,
                        points: existingMatch.rows[0].home_standing_points
                    },
                    homeForm: {
                        position: existingMatch.rows[0].home_home_position,
                        team: homeTeam,
                        played: existingMatch.rows[0].home_home_played,
                        won: existingMatch.rows[0].home_home_won,
                        drawn: existingMatch.rows[0].home_home_drawn,
                        lost: existingMatch.rows[0].home_home_lost,
                        goalsFor: existingMatch.rows[0].home_home_goals_for,
                        goalsAgainst: existingMatch.rows[0].home_home_goals_against,
                        goalDifference: existingMatch.rows[0].home_home_goal_difference,
                        points: existingMatch.rows[0].home_home_points
                    },
                    awayForm: {
                        position: existingMatch.rows[0].home_away_position,
                        team: homeTeam,
                        played: existingMatch.rows[0].home_away_played,
                        won: existingMatch.rows[0].home_away_won,
                        drawn: existingMatch.rows[0].home_away_drawn,
                        lost: existingMatch.rows[0].home_away_lost,
                        goalsFor: existingMatch.rows[0].home_away_goals_for,
                        goalsAgainst: existingMatch.rows[0].home_away_goals_against,
                        goalDifference: existingMatch.rows[0].home_away_goal_difference,
                        points: existingMatch.rows[0].home_away_points
                    }
                },
                away: {
                    overall: {
                        position: existingMatch.rows[0].away_standing_position,
                        team: awayTeam,
                        played: existingMatch.rows[0].away_standing_played,
                        won: existingMatch.rows[0].away_standing_won,
                        drawn: existingMatch.rows[0].away_standing_drawn,
                        lost: existingMatch.rows[0].away_standing_lost,
                        goalsFor: existingMatch.rows[0].away_standing_goals_for,
                        goalsAgainst: existingMatch.rows[0].away_standing_goals_against,
                        goalDifference: existingMatch.rows[0].away_standing_goal_difference,
                        points: existingMatch.rows[0].away_standing_points
                    },
                    homeForm: {
                        position: existingMatch.rows[0].away_home_position,
                        team: awayTeam,
                        played: existingMatch.rows[0].away_home_played,
                        won: existingMatch.rows[0].away_home_won,
                        drawn: existingMatch.rows[0].away_home_drawn,
                        lost: existingMatch.rows[0].away_home_lost,
                        goalsFor: existingMatch.rows[0].away_home_goals_for,
                        goalsAgainst: existingMatch.rows[0].away_home_goals_against,
                        goalDifference: existingMatch.rows[0].away_home_goal_difference,
                        points: existingMatch.rows[0].away_home_points
                    },
                    awayForm: {
                        position: existingMatch.rows[0].away_away_position,
                        team: awayTeam,
                        played: existingMatch.rows[0].away_away_played,
                        won: existingMatch.rows[0].away_away_won,
                        drawn: existingMatch.rows[0].away_away_drawn,
                        lost: existingMatch.rows[0].away_away_lost,
                        goalsFor: existingMatch.rows[0].away_away_goals_for,
                        goalsAgainst: existingMatch.rows[0].away_away_goals_against,
                        goalDifference: existingMatch.rows[0].away_away_goal_difference,
                        points: existingMatch.rows[0].away_away_points
                    }
                }
            }
        };
    }

    // If not found, proceed with scraping
    //import basescrapper below
    const matchId = await searchMatch(matchInput);
    const matchDetails = await getMatchDetails(matchId, homeTeam, awayTeam);
    const h2hData = await getH2HData(matchId, homeTeam, awayTeam);
    const weatherData = matchDetails.venue
        ? await weatherService.getWeatherData(matchDetails.venue)
        : weatherService.createDefaultWeatherData();
    const teamLineups = await getTeamLineups(matchId);
    const teamStands = await getCurrentStandings(matchId, homeTeam, awayTeam) || null;

    const matchData: MatchData = {
        id: matchInput,
        matchInput: matchInput,
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        unavailablePlayers: matchDetails.unavailablePlayers ?? {
            home: [],
            away: [],
        },
        venue: matchDetails.venue ?? "",
        weather: weatherData,
        recentMatches: h2hData.recentMatches || {home: [], away: [], between: []},
        teamLineups: {
            home: teamLineups.home as unknown as any,
            away: teamLineups.away as unknown as any
        },
        standings: {
            home: teamStands.home,
            away: teamStands.away
        }
    };
    // Save to PostgreSQL

    // Update this part of the SQL query in analyzeFootballMatch:
    await pool.query(
        `INSERT INTO match_data (
            id, match_input, venue,
            unavailable_players_home, unavailable_players_away,
            recent_matches_home, recent_matches_away, recent_matches_between,
            weather_temperature, weather_condition, weather_humidity, weather_wind_speed,
            home_lineups, away_lineups, home_formation, away_formation,

            -- Home team - Overall standings
            home_standing_position, home_standing_played, home_standing_won,
            home_standing_drawn, home_standing_lost, home_standing_goals_for,
            home_standing_goals_against, home_standing_goal_difference, home_standing_points,

            -- Home team - Home form
            home_home_position, home_home_played, home_home_won,
            home_home_drawn, home_home_lost, home_home_goals_for,
            home_home_goals_against, home_home_goal_difference, home_home_points,

            -- Home team - Away form
            home_away_position, home_away_played, home_away_won,
            home_away_drawn, home_away_lost, home_away_goals_for,
            home_away_goals_against, home_away_goal_difference, home_away_points,

            -- Away team - Overall standings
            away_standing_position, away_standing_played, away_standing_won,
            away_standing_drawn, away_standing_lost, away_standing_goals_for,
            away_standing_goals_against, away_standing_goal_difference, away_standing_points,

            -- Away team - Home form
            away_home_position, away_home_played, away_home_won,
            away_home_drawn, away_home_lost, away_home_goals_for,
            away_home_goals_against, away_home_goal_difference, away_home_points,

            -- Away team - Away form
            away_away_position, away_away_played, away_away_won,
            away_away_drawn, away_away_lost, away_away_goals_for,
            away_away_goals_against, away_away_goal_difference, away_away_points
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                 $17, $18, $19, $20, $21, $22, $23, $24, $25,
                 $26, $27, $28, $29, $30, $31, $32, $33, $34,
                 $35, $36, $37, $38, $39, $40, $41, $42, $43,
                 $44, $45, $46, $47, $48, $49, $50, $51, $52,
                 $53, $54, $55, $56, $57, $58, $59, $60, $61,
                 $62, $63, $64, $65, $66, $67, $68, $69, $70)`,
        [
            matchData.id,
            matchData.matchInput,
            matchData.venue,
            matchData.unavailablePlayers.home,
            matchData.unavailablePlayers.away,
            matchData.recentMatches.home,
            matchData.recentMatches.away,
            matchData.recentMatches.between,
            parseFloat(matchData.weather.temperature.toString()),
            matchData.weather.condition,
            parseFloat(matchData.weather.humidity.toString()),
            parseFloat(matchData.weather.windSpeed.toString()),
            JSON.stringify(matchData.teamLineups.home.players),
            JSON.stringify(matchData.teamLineups.away.players),
            matchData.teamLineups.home.formation,
            matchData.teamLineups.away.formation,

            // Home team - Overall standings
            teamStands.home.overall.position ?? "",
            teamStands.home.overall.played ?? "",
            teamStands.home.overall.won ?? "",
            teamStands.home.overall.drawn ?? "",
            teamStands.home.overall.lost ?? "",
            teamStands.home.overall.goalsFor ?? "",
            teamStands.home.overall.goalsAgainst ?? "",
            teamStands.home.overall.goalDifference ?? "",
            teamStands.home.overall.points ?? "",

            // Home team - Home form
            teamStands.home.homeForm.position ?? "",
            teamStands.home.homeForm.played ?? "",
            teamStands.home.homeForm.won ?? "",
            teamStands.home.homeForm.drawn ?? "",
            teamStands.home.homeForm.lost ?? "",
            teamStands.home.homeForm.goalsFor ?? "",
            teamStands.home.homeForm.goalsAgainst ?? "",
            teamStands.home.homeForm.goalDifference ?? "",
            teamStands.home.homeForm.points ?? "",

            // Home team - Away form
            teamStands.home.awayForm.position ?? "",
            teamStands.home.awayForm.played ?? "",
            teamStands.home.awayForm.won ?? "",
            teamStands.home.awayForm.drawn ?? "",
            teamStands.home.awayForm.lost ?? "",
            teamStands.home.awayForm.goalsFor ?? "",
            teamStands.home.awayForm.goalsAgainst ?? "",
            teamStands.home.awayForm.goalDifference ?? "",
            teamStands.home.awayForm.points ?? "",

            // Away team - Overall standings
            teamStands.away.overall.position ?? "",
            teamStands.away.overall.played ?? "",
            teamStands.away.overall.won ?? "",
            teamStands.away.overall.drawn ?? "",
            teamStands.away.overall.lost ?? "",
            teamStands.away.overall.goalsFor ?? "",
            teamStands.away.overall.goalsAgainst ?? "",
            teamStands.away.overall.goalDifference ?? "",
            teamStands.away.overall.points ?? "",

            // Away team - Home form
            teamStands.away.homeForm.position ?? "",
            teamStands.away.homeForm.played ?? "",
            teamStands.away.homeForm.won ?? "",
            teamStands.away.homeForm.drawn ?? "",
            teamStands.away.homeForm.lost ?? "",
            teamStands.away.homeForm.goalsFor ?? "",
            teamStands.away.homeForm.goalsAgainst ?? "",
            teamStands.away.homeForm.goalDifference ?? "",
            teamStands.away.homeForm.points ?? "",

            // Away team - Away form
            teamStands.away.awayForm.position ?? "",
            teamStands.away.awayForm.played ?? "",
            teamStands.away.awayForm.won ?? "",
            teamStands.away.awayForm.drawn ?? "",
            teamStands.away.awayForm.lost ?? "",
            teamStands.away.awayForm.goalsFor ?? "",
            teamStands.away.awayForm.goalsAgainst ?? "",
            teamStands.away.awayForm.goalDifference ?? "",
            teamStands.away.awayForm.points ?? ""
        ]
    );

    return matchData;
}

async function searchMatch(matchInput: string): Promise<string> {
    const url = `https://www.bilyoner.com/iddaa`;
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();

    try {
        await page.goto(url, {waitUntil: "networkidle0", timeout: 60000});

        // Check if we're redirected to a different page (e.g., Cloudflare challenge)
        if (!page.url().includes("bilyoner.com")) {
            throw new Error("Page redirected, possibly due to anti-bot protection");
        }

        // Wait for the content to load
        await page.waitForSelector(".sportsbookList", {timeout: 10000});

        const matchElement = await page.evaluate(async (input) => {
            const scrollContainer = document.querySelector(".sportsbookList");
            let matchId = null;
            let lastHeight = 0;
            const scrollStep = 300;
            let scrollAttempts = 0;
            const maxScrollAttempts = 20;

            while (!matchId && scrollAttempts < maxScrollAttempts) {
                const items = Array.from(
                    document.querySelectorAll(".events-container__item")
                );
                for (const item of items) {
                    const linkElement = item.querySelector(
                        ".event-row-prematch__cells__teams"
                    );
                    if (linkElement) {
                        const teams = linkElement.textContent
                            ?.split("-")
                            .map((team) => team.trim());
                        if (
                            teams &&
                            teams.length === 2 &&
                            teams[0].includes(input.split("-")[0]) &&
                            teams[1].includes(input.split("-")[1])
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
            throw new Error("Match not found");
        }

        console.log("Match found. ID:", matchElement);
        return matchElement;
    } catch (error) {
        console.error(`Error in searchMatch: ${error}`);
        throw error;
    } finally {
        await browser.close();
    }
}

async function getMatchDetails(
    matchId: string,
    homeTeam: string,
    awayTeam: string
): Promise<Partial<MatchData>> {
    const unavailablePlayersUrl = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/sakat-cezali`;
    const detailsUrl = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/detay`;

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();

    try {
        await page.goto(detailsUrl, {waitUntil: "networkidle0"});
        const venue = await page.$eval(
            ".match-detail__match-info__list__item:last-child .match-detail__match-info__list__item__text",
            (el) => el.textContent?.trim() ?? ""
        );

        await page.goto(unavailablePlayersUrl, {waitUntil: "networkidle0"});

        const getUnavailablePlayers = async (team: string) => {
            return page.evaluate((teamName) => {
                const allAvailableMessage = "Tüm oyuncular maç için hazır.";
                const titleElements = Array.from(
                    document.querySelectorAll(".injured-banned__content__title")
                );
                const teamTitleElement = titleElements.find((el) =>
                    el.textContent?.includes(teamName)
                );

                if (!teamTitleElement) return [];

                const nextElement = teamTitleElement.nextElementSibling;

                if (nextElement?.textContent?.includes(allAvailableMessage)) {
                    return [];
                }

                if (nextElement?.classList.contains("injured-banned__table")) {
                    const rows = nextElement.querySelectorAll(
                        ".injured-banned__table__body__row"
                    );
                    return Array.from(rows).map((row) => {
                        const name = row
                            .querySelector(
                                ".injured-banned__table__body__row__columns__column strong"
                            )
                            ?.textContent?.trim();
                        const status = row
                            .querySelector(
                                ".injured-banned__table__body__row__columns__column span"
                            )
                            ?.textContent?.trim();
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
        return {venue, unavailablePlayers};
    } catch (error) {
        console.error(`Error in getMatchDetails: ${error}`);
        return {venue: "", unavailablePlayers: {home: [], away: []}};
    } finally {
        await browser.close();
    }
}

async function getH2HData(
    matchId: string,
    homeTeam: string,
    awayTeam: string
): Promise<Partial<MatchData>> {
    const url = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/karsilastirma`;
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();

    try {
        await page.goto(url, {waitUntil: "networkidle0"});

        const getMatches = async (selector: string, type: string) => {
            // Check if the "expand" button exists and click it if present
            const expandButtonSelector = `${selector} .quick-statistics__table__body__row__open-button`;
            const expandButton = await page.$(expandButtonSelector);
            if (expandButton) {
                await expandButton.click();
                await page.waitForNetworkIdle(); // Replace waitForTimeout with waitForNetworkIdle
            }

            return page.$$eval(`${selector} .team-against-row`, (rows) =>
                rows.map((row) => {
                    const date = row
                        .querySelector(".team-against-row__date")
                        ?.textContent?.trim()
                        .split(" ")[0];
                    const homeTeam = row
                        .querySelector(".team-against-row__home span")
                        ?.textContent?.trim();
                    const awayTeam = row
                        .querySelector(".team-against-row__away span")
                        ?.textContent?.trim();
                    const score = row.querySelector(".icon-score")?.textContent?.trim();
                    const halfTimeScore = row
                        .querySelector(".team-against-row__score--half-time")
                        ?.textContent?.trim()
                        .split(":")[1]
                        .trim();
                    return `${date}: ${homeTeam} vs ${awayTeam} (FT: ${score} - HT: ${halfTimeScore})`;
                })
            );
        };

        const getBetweenMatches = async () => {
            return page.$$eval(
                ".quick-statistics__table--last-5-match .quick-statistics__table__body .team-against-row",
                (rows) =>
                    rows.map((row) => {
                        const date = row
                            .querySelector(".team-against-row__date")
                            ?.textContent?.trim()
                            .split(" ")[0];
                        const homeTeam = row
                            .querySelector(".team-against-row__home span")
                            ?.textContent?.trim();
                        const awayTeam = row
                            .querySelector(".team-against-row__away span")
                            ?.textContent?.trim();
                        const score = row.querySelector(".icon-score")?.textContent?.trim();
                        const halfTimeScore = row
                            .querySelector(".team-against-row__half-time")
                            ?.textContent?.trim()
                            .split(":")[1]
                            .trim();
                        return `${date}: ${homeTeam} vs ${awayTeam} (FT: ${score} - HT: ${halfTimeScore})`;
                    })
            );
        };

        const recentMatches: {
            home: string[];
            away: string[];
            between: string[];
        } = {home: [], away: [], between: []};

        recentMatches.home = await getMatches(
            ".quick-statistics__table:nth-child(1) .quick-statistics__table__body",
            `${homeTeam}`
        );
        recentMatches.away = await getMatches(
            ".quick-statistics__table:nth-child(2) .quick-statistics__table__body",
            `${awayTeam}`
        );

        await page.evaluate(() => {
            const tabElement = document.querySelector('label[for="tab1_1"]');
            if (tabElement) {
                (tabElement as HTMLElement).click();
            } else {
                console.error("Tab element not found");
            }
        });

        try {
            const betweenMatches = await getBetweenMatches();
            recentMatches.between = betweenMatches;
        } catch (fetchError) {
            console.error("Error fetching head-to-head matches:", fetchError);
            recentMatches.between = [];
        }

        return {recentMatches};
    } catch (error) {
        console.error(`Error fetching H2H data: ${error}`);
        throw error;
    } finally {
        await browser.close();
    }
}

async function getTeamLineups(matchId: string): Promise<TeamLineups> {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });

    logger.info('Browser launched successfully');
    const page = await browser.newPage();

    try {
        const detailsUrl = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/kadro`;
        logger.info(`Navigating to: ${detailsUrl}`);

        await page.goto(detailsUrl, {
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 60000
        });

        // Wait for the squad content to load
        await page.waitForSelector('.match-detail__squad', { timeout: 30000 });
        // Extract lineups using Bilyoner's specific HTML structure
        const lineups = await page.evaluate(() => {
            const teams = {
                home: { formation: '', players: [] as any[] },
                away: { formation: '', players: [] as any[] }
            };
            // Function to extract players for a team
            const extractPlayers = () => {
                const players: any[] = [];
                const playerElements = document.querySelectorAll('.match-detail__squad__formation__list__item');

                playerElements.forEach(element => {
                    const numberElement = element.querySelector('.match-detail__squad__formation__list__item__shirt__number');
                    const nameElement = element.querySelector('.match-detail__squad__formation__list__item__player');
                    const positionElement = element.querySelector('.match-detail__squad__formation__list__item__position');

                    if (nameElement && nameElement.textContent !== 'Teknik Direktör') {
                        const player = {
                            number: numberElement && numberElement.textContent? parseInt(numberElement.textContent.trim(), 10) : undefined,
                            name: nameElement && nameElement.textContent? nameElement.textContent.trim() : undefined,
                            position: positionElement && positionElement.textContent ? positionElement.textContent.trim() : undefined
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
                teams.home.formation = (document.querySelector('.line-up__formation') as HTMLElement)?.textContent?.trim() || 'Unknown';
            }
            // Get away team data
            const awayTeamTab = document.querySelector('input[id="match-detail-squad-tab_1"]');
            if (awayTeamTab) {
                (awayTeamTab as HTMLInputElement).click();
                teams.away.players = extractPlayers();
                teams.away.formation = (document.querySelector('.line-up__formation') as HTMLElement)?.textContent?.trim() || 'Unknown';
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
                players: lineups.home.players.map(player => ({
                    name: player.name,
                    number: player.number,
                    position: player.position
                }))
            },
            away: {
                formation: lineups.away.formation || 'Unknown',
                players: lineups.away.players.map(player => ({
                    name: player.name,
                    number: player.number,
                    position: player.position
                }))
            }
        };

    } catch (error: any) {
        logger.error('Error fetching team lineups:', {
            error: error.message,
            stack: error.stack
        });
        throw new ScrapingError(
            'Failed to fetch team lineups',
            'LINEUP_FETCH_FAILED',
            error
        );
    } finally {
        await browser.close();
    }
}

async function getCurrentStandings(
    matchId: string,
    homeTeam: string,
    awayTeam: string
): Promise<StandingsResult> {
    const url = `https://www.bilyoner.com/mac-karti/futbol/${matchId}/puan-durumu`;
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "networkidle0" });
        logger.info(`Navigating to standings page for match ${matchId}`);
        logger.info(`Looking for teams - Home: ${homeTeam}, Away: ${awayTeam}`);

        const getStandingsForTab = async (tabId: string) => {
            // Click the tab
            await page.evaluate((id) => {
                const tab = document.querySelector(`input[id="match-card-standing-tab_${id}"]`) as HTMLInputElement;
                if (tab) tab.click();
            }, tabId);

            // Wait for content to load
            await page.waitForTimeout(1000);

            // Get all team data with their names
            const teamsData = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.team-info-row__row--bold'))
                    .map(row => {
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
                                points: parseInt(columns[8]?.textContent?.trim() || '0')
                            }
                        };
                    })
                    .filter(Boolean);
            });

            logger.info(`Found ${teamsData.length} teams in tab ${tabId}`);
            // @ts-ignore
            logger.info('Team names:', teamsData.map(t => t.name));

            // Get similarity scores for each team
            const getTeamScores = (targetTeam: string, teams: Array<{name: string, standing: any}>) => {
                const normalize = (str: string) => str.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]/g, '');

                const getLongestCommonSubsequence = (s1: string, s2: string) => {
                    const m = s1.length;
                    const n = s2.length;
                    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

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
                return teams.map(team => {
                    const normalizedTeam = normalize(team.name);

                    // Calculate different similarity metrics
                    const lcs = getLongestCommonSubsequence(normalizedTarget, normalizedTeam);
                    const directIncludes = normalizedTeam.includes(normalizedTarget) ||
                        normalizedTarget.includes(normalizedTeam);

                    // Combined score
                    const score = (lcs / Math.max(normalizedTarget.length, normalizedTeam.length)) +
                        (directIncludes ? 0.5 : 0);

                    return {
                        team: team.name,
                        standing: team.standing,
                        score
                    };
                });
            };

            // Find best matches for both teams
            // @ts-ignore
            const homeScores = getTeamScores(homeTeam, teamsData);
            // @ts-ignore
            const awayScores = getTeamScores(awayTeam, teamsData);

            // Sort by score and get best matches
            const bestHomeMatch = homeScores.sort((a, b) => b.score - a.score)[0];
            const bestAwayMatch = awayScores.sort((a, b) => b.score - a.score)[0];

            if( (!bestHomeMatch) && (!bestAwayMatch)) {
                return {}
            }

            return {
                home: bestHomeMatch.standing,
                away: bestAwayMatch.standing
            };
        };

        // Get data for all three views
        const overallStandings = await getStandingsForTab('0');  // Genel
        const homeFormStandings = await getStandingsForTab('1'); // İç Saha
        const awayFormStandings = await getStandingsForTab('2'); // Dış Saha

        return {
            home: {
                overall: overallStandings.home,
                homeForm: homeFormStandings.home,
                awayForm: awayFormStandings.home
            },
            away: {
                overall: overallStandings.away,
                homeForm: homeFormStandings.away,
                awayForm: awayFormStandings.away
            }
        };

    } catch (error) {
        logger.error('Error in getCurrentStandings:', error);
        throw error;
    } finally {
        await browser.close();
    }
}