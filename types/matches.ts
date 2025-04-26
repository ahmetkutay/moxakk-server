import { z } from 'zod';

// Common interfaces
export interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

export interface PlayerPosition {
  number: number | undefined;
  name: string | undefined;
  position: string | undefined;
}

export interface TeamFormation {
  formation: string;
  players: PlayerPosition[];
}

export interface TeamLineups {
  home: TeamFormation;
  away: TeamFormation;
}

export interface TeamStandingData {
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

export interface TeamStanding {
  overall: TeamStandingData;
  homeForm: TeamStandingData;
  awayForm: TeamStandingData;
}

export interface StandingsResult {
  home: TeamStanding;
  away: TeamStanding;
}

export interface BaseMatchData {
  id: string;
  matchInput: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  weather: WeatherData;
  recentMatches: {
    home: string[];
    away: string[];
    between: string[];
  };
}

export interface FootballMatchData extends BaseMatchData {
  unavailablePlayers: {
    home: string[];
    away: string[];
  };
  teamLineups: TeamLineups;
  standings: StandingsResult;
}

export type BasketballMatchData = BaseMatchData;

export const matchResponseSchema = z.object({
  homeTeamWinPercentage: z.number().min(0).max(100),
  awayTeamWinPercentage: z.number().min(0).max(100),
  predictedScore: z.object({
    home: z.number(),
    away: z.number(),
  }),
  predictionConfidence: z.number().min(0).max(100),
  briefComment: z.string(),
});

// Extended schema for football matches with additional predictions
export const footballMatchResponseSchema = z.object({
  homeTeamWinPercentage: z.number().min(0).max(100),
  awayTeamWinPercentage: z.number().min(0).max(100),
  drawPercentage: z.number().min(0).max(100),
  over2_5Percentage: z.number().min(0).max(100),
  bothTeamScorePercentage: z.number().min(0).max(100),
  halfTimeWinner: z.enum(['home', 'away', 'draw']),
  halfTimeWinnerPercentage: z.number().min(0).max(100),
  predictedScore: z.object({
    home: z.number(),
    away: z.number(),
  }),
  predictionConfidence: z.number().min(0).max(100),
  briefComment: z.string(),
});

export type MatchResponse = z.infer<typeof matchResponseSchema>;
export type FootballMatchResponse = z.infer<typeof footballMatchResponseSchema>;
