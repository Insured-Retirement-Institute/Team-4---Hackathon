FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY forms/ ./forms/
COPY maps/ ./maps/
COPY pdfs/ ./pdfs/
COPY generate-fieldmap.js ./generate-fieldmap.js
COPY pdfHelper.js ./pdfHelper.js
COPY verify-pdf-fields.js ./verify-pdf-fields.js
COPY index.js ./index.js 

ENV PORT=8080
EXPOSE 8080

CMD [ "node", "index.js" ]
