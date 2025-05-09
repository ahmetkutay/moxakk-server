# Moxakk Server

## Overview

Moxakk Server is a robust backend application designed to analyze and provide commentary on football and basketball matches. It leverages various AI models and web scraping techniques to gather data, analyze it, and generate insightful predictions and commentary. The server is built to handle large volumes of data and provide real-time analysis to enhance the viewing experience for sports enthusiasts.

## Features

- **Football and Basketball Analysis**: Provides detailed analysis and commentary for football and basketball matches, including player performance, team strategies, and match outcomes.
- **AI Integration**: Utilizes multiple AI models including OpenAI, Cohere, Anthropic, and more for generating accurate predictions and insightful commentary.
- **Web Scraping**: Scrapes match data from various sources to ensure up-to-date and comprehensive information.
- **Weather Data**: Integrates weather data to consider environmental conditions in predictions, providing a more holistic analysis.
- **Security**: Implements comprehensive security measures including API key authentication, CSRF protection, secure Redis connections, strict input validation, rate limiting, advanced HTTP security headers, and properly configured CORS to protect against common vulnerabilities and ensure data integrity.
- **Performance Optimization**: Implements request queuing, response caching, and process management to optimize resource usage and improve performance under high load.
- **Scalability**: Uses PM2 for process management and clustering to take advantage of multi-core systems and ensure high availability.

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
   # Server Configuration
   PORT=8080
   LOG_LEVEL=info
   API_KEY=your_api_key_here

   # Database
   REDIS_URL=redis://localhost:6379
   REDIS_PASSWORD=your_redis_password_here
   REDIS_TLS=false

   # API Keys
   OPENWEATHER_API_KEY=your_openweather_api_key
   GOOGLE_API_KEY=your_google_api_key
   OPENAI_API_KEY=your_openai_api_key
   COHERE_API_KEY=your_cohere_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   MISTRAL_API_KEY=your_mistral_api_key

   # Performance Optimization
   AI_CONCURRENCY=3
   CACHE_TTL=3600
   ```

   You can also copy the `.env.example` file and modify it with your values:

   ```sh
   cp .env.example .env
   ```

4. Build the project:

   ```sh
   npm run build
   ```

5. Start the server:

   ```sh
   npm start
   ```

   Or use PM2 for better performance and resource management:

   ```sh
   npm run pm2:start        # Start in production mode
   npm run pm2:start:dev    # Start in development mode
   npm run pm2:logs         # View logs
   npm run pm2:monit        # Monitor processes
   npm run pm2:stop         # Stop processes
   npm run pm2:restart      # Restart processes
   npm run pm2:delete       # Delete processes from PM2
   ```

## Usage

The server exposes endpoints for analyzing football and basketball matches. You can use tools like Postman or curl to interact with the API.

### Endpoints

All endpoints require the `X-API-Key` header for authentication, except for the health check endpoint.

- **Football Match Analysis**: `/api/get-match`

  - **Method**: `POST`
  - **Description**: Analyzes a football match and provides detailed commentary and predictions.
  - **Headers**:
    ```
    X-API-Key: your_api_key_here
    Content-Type: application/json
    ```
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
  - **Headers**:
    ```
    X-API-Key: your_api_key_here
    Content-Type: application/json
    ```
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

- **Health Check**: `/api/v1/health`
  - **Method**: `GET`
  - **Description**: Checks if the API is running properly. This endpoint does not require authentication.
  - **Response**:
    ```json
    {
      "status": "ok",
      "timestamp": "2023-10-01T12:00:00Z"
    }
    ```

## Security

The server implements comprehensive security measures to protect against common vulnerabilities and ensure data integrity:

### API Authentication

All API endpoints (except health checks) are protected with API key authentication:

- Configurable via the `API_KEY` environment variable
- Requires the `X-API-Key` header in all requests
- Provides detailed error messages for authentication failures
- Logs authentication attempts for security monitoring

Example authenticated request:

```sh
curl -X POST \
  http://localhost:8080/api/v1/football/analyze \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your_api_key_here' \
  -d '{"homeTeam": "Team A", "awayTeam": "Team B"}'
```

### CSRF Protection

Cross-Site Request Forgery (CSRF) protection is implemented for all non-GET requests:

- Generates and validates CSRF tokens
- Requires the `X-CSRF-Token` header for POST, PUT, DELETE requests
- Provides double-submit cookie pattern for enhanced security
- Excludes safe methods (GET, HEAD, OPTIONS) from CSRF checks

### Database Security

Redis database connections are secured with:

- Password authentication
- Optional TLS encryption
- Connection pooling with automatic reconnection
- Rate limiting for database operations

Configure Redis security in the `.env` file:

```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password_here
REDIS_TLS=true
```

### HTTP Security Headers

Comprehensive HTTP security headers are implemented using Helmet:

- Content Security Policy (CSP) to prevent XSS attacks
- Strict Transport Security (HSTS) to enforce HTTPS
- X-Content-Type-Options to prevent MIME-type sniffing
- X-Frame-Options to prevent clickjacking
- Referrer-Policy to control information in HTTP referrer
- Permissions Policy to restrict browser features
- And many more

### Input Validation

All user inputs are validated using Zod schema validation:

- Strict type checking and validation
- Protection against injection attacks
- Detailed error messages for validation failures
- Consistent error handling across the application

### Rate Limiting

API rate limiting is implemented to prevent abuse:

- Configurable limits (default: 100 requests per 15 minutes)
- IP-based rate limiting
- Standardized rate limit headers
- Graceful handling of rate limit exceeded scenarios

### CORS Configuration

Cross-Origin Resource Sharing (CORS) is strictly configured:

- Whitelist of allowed origins
- Limited HTTP methods (GET, POST only)
- Restricted headers
- Credentials support for authenticated requests

## Performance Optimization

The server includes several optimizations to improve performance and reduce resource usage:

### Request Queuing

AI requests are queued and processed with controlled concurrency to prevent overwhelming the system:

- Configurable via the `AI_CONCURRENCY` environment variable (default: 3)
- Prevents memory spikes during high traffic
- Ensures stable performance under load

### Response Caching

AI responses are cached to reduce redundant API calls:

- Configurable cache TTL via the `CACHE_TTL` environment variable (default: 3600 seconds / 1 hour)
- Significantly reduces API costs and response times for repeated queries
- Improves overall system responsiveness

### Process Management with PM2

PM2 is used for process management and clustering:

- Automatically utilizes all available CPU cores
- Provides load balancing across processes
- Restarts processes if they crash or exceed memory limits
- Includes monitoring and logging tools

You can configure these optimizations in the `.env` file:

```env
# Performance optimization settings
AI_CONCURRENCY=3     # Number of concurrent AI requests
CACHE_TTL=3600       # Cache TTL in seconds (1 hour)
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
