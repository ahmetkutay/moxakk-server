import { ParsedText } from '../types';
import { getGeminiResponse, getOpenAIResponse, getCohereResponse, getAnthropicResponse } from '../utils/ai';

export async function generateMatchCommentary(parsedText: ParsedText): Promise<Object> {
    const prompt = generatePrompt(parsedText);
    console.log(prompt);
    try {
        const [geminiResponse, openaiResponse, cohereResponse, anthropicResponse] = await Promise.all([
            getGeminiResponse(prompt),
            getOpenAIResponse(prompt),
            getCohereResponse(prompt),
            getAnthropicResponse(prompt)
        ]);
        
        return {
            gemini: geminiResponse,
            openai: openaiResponse,
            cohere: cohereResponse,
            anthropic: anthropicResponse
        };
    } catch (error) {
        console.error('Error generating content:', error);
        throw error;
    }
}

function generatePrompt(parsedText: ParsedText): string {
    const homePlayerAvailabilityList = parsedText.unavailablePlayers.home.join('\n');
    const awayPlayerAvailabilityList = parsedText.unavailablePlayers.away.join('\n');

    const homeMatchResults = parsedText.recentMatches.home.join('\n');
    const awayMatchResults = parsedText.recentMatches.away.join('\n');
    const betweenMatchResults = parsedText.recentMatches.between.join('\n');

    const prompt = `
You are a renowned sports commentator known for providing insightful, engaging, and data-driven commentary. Analyze the provided information and offer a comprehensive preview for the upcoming match.

*Match:* ${parsedText.id}
*Weather:* ${parsedText.weather.temperature}°C, Condition: ${parsedText.weather.condition}, Humidity: ${parsedText.weather.humidity}%, Wind Speed: ${parsedText.weather.windSpeed} km/h

1. Recent Form Analysis:
   Home Team 
   Last matches: Sao Paulo
06.10.24
SA

Cuiaba

Sao Paulo
2
0
L
29.09.24
SA

Sao Paulo

Corinthians
3
1
W
26.09.24
COP

Sao Paulo

Botafogo RJ
1
2
1
1
L
23.09.24
SA

Sao Paulo

Internacional
1
3
L
19.09.24
COP

Botafogo RJ

Sao Paulo
0
0
D
16.09.24
SA

Cruzeiro

Sao Paulo
0
1
W
13.09.24
COP

Atletico-MG

Sao Paulo
0
0
D
02.09.24
SA

Fluminense

Sao Paulo
2
0
L
29.08.24
COP

Sao Paulo

Atletico-MG
0
1
L
26.08.24
SA

Sao Paulo

Vitoria
2
1
W
23.08.24
COP

Sao Paulo

Nacional
2
0
W
18.08.24
SA

Palmeiras

Sao Paulo
2
1
L
16.08.24
COP

Nacional

Sao Paulo
0
0
D
11.08.24
SA

Sao Paulo

Atletico GO
1
0
W
09.08.24
COP

Goias

Sao Paulo
0
0
D
04.08.24
SA

Sao Paulo

Flamengo RJ
1
0
W
31.07.24
COP

Sao Paulo

Goias
2
0
W
28.07.24
SA

Fortaleza

Sao Paulo
1
0
L
25.07.24
SA

Sao Paulo

Botafogo RJ
2
2
D
22.07.24
SA

Juventude

Sao Paulo
0
0
D
18.07.24
SA

Sao Paulo

Gremio
1
0
W
12.07.24
SA

Atletico-MG

Sao Paulo
2
1
L
07.07.24
SA

Sao Paulo

Bragantino
2
0
W
04.07.24
SA

Athletico-PR

Sao Paulo
1
2
W
30.06.24
SA

Sao Paulo

Bahia
3
1
W
28.06.24
SA

Sao Paulo

Criciuma
2
1
W
23.06.24
SA

Vasco

Sao Paulo
4
1
L
20.06.24
SA

Sao Paulo

Cuiaba
0
1
L
16.06.24
SA

Corinthians

Sao Paulo
2
2
D
14.06.24
SA

Internacional

Sao Paulo
0
0
D
03.06.24
SA

Sao Paulo

Cruzeiro
2
0
W
30.05.24
COP

Sao Paulo

Talleres Cordoba
2
0
W
24.05.24
COP

Sao Paulo

Aguia De Maraba
2
0
W
17.05.24
COP

Sao Paulo

Barcelona SC
0
0
D
14.05.24
SA

Sao Paulo

Fluminense
2
1
W
09.05.24
COP

Cobresal

Sao Paulo
1
3
W
05.05.24
SA

Vitoria

Sao Paulo
1
3
W
03.05.24
COP

Aguia De Maraba

Sao Paulo
1
3
W
30.04.24
SA

Sao Paulo

Palmeiras
0
0
D
26.04.24
COP

Barcelona SC

Sao Paulo
0
2
W
22.04.24
SA

Atletico GO

Sao Paulo
0
3
W
18.04.24
SA

Flamengo RJ

Sao Paulo
2
1
L
14.04.24
SA

Sao Paulo

Fortaleza
1
2
L
11.04.24
COP

Sao Paulo

Cobresal
2
0
W
05.04.24
COP

Talleres Cordoba

Sao Paulo
2
1
L
18.03.24
PAU

Sao Paulo

Novorizontino
1
2
1
1
L
10.03.24
PAU

Ituano

Sao Paulo
2
3
W
04.03.24
PAU

Sao Paulo

Palmeiras
1
1
D
29.02.24
PAU

Inter de Limeira

Sao Paulo
0
3
W
26.02.24
PAU

Guarani

Sao Paulo
1
1
D

   Away Team
 Last matches: Vasco
06.10.24
SA

Vasco

Juventude
1
1
D
03.10.24
COP

Atletico-MG

Vasco
2
1
L
30.09.24
SA

Cruzeiro

Vasco
1
1
D
22.09.24
SA

Vasco

Palmeiras
0
1
L
16.09.24
SA

Flamengo RJ

Vasco
1
1
D
12.09.24
COP

Athletico-PR

Vasco
2
2
2
1
D
02.09.24
SA

Vitoria

Vasco
0
1
W
30.08.24
COP

Vasco

Athletico-PR
2
1
W
27.08.24
SA

Vasco

Athletico-PR
2
1
W
18.08.24
SA

Criciuma

Vasco
2
2
D
11.08.24
SA

Vasco

Fluminense
2
0
W
07.08.24
COP

Vasco

Atletico GO
1
0
W
04.08.24
SA

Vasco

Bragantino
2
2
D
01.08.24
COP

Atletico GO

Vasco
1
1
D
29.07.24
SA

Gremio

Vasco
1
0
L
21.07.24
SA

Atletico-MG

Vasco
2
0
L
18.07.24
SA

Atletico GO

Vasco
0
1
W
11.07.24
SA

Vasco

Corinthians
2
0
W
08.07.24
SA

Internacional

Vasco
1
2
W
04.07.24
SA

Vasco

Fortaleza
2
0
W
30.06.24
SA

Vasco

Botafogo RJ
1
1
D
27.06.24
SA

Bahia

Vasco
2
1
L
23.06.24
SA

Vasco

Sao Paulo
4
1
W
20.06.24
SA

Juventude

Vasco
2
0
L
17.06.24
SA

Vasco

Cruzeiro
0
0
D
14.06.24
SA

Palmeiras

Vasco
2
0
L
02.06.24
SA

Vasco

Flamengo RJ
1
6
L
22.05.24
COP

Vasco

Fortaleza
4
3
3
3
W
13.05.24
SA

Vasco

Vitoria
2
1
W
05.05.24
SA

Athletico-PR

Vasco
1
0
L
02.05.24
COP

Fortaleza

Vasco
0
0
D
27.04.24
SA

Vasco

Criciuma
0
4
L
20.04.24
SA

Fluminense

Vasco
2
1
L
18.04.24
SA

Bragantino

Vasco
2
1
L
14.04.24
SA

Vasco

Gremio
2
1
W
17.03.24
CAR

Nova Iguacu

Vasco
1
0
L
11.03.24
CAR

Vasco

Nova Iguacu
1
1
D
08.03.24
COP

Vasco

Agua Santa
4
3
3
3
W
04.03.24
CAR

Vasco

Portuguesa RJ
4
0
W
28.02.24
COP

Marcilio Dias

Vasco
1
3
W
24.02.24
CAR

Vasco

Volta Redonda
2
1
W
18.02.24
CAR

Botafogo RJ

Vasco
2
4
W
15.02.24
CAR

Fluminense

Vasco
0
0
D
09.02.24
CAR

Vasco

Audax RJ
1
0
W
05.02.24
CAR

Vasco

Flamengo RJ
0
0
D
01.02.24
CAR

Nova Iguacu

Vasco
2
0
L
28.01.24
CAR

Bangu

Vasco
2
2
D
26.01.24
CAR

Vasco

Madureira
2
0
W
22.01.24
SRP

Maldonado

Vasco
0
1
W
22.01.24
CAR

Sampaio Correa FE

Vasco
3
3
D

   Analyze the recent performance of both teams, highlighting any trends, strengths, or weaknesses.

2. Head-to-Head History:
   Head-to-head matches
23.06.24
SA

Vasco

Sao Paulo
4
1
08.10.23
SA

Vasco

Sao Paulo
0
0
21.05.23
SA

Sao Paulo

Vasco
4
2
05.08.21
COP

Vasco

Sao Paulo
1
2
29.07.21
COP

Sao Paulo

Vasco
2
0
22.11.20
SA

Sao Paulo

Vasco
1
1
16.08.20
SA

Vasco

Sao Paulo
2
1
29.11.19
SA

Sao Paulo

Vasco
1
0
25.08.19
SA

Vasco

Sao Paulo
2
0
23.11.18
SA

Vasco

Sao Paulo
2
0
05.08.18
SA

Sao Paulo

Vasco
2
1
12.11.17
SA

Vasco

Sao Paulo
1
1
20.07.17
SA

Sao Paulo

Vasco
1
0
18.10.15
SA

Sao Paulo

Vasco
2
2
01.10.15
COP

Vasco

Sao Paulo
1
1
24.09.15
COP

Sao Paulo

Vasco
3
0
09.07.15
SA

Vasco

Sao Paulo
0
4
15.09.13
SA

Vasco

Sao Paulo
0
2
30.05.13
SA

Sao Paulo

Vasco
5
1
11.10.12
SA

Vasco

Sao Paulo
0
2


   Discuss the historical performance between these two teams and how it might influence this match.

3. Team Composition:
   Home Team Unavailable Players:
   ${homePlayerAvailabilityList}

   Away Team Unavailable Players:
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
   Provide a detailed prediction for the match outcome, including:
   - Win probabilities for Home Team, Away Team, and Draw (in percentage)
   - Likely scoreline
   - Over/Under prediction for total goals
   - Both team to score prediction
   
   Present this information in a clear, tabular format.

Please structure your response clearly, using headings for each section. Aim for a comprehensive, engaging, and insightful match preview that captures the excitement and nuances of the upcoming game.
Return only Match Prediction JSON not any other text.
`;

    return prompt;
}