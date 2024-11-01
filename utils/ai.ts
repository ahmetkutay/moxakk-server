import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { CohereClientV2 } from "cohere-ai";
import { Mistral } from "@mistralai/mistralai";
import { HfInference } from "@huggingface/inference";
import axios from "axios";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string);
const model: GenerativeModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores. Base on the data you had and my givings. Return ONLY the JSON object with these predictions, no additional text or explanation.

   Example format:
   {
     "winProbabilities": {
       "homeTeam": 45,
       "awayTeam": 35,
       "draw": 20
     },
     "likelyScoreline": "2-1",
     "likelyScorelinePrediction": 65,
     "overUnderPrediction": "over",
     "overUnderPredictionProbability": 65,
     "bothTeamsToScore": true,
     "bothTeamsToScoreProbability": 65,
     "totalGoals": 3,
     "totalGoalsPrediction": 65,
     "halfTimeFullTimePrediction": "1/1",
     "halfTimeFullTimePredictionProbability": 65,
     "commentary": "A comprehensive commentary on the match"
   }`,
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

const hf = new HfInference(process.env.HUGGING_FACE_API_KEY as string);

const ROOT_URL = "https://api.ai21.com/studio/v1/";

interface Message {
  role: string;
  content: string;
}

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
        content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores. Base on the data you had and my givings. Return ONLY the JSON object with these predictions, no additional text or explanation.

Example format:
{
  "winProbabilities": {
    "homeTeam": 45%,
    "awayTeam": 35%,
    "draw": 20%
  },
  "likelyScoreline": "2-1",
  "likelyScorelinePrediction": "65%",
  "overUnderPrediction": "over",
  "overUnderPredictionProbability": "65%",
  "overUnderPredictionNot": false,
  "overUnderPredictionNotProbability": "35%",
  "bothTeamsToScore": true,
  "bothTeamsToScoreProbability": "65%",
  "bothTeamNotScore": false,
  "bothTeamNotScoreProbability": "35%",
  "totalGoals": 3,
  "totalGoalsPrediction": "65%",
  "halfTimeFullTimePrediction": "1/1",
  "halfTimeFullTimePredictionProbability": "65%",
  "commentary": "An comprehensive commentary on the match"
}`,
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
        content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores. Based on the data you have and my input, return ONLY a JSON object with these predictions, no additional text or explanation.

Example format:
{
  "winProbabilities": {
    "homeTeam": 45%,
    "awayTeam": 35%,
    "draw": 20%
  },
  "likelyScoreline": "2-1",
  "likelyScorelinePrediction": "65%",
  "overUnderPrediction": "over",
  "overUnderPredictionProbability": "65%",
  "overUnderPredictionNot": false,
  "overUnderPredictionNotProbability": "35%",
  "bothTeamsToScore": true,
  "bothTeamsToScoreProbability": "65%",
  "bothTeamNotScore": false,
  "bothTeamNotScoreProbability": "35%",
  "totalGoals": 3,
  "totalGoalsPrediction": "65%",
  "halfTimeFullTimePrediction": "half time/full time e.g. 1/1, 1/0, 0/2",
  "halfTimeFullTimePredictionProbability": "65%",
  "commentary": "An comprehensive commentary on the match"
}`,
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
    system: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores. Based on the data you have and my input, return ONLY a JSON object with these predictions, no additional text or explanation.

Example format:
{
  "winProbabilities": {
    "homeTeam": 45%,
    "awayTeam": 35%,
    "draw": 20%
  },
  "likelyScoreline": "2-1",
  "likelyScorelinePrediction": "65%",
  "overUnderPrediction": "over",
  "overUnderPredictionProbability": "65%",
  "overUnderPredictionNot": false,
  "overUnderPredictionNotProbability": "35%",
  "bothTeamsToScore": true,
  "bothTeamsToScoreProbability": "65%",
  "bothTeamNotScore": false,
  "bothTeamNotScoreProbability": "35%",
  "totalGoals": 3,
  "totalGoalsPrediction": "65%",
  "halfTimeFullTimePrediction": "1/1",
  "halfTimeFullTimePredictionProbability": "65%",
  "commentary": "An comprehensive commentary on the match"
}`,
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
        content: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores. Based on the data you have and my input, return ONLY a JSON object with these predictions, no additional text or explanation.
        Example format:
{
  "winProbabilities": {
    "homeTeam": 45%,
    "awayTeam": 35%,
    "draw": 20%
  },
  "likelyScoreline": "2-1",
  "likelyScorelinePrediction": "65%",
  "overUnderPrediction": "over",
  "overUnderPredictionProbability": "65%",
  "overUnderPredictionNot": false,
  "overUnderPredictionNotProbability": "35%",
  "bothTeamsToScore": true,
  "bothTeamsToScoreProbability": "65%",
  "bothTeamNotScore": false,
  "bothTeamNotScoreProbability": "35%",
  "totalGoals": 3,
  "totalGoalsPrediction": "65%",
  "halfTimeFullTimePrediction": "half time/full time e.g. 1/1, 1/0, 0/2",
  "halfTimeFullTimePredictionProbability": "65%",
  "commentary": "An comprehensive commentary on the match"
},`,
      },
      { role: "user", content: prompt },
    ],
  });

  return chatResponse.choices?.[0]?.message?.content || "";
}
/*
export async function getHuggingFaceResponse(prompt: string): Promise<string> {
  const maxTokens = 1024; // Maximum allowed tokens
  const promptTokens = prompt.split(/\s+/).length; // Estimate the number of tokens in the prompt
  const maxNewTokens = Math.max(0, maxTokens - promptTokens); // Calculate the maximum new tokens allowed

  if (maxNewTokens <= 0) {
    throw new Error("Input prompt is too long and exceeds the token limit.");
  }

  const response = await hf.textGeneration({
    model: "bert", // Use a free model that accepts 2000 characters
    inputs: `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores. Base on the data you had and my givings. Return ONLY the JSON object with these predictions, no additional text or explanation.

