# Moxakk Server

## Overview
Moxakk Server is a robust backend application designed to analyze and provide commentary on football and basketball matches. It leverages various AI models and web scraping techniques to gather data, analyze it, and generate insightful predictions and commentary. The server is built to handle large volumes of data and provide real-time analysis to enhance the viewing experience for sports enthusiasts.

## Features
- **Football and Basketball Analysis**: Provides detailed analysis and commentary for football and basketball matches, including player performance, team strategies, and match outcomes.
- **AI Integration**: Utilizes multiple AI models including OpenAI, Cohere, Anthropic, and more for generating accurate predictions and insightful commentary.
- **Web Scraping**: Scrapes match data from various sources to ensure up-to-date and comprehensive information.
- **Weather Data**: Integrates weather data to consider environmental conditions in predictions, providing a more holistic analysis.
- **Security**: Implements security best practices including rate limiting, CORS, and helmet for HTTP headers to ensure the safety and integrity of the application.

## Installation

### Prerequisites
- Node.js (version 18.x)
- Docker
- PostgreSQL

### Steps
1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/moxakk-server.git
    cd moxakk-server
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Set up environment variables:
    Create a `.env` file in the root directory and add the necessary environment variables:
    ```env
    POSTGRES_USER=your_postgres_user
    POSTGRES_PASSWORD=your_postgres_password
    POSTGRES_HOST=your_postgres_host
    POSTGRES_PORT=your_postgres_port
    POSTGRES_DB=your_postgres_db
    OPENWEATHER_API_KEY=your_openweather_api_key
    GOOGLE_API_KEY=your_google_api_key
    OPENAI_API_KEY=your_openai_api_key
    COHERE_API_KEY=your_cohere_api_key
    ANTHROPIC_API_KEY=your_anthropic_api_key
    MISTRAL_API_KEY=your_mistral_api_key
    ```

4. Build the project:
    ```sh
    npm run build
    ```

5. Start the server:
    ```sh
    npm start
    ```

## Usage
The server exposes endpoints for analyzing football and basketball matches. You can use tools like Postman or curl to interact with the API.

### Endpoints
- **Football Match Analysis**: `/api/get-match`
    - **Method**: `POST`
    - **Description**: Analyzes a football match and provides detailed commentary and predictions.
    - **Request Body**:
        ```json
        {
            "homeTeam": "Team A",
            "awayTeam": "Team B"
        }
        ```
    - **Response**:
        ```json
        {
            "success": true,
            "content": {
                "homeTeamWinPercentage": 45,
                "awayTeamWinPercentage": 35,
                "drawPercentage": 20,
                "over2_5Percentage": 60,
                "bothTeamScorePercentage": 55,
                "halfTimeWinner": "home",
                "halfTimeWinnerPercentage": 50,
                "predictedScore": {
                    "home": 2,
                    "away": 1
                },
                "predictionConfidence": 80,
                "briefComment": "Team A is expected to win with a narrow margin."
            },
            "timestamp": "2023-10-01T12:00:00Z"
        }
        ```

- **Basketball Match Analysis**: `/api/get-basketball`
    - **Method**: `POST`
    - **Description**: Analyzes a basketball match and provides detailed commentary and predictions.
    - **Request Body**:
        ```json
        {
            "homeTeam": "Team A",
            "awayTeam": "Team B"
        }
        ```
    - **Response**:
        ```json
        {
            "success": true,
            "content": {
                "homeTeamWinPercentage": 55,
                "awayTeamWinPercentage": 45,
                "predictedScore": {
                    "home": 95,
                    "away": 90
                },
                "predictionConfidence": 85,
                "briefComment": "Team A is likely to win in a closely contested match."
            },
            "timestamp": "2023-10-01T12:00:00Z"
        }
        ```

## Docker
You can also run the server using Docker.

1. Build the Docker image:
    ```sh
    docker build -t moxakk-analyzer .
    ```

2. Run the Docker container:
    ```sh
    docker-compose up -d
    ```

## Contributing
Contributions are welcome! Please open an issue or submit a pull request. Make sure to follow the contribution guidelines and code of conduct.

## License
This project is licensed under the MIT License.