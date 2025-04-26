// Model tanımlamaları için type-only import ekle
import type { z } from 'zod';
import { redisClient } from '../config/db';
import { FootballMatchData, BasketballMatchData } from '../types/matches';

// Type tanımı için kullanılan şema - tipik olarak runtime'da kullanılır, şimdilik bir referans olarak tutuyoruz
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type MatchRowSchema = z.ZodObject<{
  id: z.ZodString;
  match_input: z.ZodString;
  venue: z.ZodString;
  unavailable_players_home: z.ZodOptional<z.ZodArray<z.ZodString>>;
  unavailable_players_away: z.ZodOptional<z.ZodArray<z.ZodString>>;
  recent_matches_home: z.ZodArray<z.ZodString>;
  recent_matches_away: z.ZodArray<z.ZodString>;
  recent_matches_between: z.ZodArray<z.ZodString>;
  weather_temperature: z.ZodNumber;
  weather_condition: z.ZodString;
  weather_humidity: z.ZodNumber;
  weather_wind_speed: z.ZodNumber;
}>;

export class MatchRepository {
  private static instance: MatchRepository;

  private constructor() {}

  static getInstance(): MatchRepository {
    if (!MatchRepository.instance) {
      MatchRepository.instance = new MatchRepository();
    }
    return MatchRepository.instance;
  }

  async saveFootballMatch(data: FootballMatchData) {
    try {
      const key = `football:${data.id}`;
      await redisClient.json.set(key, '$', {
        id: data.id,
        match_input: data.matchInput,
        venue: data.venue,
        unavailable_players_home: data.unavailablePlayers.home,
        unavailable_players_away: data.unavailablePlayers.away,
        recent_matches_home: data.recentMatches.home,
        recent_matches_away: data.recentMatches.away,
        recent_matches_between: data.recentMatches.between,
        weather_temperature: data.weather.temperature,
        weather_condition: data.weather.condition,
        weather_humidity: data.weather.humidity,
        weather_wind_speed: data.weather.windSpeed,
      });
    } catch (error) {
      console.error('Error saving football match:', error);
      throw error;
    }
  }

  async getFootballMatch(id: string): Promise<FootballMatchData | null> {
    try {
      const key = `football:${id}`;
      const data = await redisClient.json.get(key);

      if (!data) return null;

      // Type assertion since we know the structure of the data
      const matchData = data as any;

      return {
        id: matchData.id,
        matchInput: matchData.match_input,
        homeTeam: matchData.match_input.split('-')[0],
        awayTeam: matchData.match_input.split('-')[1],
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
        // Eksik olan alanları ekle
        teamLineups: {
          home: {
            formation: matchData.home_formation || 'Unknown',
            players: matchData.home_lineups ? JSON.parse(matchData.home_lineups) : [],
          },
          away: {
            formation: matchData.away_formation || 'Unknown',
            players: matchData.away_lineups ? JSON.parse(matchData.away_lineups) : [],
          },
        },
        standings: {
          home: {
            overall: {
              position: matchData.home_standing_position || 0,
              team: matchData.match_input.split('-')[0],
              played: matchData.home_standing_played || 0,
              won: matchData.home_standing_won || 0,
              drawn: matchData.home_standing_drawn || 0,
              lost: matchData.home_standing_lost || 0,
              goalsFor: matchData.home_standing_goals_for || 0,
              goalsAgainst: matchData.home_standing_goals_against || 0,
              goalDifference: matchData.home_standing_goal_difference || 0,
              points: matchData.home_standing_points || 0,
            },
            homeForm: {
              position: matchData.home_home_position || 0,
              team: matchData.match_input.split('-')[0],
              played: matchData.home_home_played || 0,
              won: matchData.home_home_won || 0,
              drawn: matchData.home_home_drawn || 0,
              lost: matchData.home_home_lost || 0,
              goalsFor: matchData.home_home_goals_for || 0,
              goalsAgainst: matchData.home_home_goals_against || 0,
              goalDifference: matchData.home_home_goal_difference || 0,
              points: matchData.home_home_points || 0,
            },
            awayForm: {
              position: matchData.home_away_position || 0,
              team: matchData.match_input.split('-')[0],
              played: matchData.home_away_played || 0,
              won: matchData.home_away_won || 0,
              drawn: matchData.home_away_drawn || 0,
              lost: matchData.home_away_lost || 0,
              goalsFor: matchData.home_away_goals_for || 0,
              goalsAgainst: matchData.home_away_goals_against || 0,
              goalDifference: matchData.home_away_goal_difference || 0,
              points: matchData.home_away_points || 0,
            },
          },
          away: {
            overall: {
              position: matchData.away_standing_position || 0,
              team: matchData.match_input.split('-')[1],
              played: matchData.away_standing_played || 0,
              won: matchData.away_standing_won || 0,
              drawn: matchData.away_standing_drawn || 0,
              lost: matchData.away_standing_lost || 0,
              goalsFor: matchData.away_standing_goals_for || 0,
              goalsAgainst: matchData.away_standing_goals_against || 0,
              goalDifference: matchData.away_standing_goal_difference || 0,
              points: matchData.away_standing_points || 0,
            },
            homeForm: {
              position: matchData.away_home_position || 0,
              team: matchData.match_input.split('-')[1],
              played: matchData.away_home_played || 0,
              won: matchData.away_home_won || 0,
              drawn: matchData.away_home_drawn || 0,
              lost: matchData.away_home_lost || 0,
              goalsFor: matchData.away_home_goals_for || 0,
              goalsAgainst: matchData.away_home_goals_against || 0,
              goalDifference: matchData.away_home_goal_difference || 0,
              points: matchData.away_home_points || 0,
            },
            awayForm: {
              position: matchData.away_away_position || 0,
              team: matchData.match_input.split('-')[1],
              played: matchData.away_away_played || 0,
              won: matchData.away_away_won || 0,
              drawn: matchData.away_away_drawn || 0,
              lost: matchData.away_away_lost || 0,
              goalsFor: matchData.away_away_goals_for || 0,
              goalsAgainst: matchData.away_away_goals_against || 0,
              goalDifference: matchData.away_away_goal_difference || 0,
              points: matchData.away_away_points || 0,
            },
          },
        },
      };
    } catch (error) {
      console.error('Error retrieving football match:', error);
      return null;
    }
  }

  async getBasketballMatch(id: string): Promise<BasketballMatchData | null> {
    try {
      const key = `basketball:${id}`;
      const data = await redisClient.json.get(key);

      if (!data) return null;

      // Type assertion since we know the structure of the data
      const matchData = data as any;

      return {
        id: matchData.id,
        matchInput: matchData.match_input,
        homeTeam: matchData.match_input.split('-')[0],
        awayTeam: matchData.match_input.split('-')[1],
        venue: matchData.venue,
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
      };
    } catch (error) {
      console.error('Error retrieving basketball match:', error);
      return null;
    }
  }

  async saveBasketballMatch(data: BasketballMatchData) {
    try {
      const key = `basketball:${data.id}`;
      await redisClient.json.set(key, '$', {
        id: data.id,
        match_input: data.matchInput,
        venue: data.venue,
        recent_matches_home: data.recentMatches.home,
        recent_matches_away: data.recentMatches.away,
        recent_matches_between: data.recentMatches.between,
        weather_temperature: data.weather.temperature,
        weather_condition: data.weather.condition,
        weather_humidity: data.weather.humidity,
        weather_wind_speed: data.weather.windSpeed,
      });
    } catch (error) {
      console.error('Error saving basketball match:', error);
      throw error;
    }
  }
}
