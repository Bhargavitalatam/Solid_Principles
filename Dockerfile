FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src/ ./src/
COPY legacy/ ./legacy/
COPY tests/ ./tests/

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/infrastructure/database/schema.sql ./dist/src/infrastructure/database/schema.sql
COPY src/infrastructure/database/seed.sql ./dist/src/infrastructure/database/seed.sql
COPY src/infrastructure/database/schema.sql ./src/infrastructure/database/schema.sql
COPY src/infrastructure/database/seed.sql ./src/infrastructure/database/seed.sql
COPY src/infrastructure/database/init.sql ./src/infrastructure/database/init.sql

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "dist/src/api/server.js"]
