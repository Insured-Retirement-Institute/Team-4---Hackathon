const express = require('express');
const fs = require('fs');
const path = require('path');
const { populatePDFWithMapping } = require('../lib/pdfHelper');
const { getSubmission } = require('../lib/carrierSubmissionsDb.js');
const router = express.Router();

router.get('/applications/:submissionId/pdf', async (req, res) => {
  try {
    const submissionId = req.params.submissionId;

    // Validate required fields
    if (!submissionId) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'Missing submissionId in path'
      });
    }

    // Load the submission data from DynamoDB
    const ddbItem = await getSubmission(submissionId);

    if (!ddbItem) {
      return res.status(404).json({
        error: 'Submission not found',
        details: `No submission found with submissionId: ${submissionId}`
      });
    }

    const submission = ddbItem.submission;

    // We only have one form pdf mapped, so just hard code for now (this would normally come from the submission)
    const applicationDefinitionId = "midland-national-fixed-annuity-v1";

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
