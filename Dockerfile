FROM node:26-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

# Next.js server (standalone output)
FROM base AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# Background worker and migrations, run straight from TypeScript with tsx
FROM deps AS worker
ENV NODE_ENV=production
COPY tsconfig.json ./
COPY src/lib ./src/lib
COPY worker ./worker
COPY scripts ./scripts
COPY drizzle ./drizzle
USER node
CMD ["./node_modules/.bin/tsx", "worker/index.ts"]
