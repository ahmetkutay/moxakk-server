import { matchResponseSchema } from "../../types/matches"
import { AIService } from "../ai/AIService"

export interface BaseMatchData {
  id: string
  homeTeam: string
  awayTeam: string
  weather: {
    temperature: number
    condition: string
    humidity: number
    windSpeed: number
  }
  recentMatches: {
    home: string[]
    away: string[]
    between: string[]
  }
}

export abstract class BaseCommentaryService<T extends BaseMatchData> {
  protected abstract generatePrompt(data: T): string
  private aiService = AIService.getInstance()

  async generateCommentary(data: T): Promise<Object> {
    const prompt = this.generatePrompt(data)
    try {
      const responses = await Promise.all([
        this.aiService.getGeminiResponse(prompt),
        this.aiService.getOpenAIResponse(prompt),
        this.aiService.getCohereResponse(prompt),
        this.aiService.getAnthropicResponse(prompt),
        this.aiService.getMistralResponse(prompt),
      ])

      return responses.map(response => {
        // Clean the response by removing markdown formatting
        const cleanJson = response
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
        return matchResponseSchema.parse(JSON.parse(cleanJson))
      })
    } catch (error) {
      console.error("Error generating content:", error)
      throw error
    }
  }
} 