const express = require('express');
const fs = require('fs');
const path = require('path');
const { populatePDFWithMapping } = require('../lib/pdfHelper');
const router = express.Router();

/**
 * @swagger
 * /generate-pdf/{submissionId}:
 *   post:
 *     summary: Generate a PDF from a saved application submission
 *     description: Loads the received application submission data using the submissionId, loads the corresponding PDF template, fills it with data, and returns the populated PDF binary stream
 *     parameters:
 *       - name: submissionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The submission ID to load
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Submission file or PDF template file not found
 *       500:
 *         description: Failed to generate PDF
 */
router.post('/generate-pdf/:submissionId', async (req, res) => {
  try {
    const submissionId = req.params.submissionId;

    // Validate required fields
    if (!submissionId) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'Missing submissionId in path'
      });
    }

    // Load the submission data from /apps folder
    const appsDir = path.join(__dirname, '..', 'apps');
    const submissionFilePath = path.join(appsDir, `${submissionId}_SUB.json`);

    if (!fs.existsSync(submissionFilePath)) {
      return res.status(404).json({
        error: 'Submission not found',
        details: `No submission found with submissionId: ${submissionId}`,
        expectedPath: submissionFilePath
      });
    }

    const submissionFile = fs.readFileSync(submissionFilePath, 'utf-8');
    const submission = JSON.parse(submissionFile);

    // Extract applicationDefinitionId from the submission envelope
    if (!submission || !submission.envelope || !submission.envelope.applicationDefinitionId) {
      return res.status(400).json({
        error: 'Invalid submission data',
        details: 'Submission does not contain envelope.applicationDefinitionId'
      });
    }

    const applicationDefinitionId = submission.envelope.applicationDefinitionId;

    // Build path to PDF template in /forms folder
    const formsDir = path.join(__dirname, '..', 'forms');
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
    const mapsDir = path.join(__dirname, '..', 'maps');
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
    const pdfsDir = path.join(__dirname, '..', 'pdfs');
    if (!fs.existsSync(pdfsDir)) {
      fs.mkdirSync(pdfsDir, { recursive: true });
    }
    const pdfFilePath = path.join(pdfsDir, `${submissionId}.pdf`);
    fs.writeFileSync(pdfFilePath, populatedPdfBuffer);

    // Convert to base64
    const pdfBase64 = populatedPdfBuffer.toString('base64');

    res.contentType('application/pdf');
    res.send(populatedPdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: error.message
    });
  }
});

module.exports = router;
