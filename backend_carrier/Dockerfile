FROM node:18-alpine

WORKDIR /app

#RUN apk add --no-cache ca-certificates && update-ca-certificates

COPY package.json ./
RUN npm install --production

COPY index.js ./index.js 
COPY utils/ ./utils/
COPY api/ ./api/
COPY forms/ ./forms/
COPY maps/ ./maps/
COPY pdfs/ ./pdfs/

ENV PORT=8080
EXPOSE 8080

CMD [ "node", "index.js" ]
