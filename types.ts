// Define all your TypeScript interfaces here
export interface Player {
    player: string;
    availability: string;
}

export interface Availability {
    availabilityList: Player[];
}

export interface MatchDetail {
    type: string;
    result: string;
}

export interface WeatherData {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
}

export interface MatchParsedText {
    id: string;
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
}

export interface BasketballParsedText {
    id: string;
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