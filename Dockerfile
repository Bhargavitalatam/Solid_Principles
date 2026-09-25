FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY . ./

# If node_modules is not already present, install runtime production dependencies
RUN if [ ! -d "node_modules" ]; then npm install --omit=dev; fi

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "dist/src/api/server.js"]
