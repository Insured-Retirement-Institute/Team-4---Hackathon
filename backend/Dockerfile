FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js .
COPY src/ ./src/
COPY Assets/ ./Assets/

EXPOSE 8080

CMD ["node", "index.js"]
