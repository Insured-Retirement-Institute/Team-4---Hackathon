const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { populatePDFWithMapping } = require('./pdfHelper');

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
  apis: ['./index.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(express.json({ limit: '50mb' }));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Check if the API is running
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: PDF Population API is running
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'PDF Population API is running' });
});

/**
 * @swagger
 * /submit:
 *   post:
 *     summary: Submit an application
 *     description: Saves an application submission to local storage. Creates two files - raw submission and metadata. Returns 409 if submission already exists.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - envelope
 *             properties:
 *               envelope:
 *                 type: object
 *                 required:
 *                   - submissionId
 *                 properties:
 *                   submissionId:
 *                     type: string
 *                     description: Unique submission identifier
 *                     example: sub_02k8jy3n5p9r4s8t2u1v
 *     responses:
 *       200:
 *         description: Submission saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 submissionId:
 *                   type: string
 *                 policyNumber:
 *                   type: string
 *                   description: Generated GUID for policy
 *                 received:
 *                   type: string
 *                   format: date-time
 *                   description: ISO timestamp when submission was received
 *       400:
 *         description: Invalid submission format or missing submissionId
 *       409:
 *         description: A submission with this submissionId already exists
 *       500:
 *         description: Failed to save submission
 */
app.post('/submit', (req, res) => {
  try {
    const submission = req.body;

    // Validate that submissionId exists in the envelope
    if (!submission || !submission.envelope || !submission.envelope.submissionId) {
      return res.status(400).json({
        error: 'Invalid submission format',
        details: 'Missing envelope.submissionId'
      });
    }

    const submissionId = submission.envelope.submissionId;
    const policyNumber = randomUUID();
    const receivedTimestamp = new Date().toISOString();
    const appsDir = path.join(__dirname, 'apps');
    
    // Create /apps directory if it doesn't exist
    if (!fs.existsSync(appsDir)) {
      fs.mkdirSync(appsDir, { recursive: true });
    }

    // Check if a submission with this submissionId already exists
    const submissionFilePath = path.join(appsDir, `${submissionId}_SUB.json`);
    if (fs.existsSync(submissionFilePath)) {
      return res.status(409).json({
        error: 'Conflict',
        details: `A submission with submissionId "${submissionId}" already exists`
      });
    }

    // Save the raw submission to a file
    fs.writeFileSync(submissionFilePath, JSON.stringify(submission, null, 2), 'utf-8');

    // Create metadata object
    const metadata = {
      policyNumber: policyNumber,
      submissionId: submissionId,
      received: receivedTimestamp
    };

    // Save the metadata to a file named with the policyNumber GUID
    const metadataFilePath = path.join(appsDir, `${submissionId}_POLICY.json`);
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2), 'utf-8');

    res.json({
      submissionId: submissionId,
      policyNumber: policyNumber,
      received: receivedTimestamp,
    });
  } catch (error) {
    console.error('Error saving submission:', error);
    res.status(500).json({
      error: 'Failed to save submission',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /generate-pdf:
 *   post:
 *     summary: Generate a PDF from application submission
 *     description: Takes an application submission payload, loads the corresponding PDF template from /forms folder using the applicationDefinitionId, fills it with data, and returns the populated PDF along with submission metadata
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - envelope
 *             properties:
 *               envelope:
 *                 type: object
 *                 required:
 *                   - submissionId
 *                   - applicationDefinitionId
 *                 properties:
 *                   submissionId:
 *                     type: string
 *                     description: Unique submission identifier
 *                   applicationDefinitionId:
 *                     type: string
 *                     description: ID used to locate the PDF file in /forms folder (e.g., midland-national-fixed-annuity-v1)
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 submissionId:
 *                   type: string
 *                 policyNumber:
 *                   type: string
 *                   description: Generated GUID for policy
 *                 received:
 *                   type: string
 *                   format: date-time
 *                   description: ISO timestamp when submission was received
 *                 pdfBase64:
 *                   type: string
 *                   description: Base64 encoded populated PDF
 *       400:
 *         description: Invalid submission format or missing required fields
 *       404:
 *         description: PDF template file not found
 *       500:
 *         description: Failed to generate PDF
 */
app.post('/generate-pdf', async (req, res) => {
  try {
    const submission = req.body;

    // Validate required fields
    if (!submission || !submission.envelope || !submission.envelope.submissionId) {
      return res.status(400).json({
        error: 'Invalid submission format',
        details: 'Missing envelope.submissionId'
      });
    }

    if (!submission.envelope.applicationDefinitionId) {
      return res.status(400).json({
        error: 'Invalid submission format',
        details: 'Missing envelope.applicationDefinitionId'
      });
    }

    const submissionId = submission.envelope.submissionId;
    const applicationDefinitionId = submission.envelope.applicationDefinitionId;
    const policyNumber = randomUUID();
    const receivedTimestamp = new Date().toISOString();

    // Build path to PDF template in /forms folder
    const formsDir = path.join(__dirname, 'forms');
    const pdfPath = path.join(formsDir, `${applicationDefinitionId}.pdf`);

    // Check if PDF template exists
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        error: 'PDF template not found',
        details: `No PDF found for applicationDefinitionId: ${applicationDefinitionId}`,
        expectedPath: pdfPath
      });
    }

    // Read the PDF template
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Load the mapping file from /maps folder
    // First try the new naming convention for mapping files
    const mapsDir = path.join(__dirname, 'maps');
    let mappingPath = path.join(mapsDir, `${applicationDefinitionId}.json`);
    
    // If not found, try alternative naming (e.g., app-sample-v2-to-pdf-mapping.json)
    if (!fs.existsSync(mappingPath)) {
      mappingPath = path.join(mapsDir, `${applicationDefinitionId}-mapping.json`);
    }

    if (!fs.existsSync(mappingPath)) {
      // List available mapping files for debugging
      let availableMappings = [];
      try {
        availableMappings = fs.readdirSync(mapsDir).filter(f => f.endsWith('.json'));
      } catch (e) {
        // maps dir might not exist
      }
      
      return res.status(404).json({
        error: 'Mapping file not found',
        details: `No mapping found for applicationDefinitionId: ${applicationDefinitionId}`,
        expectedPath: mappingPath,
        availableMappings: availableMappings
      });
    }

    const mappingFile = fs.readFileSync(mappingPath, 'utf-8');
    const mapping = JSON.parse(mappingFile);

    // Populate the PDF using the mapping file
    const populatedPdfBuffer = await populatePDFWithMapping(pdfBuffer, submission, mapping);

    // Save the PDF to /pdfs folder
    const pdfsDir = path.join(__dirname, 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }
    const pdfFilePath = path.join(pdfsDir, `${submissionId}.pdf`);
    fs.writeFileSync(pdfFilePath, populatedPdfBuffer);

    // Convert to base64
    const pdfBase64 = populatedPdfBuffer.toString('base64');

    res.json({
      submissionId: submissionId,
      policyNumber: policyNumber,
      received: receivedTimestamp,
      pdfBase64: pdfBase64
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: error.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    availableEndpoints: [
      'GET /health',
      'POST /submit (save application submission)',
      'GET /submit/:submissionId (retrieve saved submission)',
      'POST /generate-pdf (fill PDF template and return with metadata)',
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
  console.log(`  POST /generate-pdf`);
  console.log(`\nAPI Documentation:`);
  console.log(`  GET  /api-docs (Swagger UI)`);
});
