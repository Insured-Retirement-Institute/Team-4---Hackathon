FROM node:20-slim

WORKDIR /app

COPY backend/package.json .
RUN npm install --production

COPY backend/server.js .
COPY backend/src/ ./src/
COPY backend/Assets/ ./Assets/

EXPOSE 8080

CMD ["node", "server.js"]
