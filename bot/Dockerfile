# Build from the repo root (the bot uses the site's counting code in tv-app/src/shared):
#   docker build -f bot/Dockerfile .
FROM node:22-slim
WORKDIR /app/bot
COPY bot/package.json bot/package-lock.json ./
RUN npm ci --omit=dev
COPY bot/*.js ./
COPY tv-app/package.json /app/tv-app/package.json
COPY tv-app/src/shared /app/tv-app/src/shared
CMD ["node", "index.js"]
