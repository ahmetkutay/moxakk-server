import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { CohereClientV2 } from 'cohere-ai';
import { Mistral } from '@mistralai/mistralai';
import { rateLimit } from 'express-rate-limit';
import type { z } from 'zod';
import dotenv from 'dotenv';
import PQueue from 'p-queue';
import NodeCache from 'node-cache';

dotenv.config();

// Sadece tip tanımı için kullanılan şema, uygulama çalışma zamanında kullanılmıyor
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ResponseSchema = z.ZodObject<{
  content: z.ZodString;
  model: z.ZodString;
  provider: z.ZodEnum<['gemini', 'openai', 'cohere', 'anthropic', 'mistral']>;
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

  private constructor() {
    // Check for required API keys
    this.validateApiKeys();

    // Initialize clients
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string);
    // Google Gemini (free): gemini-2.5-pro-exp-03-25 (en iyi ücretsiz model, preview)
    this.geminiClient = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    // OpenAI: gpt-4-1106-preview (gpt-4.1 mini, uygun fiyatlı ve güçlü)
    this.openAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY as string });
    // Cohere: command-r (ücretsiz ve güçlü model)
    this.cohereClient = new CohereClientV2({ token: process.env.COHERE_API_KEY as string });
    // Anthropic: claude-3-haiku-20240307 (Claude 3.5 Haiku, hızlı ve iyi)
    this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY as string });
    // Mistral (free): mistral-tiny (ücretsiz ve hızlı model)
    this.mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY as string });

    // Initialize request queue with concurrency limit
    this.requestQueue = new PQueue({
      concurrency: parseInt(process.env.AI_CONCURRENCY || '3', 10),
      timeout: 60000, // 60 seconds timeout
    });

    // Initialize cache with TTL of 1 hour
    this.responseCache = new NodeCache({
      stdTTL: parseInt(process.env.CACHE_TTL || '3600', 10),
      checkperiod: 120,
    });

    this.rateLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 100,
    });
  }
  private static instance: AIService | null = null;
  private readonly rateLimiter: ReturnType<typeof rateLimit>;
  private readonly geminiClient: GenerativeModel;
  private readonly openAIClient: OpenAI;
  private readonly cohereClient: CohereClientV2;
  private readonly anthropicClient: Anthropic;
  private readonly mistralClient: Mistral;
  private readonly requestQueue: PQueue;
  private readonly responseCache: NodeCache;

  static getInstance(): AIService {
    if (!this.instance) {
      this.instance = new AIService();
    }
    return this.instance;
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

  public async getGeminiResponse(prompt: string): Promise<string | void> {
    const cacheKey = `gemini:${Buffer.from(prompt).toString('base64')}`;

    // Check cache first
    const cachedResponse = this.responseCache.get<string>(cacheKey);
    if (cachedResponse) {
      console.log('Using cached Gemini response');
      return cachedResponse;
    }

    // Queue the request
    try {
      const response = await this.requestQueue.add(async () => {
        console.log('Making Gemini API request');
        const result = await this.geminiClient.generateContent(prompt);
        return result.response.text();
      });

      // Cache the response
      this.responseCache.set(cacheKey, response);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Gemini API error: ${errorMessage}`);
      return 'Error generating Gemini response';
    }
  }

  public async getOpenAIResponse(prompt: string): Promise<string | void> {
    const cacheKey = `openai:${Buffer.from(prompt).toString('base64')}`;

    // Check cache first
    const cachedResponse = this.responseCache.get<string>(cacheKey);
    if (cachedResponse) {
      console.log('Using cached OpenAI response');
      return cachedResponse;
    }

    // Queue the request
    try {
      const response = await this.requestQueue.add(async () => {
        console.log('Making OpenAI API request');
        const result = await this.openAIClient.chat.completions.create({
          model: 'gpt-4-1106-preview',
          messages: [
            {
              role: 'system',
              content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`,
            },
            { role: 'user', content: prompt },
          ],
        });
        return result.choices[0].message.content || '';
      });

      // Cache the response
      this.responseCache.set(cacheKey, response);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`OpenAI API error: ${errorMessage}`);
      return 'Error generating OpenAI response';
    }
  }

  public async getCohereResponse(prompt: string): Promise<string | void> {
    const cacheKey = `cohere:${Buffer.from(prompt).toString('base64')}`;

    // Check cache first
    const cachedResponse = this.responseCache.get<string>(cacheKey);
    if (cachedResponse) {
      console.log('Using cached Cohere response');
      return cachedResponse;
    }

    // Queue the request
    try {
      const response = await this.requestQueue.add(async () => {
        console.log('Making Cohere API request');
        const result = await this.cohereClient.chat({
          model: 'command-r',
          messages: [
            { role: 'user', content: prompt },
            {
              role: 'assistant',
              content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores`,
            },
          ],
        });
        return result.message?.content?.[0]?.text || '';
      });

      // Cache the response
      this.responseCache.set(cacheKey, response);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Cohere API error: ${errorMessage}`);
      return 'Error generating Cohere response';
    }
  }

  public async getAnthropicResponse(prompt: string): Promise<string | void> {
    const cacheKey = `anthropic:${Buffer.from(prompt).toString('base64')}`;

    // Check cache first
    const cachedResponse = this.responseCache.get<string>(cacheKey);
    if (cachedResponse) {
      console.log('Using cached Anthropic response');
      return cachedResponse;
    }

    // Queue the request
    try {
      const response = await this.requestQueue.add(async () => {
        console.log('Making Anthropic API request');
        const result = await this.anthropicClient.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
          system: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`,
        });
        return result.content[0] && 'text' in result.content[0] ? result.content[0].text : '';
      });

      // Cache the response
      this.responseCache.set(cacheKey, response);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Anthropic API error: ${errorMessage}`);
      return 'Error generating Anthropic response';
    }
  }

  public async getMistralResponse(prompt: string): Promise<string | void> {
    const cacheKey = `mistral:${Buffer.from(prompt).toString('base64')}`;

    // Check cache first
    const cachedResponse = this.responseCache.get<string>(cacheKey);
    if (cachedResponse) {
      console.log('Using cached Mistral response');
      return cachedResponse;
    }

    // Queue the request
    try {
      const response = await this.requestQueue.add(async () => {
        console.log('Making Mistral API request');
        const result = await this.mistralClient.chat.complete({
          model: 'pixtral-12b-2409',
          messages: [
            {
              role: 'system',
              content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`,
            },
            { role: 'user', content: prompt },
          ],
        });
        return result.choices?.[0]?.message?.content || '';
      });

      // Cache the response
      this.responseCache.set(cacheKey, response);
      return response;
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
