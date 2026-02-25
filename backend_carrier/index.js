const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const swaggerUi = require('swagger-ui-express');

// Import endpoint routes
const healthRouter = require('./api/health');
const submitRouter = require('./api/submit');
const getRouter = require('./api/get');
const deleteRouter = require('./api/delete');
const generatePdfRouter = require('./api/pdf');

const app = express();
const PORT = process.env.PORT || 8080;

// Load OpenAPI spec from YAML file
const swaggerFile = path.join(__dirname, 'openapi.yaml');
const swaggerSpec = yaml.parse(fs.readFileSync(swaggerFile, 'utf-8'));

// Update servers array with current port
swaggerSpec.servers[0].url = `http://localhost:${PORT}`;

// Setup Swagger UI with the loaded spec
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Mount endpoint routes
app.use(healthRouter);
app.use(submitRouter);
app.use(getRouter);
app.use(deleteRouter);
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
