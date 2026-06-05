FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ARG SERVER_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV SERVER_API_URL=$SERVER_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY frontend frontend
RUN npm --workspace frontend run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ARG SERVER_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV SERVER_API_URL=$SERVER_API_URL
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/frontend/package.json frontend/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/frontend/.next frontend/.next
COPY --from=builder /app/frontend/next.config.mjs frontend/next.config.mjs
RUN addgroup -S app \
    && adduser -S app -G app \
    && mkdir -p frontend/.next/cache \
    && chown -R app:app frontend/.next/cache
USER app

EXPOSE 3000

CMD ["npm", "--workspace", "frontend", "run", "start"]
