FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache ca-certificates && update-ca-certificates

COPY package.json ./
RUN npm install --production

COPY . ./

ENV PORT=8080
EXPOSE 8080

CMD [ "node", "index.js" ]
