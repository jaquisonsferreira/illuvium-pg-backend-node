FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

EXPOSE 5000

CMD ["dist/main"]