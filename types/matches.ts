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

class PlayerPosition {
    number: number | undefined
    name: string | undefined
    position: {
      x: number
      y: number
    } | undefined
}

export interface FootballMatchData extends BaseMatchData {
  unavailablePlayers: {
    home: string[]
    away: string[]
  },
  formations?: {
    home: string
    away: string
  },
    lineups?: {
        home: {
        players: PlayerPosition[]
        },
        away: {
        players: PlayerPosition[]
        }
    },
    standings: StandingsResult
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