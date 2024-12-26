# Use the official Node.js image as the base image
FROM node:18-slim

# Create a non-root user and group, install dependencies, and clean up in a single layer
RUN groupadd -r nodeapp && useradd -r -g nodeapp nodeapp && \
    apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    chromium \
    --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies in a single layer
COPY package*.json ./
RUN npm install --ignore-scripts && \
    npm cache clean --force

# Copy specific project files
COPY tsconfig.json ./
COPY src/ ./src/
COPY config/ ./config/
COPY services/ ./services/
COPY routes/ ./routes/
COPY utils/ ./utils/
COPY types.ts ./
COPY model/ ./model/
COPY .dockerignore ./
COPY sonar-project.properties ./

# Build the TypeScript files and set permissions in a single layer
RUN npm run build && \
    chown -R nodeapp:nodeapp /app

# Switch to non-root user
USER nodeapp

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["npm", "start"]