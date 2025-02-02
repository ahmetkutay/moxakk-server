import { pool } from "../config/db"
import { FootballMatchData, BasketballMatchData } from "../types/matches"
import { z } from "zod"

const matchRowSchema = z.object({
  id: z.string(),
  match_input: z.string(),
  venue: z.string(),
  unavailable_players_home: z.array(z.string()).optional(),
  unavailable_players_away: z.array(z.string()).optional(),
  recent_matches_home: z.array(z.string()),
  recent_matches_away: z.array(z.string()),
  recent_matches_between: z.array(z.string()),
  weather_temperature: z.number(),
  weather_condition: z.string(),
  weather_humidity: z.number(),
  weather_wind_speed: z.number()
})

export class MatchRepository {
  private static instance: MatchRepository

  private constructor() {}

  static getInstance(): MatchRepository {
    if (!MatchRepository.instance) {
      MatchRepository.instance = new MatchRepository()
    }
    return MatchRepository.instance
  }

  async saveFootballMatch(data: FootballMatchData) {
    const query = `
      INSERT INTO match_data (
        id, match_input, venue, 
        unavailable_players_home, unavailable_players_away,
        recent_matches_home, recent_matches_away, recent_matches_between,
        weather_temperature, weather_condition, weather_humidity, weather_wind_speed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        match_input = EXCLUDED.match_input,
        venue = EXCLUDED.venue,
        unavailable_players_home = EXCLUDED.unavailable_players_home,
        unavailable_players_away = EXCLUDED.unavailable_players_away,
        recent_matches_home = EXCLUDED.recent_matches_home,
        recent_matches_away = EXCLUDED.recent_matches_away,
        recent_matches_between = EXCLUDED.recent_matches_between,
        weather_temperature = EXCLUDED.weather_temperature,
        weather_condition = EXCLUDED.weather_condition,
        weather_humidity = EXCLUDED.weather_humidity,
        weather_wind_speed = EXCLUDED.weather_wind_speed
    `
    
    await pool.query(query, [
      data.id,
      data.matchInput,
      data.venue,
      data.unavailablePlayers.home,
      data.unavailablePlayers.away,
      data.recentMatches.home,
      data.recentMatches.away,
      data.recentMatches.between,
      data.weather.temperature,
      data.weather.condition,
      data.weather.humidity,
      data.weather.windSpeed
    ])
  }

  async getBasketballMatch(id: string): Promise<BasketballMatchData | null> {
    const result = await pool.query(
      'SELECT * FROM basketball_data WHERE id = $1',
      [id]
    )
    
    if (result.rows.length === 0) return null
    
    const row = matchRowSchema.parse(result.rows[0])
    
    return {
      id: row.id,
      matchInput: row.match_input,
      homeTeam: row.match_input.split('-')[0],
      awayTeam: row.match_input.split('-')[1],
      venue: row.venue,
      recentMatches: {
        home: row.recent_matches_home,
        away: row.recent_matches_away,
        between: row.recent_matches_between
      },
      weather: {
        temperature: row.weather_temperature,
        condition: row.weather_condition,
        humidity: row.weather_humidity,
        windSpeed: row.weather_wind_speed
      }
    }
  }

  async saveBasketballMatch(data: BasketballMatchData) {
    const query = `
      INSERT INTO basketball_data (
        id, match_input, venue, 
        recent_matches_home, recent_matches_away, recent_matches_between,
        weather_temperature, weather_condition, weather_humidity, weather_wind_speed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        match_input = EXCLUDED.match_input,
        venue = EXCLUDED.venue,
        recent_matches_home = EXCLUDED.recent_matches_home,
        recent_matches_away = EXCLUDED.recent_matches_away,
        recent_matches_between = EXCLUDED.recent_matches_between,
        weather_temperature = EXCLUDED.weather_temperature,
        weather_condition = EXCLUDED.weather_condition,
        weather_humidity = EXCLUDED.weather_humidity,
        weather_wind_speed = EXCLUDED.weather_wind_speed
    `
    
    await pool.query(query, [
      data.id,
      data.matchInput,
      data.venue,
      data.recentMatches.home,
      data.recentMatches.away,
      data.recentMatches.between,
      data.weather.temperature,
      data.weather.condition,
      data.weather.humidity,
      data.weather.windSpeed
    ])
  }
} 