const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Import endpoint routes
const healthRouter = require('./api/health');
const submitRouter = require('./api/submit');
const generatePdfRouter = require('./api/generatePdf');

const app = express();
const PORT = process.env.PORT || 8080;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'App Submission API',
      version: '1.0.0',
      description: 'API for submitting applications'
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      }
    ]
  },
  apis: ['./api/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Mount endpoint routes
app.use(healthRouter);
app.use(submitRouter);
app.use(generatePdfRouter);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    availableEndpoints: [
      'GET /health',
      'POST /submit (save application submission)',
      'GET /submit/:submissionId (retrieve saved submission)',
      'POST /generate-pdf/:submissionId (generate PDF from saved submission)',
      'GET /api-docs (Swagger UI documentation)'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`App Submission API listening on port ${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  GET  /health`);
  console.log(`  POST /submit`);
  console.log(`  GET  /submit/:submissionId`);
  console.log(`  POST /generate-pdf/:submissionId`);
  console.log(`\nAPI Documentation:`);
  console.log(`  GET  /api-docs (Swagger UI)`);
});
