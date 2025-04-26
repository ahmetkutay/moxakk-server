import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { CohereClientV2 } from 'cohere-ai';
import { Mistral } from '@mistralai/mistralai';
import { rateLimit } from 'express-rate-limit';
import type { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Sadece tip tanımı için kullanılan şema, uygulama çalışma zamanında kullanılmıyor
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ResponseSchema = z.ZodObject<{
  content: z.ZodString;
  model: z.ZodString;
  provider: z.ZodEnum<["gemini", "openai", "cohere", "anthropic", "mistral"]>;
  timestamp: z.ZodString;
  confidence: z.ZodOptional<z.ZodNumber>;
}>;

export interface AIResponse {
  content: string;
  model: string;
  provider: 'gemini' | 'openai' | 'cohere' | 'anthropic' | 'mistral';
  timestamp: string;
  confidence?: number;
}

export class AIService {
  private static instance: AIService | null = null;
  private readonly rateLimiter: ReturnType<typeof rateLimit>;
  private readonly geminiClient: GenerativeModel;
  private readonly openAIClient: OpenAI;
  private readonly cohereClient: CohereClientV2;
  private readonly anthropicClient: Anthropic;
  private readonly mistralClient: Mistral;

  private constructor() {
    // Check for required API keys
    this.validateApiKeys();

    // Initialize clients
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string);
    this.geminiClient = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.openAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY as string });
    this.cohereClient = new CohereClientV2({ token: process.env.COHERE_API_KEY as string });
    this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY as string });
    this.mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY as string });

    this.rateLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 100,
    });
  }

  private validateApiKeys(): void {
    const requiredKeys = [
      'GOOGLE_API_KEY',
      'OPENAI_API_KEY',
      'COHERE_API_KEY',
      'ANTHROPIC_API_KEY',
      'MISTRAL_API_KEY',
    ];

    const missingKeys = requiredKeys.filter((key) => !process.env[key]);

    if (missingKeys.length > 0) {
      console.warn(`Warning: Missing API keys: ${missingKeys.join(', ')}`);
    }
  }

  static getInstance(): AIService {
    if (!this.instance) {
      this.instance = new AIService();
    }
    return this.instance;
  }

  public async getGeminiResponse(prompt: string): Promise<string> {
    try {
      const response = await this.geminiClient.generateContent(prompt);
      return response.response.text();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Gemini API error: ${errorMessage}`);
      return 'Error generating Gemini response';
    }
  }

  public async getOpenAIResponse(prompt: string): Promise<string> {
    try {
      const response = await this.openAIClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`,
          },
          { role: 'user', content: prompt },
        ],
      });
      return response.choices[0].message.content || '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`OpenAI API error: ${errorMessage}`);
      return 'Error generating OpenAI response';
    }
  }

  public async getCohereResponse(prompt: string): Promise<string> {
    try {
      const response = await this.cohereClient.chat({
        model: 'command-r-plus',
        messages: [
          { role: 'user', content: prompt },
          {
            role: 'assistant',
            content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores`,
          },
        ],
      });
      return response.message?.content?.[0]?.text || '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Cohere API error: ${errorMessage}`);
      return 'Error generating Cohere response';
    }
  }

  public async getAnthropicResponse(prompt: string): Promise<string> {
    try {
      const response = await this.anthropicClient.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        system: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`,
      });
      return response.content[0] && 'text' in response.content[0] ? response.content[0].text : '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Anthropic API error: ${errorMessage}`);
      return 'Error generating Anthropic response';
    }
  }

  public async getMistralResponse(prompt: string): Promise<string> {
    try {
      const response = await this.mistralClient.chat.complete({
        model: 'pixtral-12b-2409',
        messages: [
          {
            role: 'system',
            content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`,
          },
          { role: 'user', content: prompt },
        ],
      });
      return response.choices?.[0]?.message?.content || '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Mistral API error: ${errorMessage}`);
      return 'Error generating Mistral response';
    }
  }

  async getResponse(prompt: string): Promise<AIResponse[]> {
    try {
      const responses = await Promise.allSettled([
        this.getGeminiResponse(prompt),
        this.getOpenAIResponse(prompt),
        this.getCohereResponse(prompt),
        this.getAnthropicResponse(prompt),
        this.getMistralResponse(prompt),
      ]);

      const providers = ['gemini', 'openai', 'cohere', 'anthropic', 'mistral'] as const;

      return responses
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map((result, index) => ({
          content: result.value,
          model: 'default-model',
          provider: providers[index],
          timestamp: new Date().toISOString(),
        }));
    } catch (error) {
      console.error('Error getting AI responses:', error);
      throw new Error('Failed to get AI responses');
    }
  }
}
