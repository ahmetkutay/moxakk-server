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

export interface RefereeMatch {
  date: string;
  tournament: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  halfTimeScore: string;
  yellowCards: number;
  redCards: number;
  penalties: number;
}

export interface RefereeStats {
  name: string;
  country: string;
  age?: string;
  tournaments?: Array<{
    name: string;
    matchCount: number;
  }>;
  summary?: {
    homeWin: number;
    draw: number;
    awayWin: number;
    yellowCards: string; // e.g. '28 - 20'
    redCards: string; // e.g. '4 - 2'
    penalties: string; // e.g. '1 - 3'
  };
  recentMatches?: RefereeMatch[];
}

export interface PlayerRating {
  month: string;
  value: number;
}

export interface LeaguePerformance {
  name: string;
  appearances: number;
  rating: number;
}

export interface PlayerAttributes {
  attacking: number;
  technical: number;
  tactical: number;
  defending: number;
  creativity: number;
}

export interface GeneralStats {
  matchesPlayed: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  rating: number;
}

export interface ShootingStats {
  totalShots: number;
  shotsOnTarget: number;
  shotsOffTarget: number;
  blockedShots: number;
  shotAccuracy: number;
}

export interface TeamPlayStats {
  dribbleAttempts: number;
  successfulDribbles: number;
  dribbleSuccess: number;
  foulsDrawn: number;
  offsides: number;
  dispossessed: number;
}

export interface PassingStats {
  totalPasses: number;
  accuratePasses: number;
  passAccuracy: number;
  keyPasses: number;
  bigChancesCreated: number;
}

export interface DefendingStats {
  tackles: number;
  interceptions: number;
  clearances: number;
  blockedShots: number;
  duelsWon: number;
  duelsLost: number;
}

export interface AdditionalStats {
  yellowCards: number;
  redCards: number;
  foulsCommitted: number;
  aerialDuelsWon: number;
  aerialDuelsLost: number;
}

export interface CurrentSeasonStats {
  general?: GeneralStats;
  shooting?: ShootingStats;
  teamPlay?: TeamPlayStats;
  passing?: PassingStats;
  defending?: DefendingStats;
  additional?: AdditionalStats;
  competitions: {
    name: string;
    general?: GeneralStats;
    shooting?: ShootingStats;
    teamPlay?: TeamPlayStats;
    passing?: PassingStats;
    defending?: DefendingStats;
    additional?: AdditionalStats;
  }[];
}

export interface PlayerSearchResult {
  id: string;
  name: string;
  url: string;
  team?: {
    id: number;
    name: string;
  };
}

export interface PlayerData {
  name: string;
  id: string;
  url: string;
  strengths?: string[];
  weaknesses?: string[];
  averageRating?: number;
  monthlyRatings?: PlayerRating[];
  leaguePerformance?: LeaguePerformance[];
  attributes?: PlayerAttributes;
  currentSeasonStats?: CurrentSeasonStats;
}

export interface TeamPlayerData {
  home: PlayerData[];
  away: PlayerData[];
}

export interface FootballMatchData extends BaseMatchData {
  unavailablePlayers: {
    home: string[];
    away: string[];
  };
  teamLineups: TeamLineups;
  standings: StandingsResult;
  refereeStats?: RefereeStats;
  playerData?: TeamPlayerData;
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
export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

export const footballMatchResponseSchema = z.object({
  homeTeamWinPercentage: z.number().min(0).max(100),
  homeTeamConfidenceInterval: z
    .object({
      lower: z.number().min(0).max(100),
      upper: z.number().min(0).max(100),
    })
    .optional(),
  awayTeamWinPercentage: z.number().min(0).max(100),
  awayTeamConfidenceInterval: z
    .object({
      lower: z.number().min(0).max(100),
      upper: z.number().min(0).max(100),
    })
    .optional(),
  drawPercentage: z.number().min(0).max(100),
  drawConfidenceInterval: z
    .object({
      lower: z.number().min(0).max(100),
      upper: z.number().min(0).max(100),
    })
    .optional(),
  over2_5Percentage: z.number().min(0).max(100),
  over2_5ConfidenceInterval: z
    .object({
      lower: z.number().min(0).max(100),
      upper: z.number().min(0).max(100),
    })
    .optional(),
  bothTeamScorePercentage: z.number().min(0).max(100),
  bothTeamScoreConfidenceInterval: z
    .object({
      lower: z.number().min(0).max(100),
      upper: z.number().min(0).max(100),
    })
    .optional(),
  halfTimeWinner: z.enum(['home', 'away', 'draw']),
  halfTimeWinnerPercentage: z.number().min(0).max(100),
  halfTimeWinnerConfidenceInterval: z
    .object({
      lower: z.number().min(0).max(100),
      upper: z.number().min(0).max(100),
    })
    .optional(),
  predictedScore: z.object({
    home: z.number(),
    away: z.number(),
  }),
  predictionConfidence: z.number().min(0).max(100),
  briefComment: z.string(),
  refereeImpact: z.string(),
  weatherImpact: z.string(),
});

export type MatchResponse = z.infer<typeof matchResponseSchema>;
export type FootballMatchResponse = z.infer<typeof footballMatchResponseSchema>;
