import axios from "axios"
import { z } from "zod"

export interface WeatherData {
  temperature: number
  condition: string
  humidity: number
  windSpeed: number
}

const weatherResponseSchema = z.object({
  main: z.object({
    temp: z.number(),
    humidity: z.number()
  }),
  weather: z.array(z.object({
    description: z.string()
  })).min(1),
  wind: z.object({
    speed: z.number()
  })
})

export class WeatherService {
  private static instance: WeatherService

  private constructor() {}

  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService()
    }
    return WeatherService.instance
  }

  createDefaultWeatherData(): WeatherData {
    return {
      temperature: 20,
      condition: "Unknown",
      humidity: 50,
      windSpeed: 5
    }
  }

  async getWeatherData(venue: string): Promise<WeatherData> {
    try {
      const location = await this.getGeocode(venue)
      if (!location) return this.createDefaultWeatherData()

      const weatherData = await this.fetchWeather(location.lat, location.lon)
      return weatherData
    } catch (error) {
      console.error("Error fetching weather data:", error)
      return this.createDefaultWeatherData()
    }
  }

  private async getGeocode(venue: string) {
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(venue)}&format=json&limit=1`
    const response = await axios.get(geocodeUrl, {
      headers: { "User-Agent": "MoxakkMatchAnalyzer/1.0" }
    })

    if (!response.data?.[0]?.lat || !response.data?.[0]?.lon) return null

    return {
      lat: response.data[0].lat,
      lon: response.data[0].lon
    }
  }

  private async fetchWeather(lat: string, lon: string): Promise<WeatherData> {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
    const response = await axios.get(url)
    
    const validatedData = weatherResponseSchema.parse(response.data)
    
    return {
      temperature: validatedData.main.temp,
      condition: validatedData.weather[0].description,
      humidity: validatedData.main.humidity,
      windSpeed: validatedData.wind.speed
    }
  }
} 