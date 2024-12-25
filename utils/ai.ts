import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { CohereClientV2 } from "cohere-ai";
import { Mistral } from "@mistralai/mistralai";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string);
const model: GenerativeModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`,
});
const openAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY as string });
const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY as string,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY as string,
});

const apiKey = process.env.MISTRAL_API_KEY;
const client = new Mistral({ apiKey: apiKey });


export async function getGeminiResponse(prompt: string): Promise<string> {
  const response = await model.generateContent(prompt);
  return response.response.text();
}

export async function getOpenAIResponse(prompt: string): Promise<string> {
  const response = await openAI.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`,
      },
      { role: "user", content: prompt },
    ],
  });
  return response.choices[0].message.content || "";
}

export async function getCohereResponse(prompt: string): Promise<any> {
  const response = await cohere.chat({
    model: "command-r-plus",
    messages: [
      {
        role: "user",
        content: prompt,
      },
      {
        role: "assistant",
        content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores`,
      },
    ],
  });
  return response.message?.content?.[0]?.text;
}

export async function getAnthropicResponse(prompt: string): Promise<any> {
  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
    system: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.`,
  });
  return response.content[0] && "text" in response.content[0]
    ? response.content[0].text
    : "";
}

export async function getMistralResponse(prompt: string): Promise<any> {
  const chatResponse = await client.chat.complete({
    model: "pixtral-12b-2409",
    messages: [
      {
        role: "system",
        content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores.,`,
      },
      { role: "user", content: prompt },
    ],
  });

  return chatResponse.choices?.[0]?.message?.content || "";
}