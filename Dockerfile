FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN groupadd -g 1654 appuser && \
    useradd -u 1654 -g appuser -m -s /bin/bash appuser
USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/_system/health/live', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/main"]