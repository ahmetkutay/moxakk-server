import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai"
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { CohereClientV2 } from "cohere-ai"
import { Mistral } from "@mistralai/mistralai"
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import dotenv from "dotenv"

dotenv.config()

const responseSchema = z.object({
  content: z.string(),
  model: z.string(),
  provider: z.enum(['gemini', 'openai', 'cohere', 'anthropic', 'mistral']),
  timestamp: z.string().datetime(),
  confidence: z.number().min(0).max(1).optional()
})

export type AIResponse = z.infer<typeof responseSchema>

export class AIService {
  private static instance: AIService
  private rateLimiter: ReturnType<typeof rateLimit>
  private geminiClient: GenerativeModel
  private openAIClient: OpenAI
  private cohereClient: CohereClientV2
  private anthropicClient: Anthropic
  private mistralClient: Mistral

  private constructor() {
    // Initialize clients
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string)
    this.geminiClient = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    this.openAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY as string })
    this.cohereClient = new CohereClientV2({ token: process.env.COHERE_API_KEY as string })
    this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY as string })
    this.mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY as string })

    this.rateLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 100
    })
  }

  static getInstance(): AIService {
    if (!this.instance) this.instance = new AIService()
    return this.instance
  }

  public async getGeminiResponse(prompt: string): Promise<string> {
    const response = await this.geminiClient.generateContent(prompt)
    return response.response.text()
  }

  public async getOpenAIResponse(prompt: string): Promise<string> {
    const response = await this.openAIClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`
        },
        { role: "user", content: prompt }
      ]
    })
    return response.choices[0].message.content || ""
  }

  public async getCohereResponse(prompt: string): Promise<string> {
    const response = await this.cohereClient.chat({
      model: "command-r-plus",
      messages: [
        { role: "user", content: prompt },
        {
          role: "assistant",
          content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores`
        }
      ]
    })
    return response.message?.content?.[0]?.text || ""
  }

  public async getAnthropicResponse(prompt: string): Promise<string> {
    const response = await this.anthropicClient.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      system: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`
    })
    return response.content[0] && "text" in response.content[0]
      ? response.content[0].text
      : ""
  }

  public async getMistralResponse(prompt: string): Promise<string> {
    const response = await this.mistralClient.chat.complete({
      model: "pixtral-12b-2409",
      messages: [
        {
          role: "system",
          content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`
        },
        { role: "user", content: prompt }
      ]
    })
    return response.choices?.[0]?.message?.content || ""
  }

  async getResponse(prompt: string): Promise<AIResponse[]> {
    try {
      const responses = await Promise.allSettled([
        this.getGeminiResponse(prompt),
        this.getOpenAIResponse(prompt),
        this.getCohereResponse(prompt),
        this.getAnthropicResponse(prompt),
        this.getMistralResponse(prompt)
      ])

      const providers = ['gemini', 'openai', 'cohere', 'anthropic', 'mistral'] as const
      
      return responses
        .filter((result): result is PromiseFulfilledResult<string> => 
          result.status === 'fulfilled'
        )
        .map((result, index) => ({
          content: result.value,
          model: 'default-model',
          provider: providers[index],
          timestamp: new Date().toISOString()
        }))
    } catch (error) {
      console.error('Error getting AI responses:', error)
      throw new Error('Failed to get AI responses')
    }
  }
} 