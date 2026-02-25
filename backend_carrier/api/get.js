const express = require('express');
const { getSubmission } = require('../lib/carrierSubmissionsDb.js');
const router = express.Router();

router.get('/applications/:submissionId', async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'Missing submissionId in path'
      });
    }

    // Load submission from DynamoDB
    const ddbItem = await getSubmission(submissionId);
    
    if (!ddbItem) {
      return res.status(404).json({
        error: 'Submission not found',
        details: `No submission found with submissionId: ${submissionId}`
      });
    }

    // Extract metadata from DynamoDB item
    const metadata = {
      submissionId: ddbItem.submissionId,
      applicationId: ddbItem.applicationId,
      policyNumber: ddbItem.policyNumber,
      received: ddbItem.received
    };

    res.json({
      submission: metadata,
      data: ddbItem.submission
    });
  } catch (error) {
    console.error('Error retrieving submission:', error);
    res.status(500).json({
      error: 'Failed to retrieve submission',
      details: error.message
    });
  }
});

module.exports = router;
