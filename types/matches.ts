import { z } from "zod"

export interface BaseMatchData {
  id: string
  matchInput: string
  homeTeam: string
  awayTeam: string
  venue: string
  weather: WeatherData
  recentMatches: {
    home: string[]
    away: string[]
    between: string[]
  }
}

export interface FootballMatchData extends BaseMatchData {
  unavailablePlayers: {
    home: string[]
    away: string[]
  }
}

export type BasketballMatchData = BaseMatchData

export const matchResponseSchema = z.object({
  homeTeamWinPercentage: z.number().min(0).max(100),
  awayTeamWinPercentage: z.number().min(0).max(100),
  predictedScore: z.object({
    home: z.number(),
    away: z.number()
  }),
  predictionConfidence: z.number().min(0).max(100),
  briefComment: z.string()
}) 

export interface WeatherData {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
}