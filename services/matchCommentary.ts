import { ParsedText } from "../types";
import {
  getGeminiResponse,
  getOpenAIResponse,
  getCohereResponse,
  getAnthropicResponse,
  getMistralResponse,
  getAI21Response,
  //getHuggingFaceResponse,
} from "../utils/ai";

export async function generateMatchCommentary(
  parsedText: ParsedText
): Promise<Object> {
  const prompt = generatePrompt(parsedText);
  //console.log(prompt);
  try {
    const responses = await Promise.all([
      getGeminiResponse(prompt),
      getOpenAIResponse(prompt),
      getCohereResponse(prompt),
      getAnthropicResponse(prompt),
      getMistralResponse(prompt),
      getAI21Response(prompt),
      //getHuggingFaceResponse(prompt),
    ]);

    return calculateAveragePrediction(responses);
  } catch (error) {
    console.error("Error generating content:", error);
    throw error;
  }
}

function generatePrompt(parsedText: ParsedText): string {
  const homePlayerAvailabilityList =
    parsedText.unavailablePlayers.home.join("\n");
  const awayPlayerAvailabilityList =
    parsedText.unavailablePlayers.away.join("\n");

  const homeMatchResults = parsedText.recentMatches.home.join("\n");
  const awayMatchResults = parsedText.recentMatches.away.join("\n");
  const betweenMatchResults = parsedText.recentMatches.between.join("\n");

  const prompt = `
You are a renowned sports commentator known for providing insightful, engaging, and data-driven commentary. Analyze the provided information and offer a comprehensive preview for the upcoming match.
*Important:* Check league and team names in your database before analyzing the match. Make sure to use the correct names for the league and teams. Also compare according to leagues and team differences and make the analysis accordingly.
*Match:* ${parsedText.id}
*Teams:* ${parsedText.homeTeam} vs ${parsedText.awayTeam}
*Weather:* ${parsedText.weather.temperature}°C, Condition: ${parsedText.weather.condition}, Humidity: ${parsedText.weather.humidity}%, Wind Speed: ${parsedText.weather.windSpeed} km/h

1. Recent Form Analysis:
   ${parsedText.homeTeam} 
   ${homeMatchResults}

   ${parsedText.awayTeam}
   ${awayMatchResults}

   Analyze the recent performance of both teams, highlighting any trends, strengths, or weaknesses.

2. Head-to-Head History:
${betweenMatchResults}

   Discuss the historical performance between these two teams and how it might influence this match.

3. Team Composition:
   ${parsedText.homeTeam} Unavailable Players:
   ${homePlayerAvailabilityList}

   ${parsedText.awayTeam} Unavailable Players:
   ${awayPlayerAvailabilityList}

   Evaluate how the unavailable players might impact each team's strategy and performance.

4. Weather Impact:
   Analyze how the current weather conditions might affect the game play and strategy of both teams.

5. Match Importance:
   Discuss the significance of this match in the context of the current season, league standings, or any relevant competitions.

6. Key Players:
   Identify and discuss key players from both teams who are likely to have a significant impact on the match outcome.

7. Tactical Analysis:
   Based on recent performances and team compositions, predict potential tactical approaches for both teams.

8. Match Prediction:
   Provide a detailed prediction for the match outcome in JSON format. Include only the following information:
   - Win probabilities for ${parsedText.homeTeam}, ${parsedText.awayTeam}, and Draw (in percentage)
   - Likely scoreline make sure to analyze the match,teams,league,weather, and players before predicting the scoreline.
   - Over/Under prediction for total goals (use 2.5 as the benchmark)
   - Over/Under prediction for not total goals (use 2.5 as the benchmark)
   - Both team to score prediction (true/false)
   - Both team not to score prediction (true/false)
   - Total goals prediction (sum of home and away team goals)
   - Half time / Full time prediction ( e.g 1/1, 1/0, 0/2 ) (half time/full time)
   - A comprehensive commentary on the match

9. Make sure to use the correct names for the league and teams. Also compare according to leagues and team differences and make the analysis accordingly.
`;

  return prompt;
}

function calculateAveragePrediction(responses: string[]): Object {
  //console.log(responses);
  const parsedResponses = responses
    .map((response) => {
      try {
        // Remove any markdown code block syntax and leading/trailing whitespace
        const cleanedResponse = response
          .replace(/```json\n|\n```|```/g, "")
          .trim();

        // Replace percentage values without quotes with quoted strings
        const fixedResponse = cleanedResponse.replace(/: (\d+)%/g, ': "$1%"');

        // Parse the JSON, handling percentage strings
        return JSON.parse(fixedResponse, (key, value) => {
          if (typeof value === "string" && value.endsWith("%")) {
            return parseFloat(value);
          }
          return value;
        });
      } catch (error) {
        console.error("Error parsing JSON:", error, "Response:", response);
        return null;
      }
    })
    .filter(Boolean);

  const safeAverage = (selector: (r: any) => number) => {
    const values = parsedResponses.map(selector).filter((v) => !isNaN(v));
    return values.length ? average(values) : null;
  };

  const safeMode = (selector: (r: any) => any) => {
    const values = parsedResponses
      .map(selector)
      .filter((v) => v !== undefined && v !== null);
    return values.length ? mode(values) : null;
  };

  return {
    winProbabilities: {
      homeTeam: safeAverage((r) => r.winProbabilities?.homeTeam),
      awayTeam: safeAverage((r) => r.winProbabilities?.awayTeam),
      draw: safeAverage((r) => r.winProbabilities?.draw),
    },
    likelyScoreline: safeMode((r) => r.likelyScoreline),
    likelyScorelinePrediction: safeAverage((r) => r.likelyScorelinePrediction),
    overUnderPrediction: safeMode((r) => r.overUnderPrediction),
    overUnderPredictionProbability: safeAverage(
      (r) => r.overUnderPredictionProbability
    ),
    overUnderPredictionNot: safeMode((r) => r.overUnderPredictionNot),
    overUnderPredictionNotProbability: safeAverage(
      (r) => r.overUnderPredictionNotProbability
    ),
    bothTeamsToScore: safeMode((r) => r.bothTeamsToScore),
    bothTeamsToScoreProbability: safeAverage(
      (r) => r.bothTeamsToScoreProbability
    ),
    bothTeamNotScore: safeMode((r) => r.bothTeamNotScore),
    bothTeamNotScoreProbability: safeAverage(
      (r) => r.bothTeamNotScoreProbability
    ),
    totalGoals: safeAverage((r) => r.totalGoals),
    totalGoalsPrediction: safeAverage((r) => r.totalGoalsPrediction),
    halfTimeFullTimePrediction: safeMode((r) => r.halfTimeFullTimePrediction),
    halfTimeFullTimePredictionProbability: safeAverage(
      (r) => r.halfTimeFullTimePredictionProbability
    ),
    commentaries: parsedResponses.map((r) => r.commentary).filter(Boolean),
  };
}

function average(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function mode(array: any[]): any {
  return array
    .sort(
      (a, b) =>
        array.filter((v) => v === a).length -
        array.filter((v) => v === b).length
    )
    .pop();
}