Example format:
{
  "winProbabilities": {
    "homeTeam": 45,
    "awayTeam": 35,
    "draw": 20
  },
  "likelyScoreline": "2-1",
  "likelyScorelinePrediction": 65,
  "overUnderPrediction": "over",
  "overUnderPredictionProbability": 65,
  "bothTeamsToScore": true,
  "bothTeamsToScoreProbability": 65,
  "totalGoals": 3,
  "totalGoalsPrediction": 65,
  "halfTimeFullTimePrediction": "1/1",
  "halfTimeFullTimePredictionProbability": 65,
  "commentary": "A comprehensive commentary on the match"
}

${prompt}`,
    parameters: {
      max_new_tokens: maxNewTokens,
      temperature: 0.7,
      return_full_text: false,
    },
  });

  try {
    return JSON.parse(response.generated_text);
  } catch (error) {
    console.error("Error parsing Hugging Face response:", error);
    return response.generated_text;
  }
}*/

export async function getAI21Response(prompt: string): Promise<string> {
  const systemMessage = `You are an analyzer on football and you make comments on 2.5 goals over/under, who wins, both team score, match scores. Base on the data you had and my givings. Return ONLY the JSON object with these predictions, no additional text or explanation.

Example format:
{
  "winProbabilities": {
    "homeTeam": 45,
    "awayTeam": 35,
    "draw": 20
  },
  "likelyScoreline": "1-2",
  "likelyScorelinePrediction": 65,
  "overUnderPrediction": "over",
  "overUnderPredictionProbability": 65,
  "overUnderPredictionNot": false,
  "overUnderPredictionNotProbability": 35,
  "bothTeamsToScore": true,
  "bothTeamsToScoreProbability": 65,
  "bothTeamNotScore": false,
  "bothTeamNotScoreProbability": 35,
  "totalGoals": 3,
  "totalGoalsPrediction": 65,
  "halfTimeFullTimePrediction": "1/1",
  "halfTimeFullTimePredictionProbability": 65,
  "commentary": "A comprehensive commentary on the match"
}`;

  const history = [prompt];
  const roles = ["user", "assistant"];
  const historyList: Message[] = history.map((content, i) => ({
    role: roles[i % 2],
    content,
  }));

  if (systemMessage) {
    historyList.unshift({ role: "system", content: systemMessage });
  }

  try {
    const response = await axios.post(
      `${ROOT_URL}chat/completions`,
      {
        model: "jamba-instruct",
        messages: historyList,
        max_tokens: 2048,
        temperature: 0.4,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AI21_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(`API call failed with status code ${response.status}`);
    }

    const data = response.data;
    if (!data.choices || data.choices.length === 0) {
      throw new Error("No choices returned from AI21 API");
    }

    const generatedText = data.choices[0].message.content;

    try {
      return JSON.parse(generatedText);
    } catch (error) {
      console.error("Error parsing AI21 response:", error);
      return generatedText;
    }
  } catch (error) {
    console.error("Error calling AI21 API:", error);
    throw new Error(
      `Failed to get response from AI21 API: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
