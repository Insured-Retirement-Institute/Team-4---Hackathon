FROM node:20-slim

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY index.js .
COPY src/ ./src/
COPY Assets/ ./Assets/

EXPOSE 8080

CMD ["node", "index.js"]
