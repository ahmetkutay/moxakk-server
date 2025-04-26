# ---- Base Node ----
FROM node:18-slim AS base
# Create a non-root user
RUN groupadd -r nodeapp && useradd -r -g nodeapp nodeapp
# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
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
    libdrm2 \
    libxshmfence1 \
    xvfb \
    --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV CHROMIUM_PATH=/ms-playwright/chromium-1060/chrome-linux/chrome

# ---- Dependencies ----
FROM base AS dependencies
COPY --chown=nodeapp:nodeapp package*.json ./
RUN npm ci --ignore-scripts && \
    npm cache clean --force && \
    npx playwright install chromium --with-deps

# ---- Build ----
FROM dependencies AS build
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
COPY --chown=nodeapp:nodeapp . .
RUN npm run build

# ---- Development ----
FROM dependencies AS development
ENV NODE_ENV=development
COPY --chown=nodeapp:nodeapp . .
# Switch to non-root user
USER nodeapp
# Command to run the application
CMD ["npm", "run", "dev"]

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production
# Copy Playwright browser binaries from dependencies stage
COPY --from=dependencies /root/.cache/ms-playwright/ /ms-playwright/
# Copy built app from the build stage
COPY --chown=nodeapp:nodeapp --from=build /app/dist ./dist
COPY --chown=nodeapp:nodeapp --from=build /app/node_modules ./node_modules
COPY --chown=nodeapp:nodeapp --from=build /app/package*.json ./
# Create logs directory and set permissions
RUN mkdir -p /app/logs && chown -R nodeapp:nodeapp /app/logs
# Switch to non-root user
USER nodeapp
# Expose the port the app runs on
EXPOSE 8080
# Command to run the application
CMD ["npm", "start"]