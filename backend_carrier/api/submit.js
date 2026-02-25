const express = require('express');
const { randomUUID } = require('crypto');
const { saveSubmission } = require('../lib/carrierSubmissionsDb.js');
const router = express.Router();

router.post('/applications/submit', async (req, res) => {
  try {
    const submission = req.body;

    // Validate that applicationId exists in the envelope
    if (!submission || !submission.envelope || !submission.envelope.applicationId) {
      return res.status(400).json({
        error: 'Invalid submission format',
        details: 'Missing envelope.applicationId'
      });
    }

    const applicationId = submission.envelope.applicationId;
    const submissionId = randomUUID();
    const policyNumber = randomUUID();
    const receivedTimestamp = new Date().toISOString();

    // Save to DynamoDB
    try {
      // Create the DynamoDB item with metadata and submission data
      const ddbItem = {
        submissionId: submissionId,
        applicationId: applicationId,
        policyNumber: policyNumber,
        received: receivedTimestamp,
        submission: submission,
        createdAt: new Date().getTime()
      };
      
      await saveSubmission(ddbItem);
    } catch (ddbError) {
      console.error('Error saving submission to DynamoDB:', ddbError);
      return res.status(500).json({
        error: 'Failed to save submission',
        details: ddbError.message
      });
    }

    res.json({
      submissionId: submissionId,
      applicationId: applicationId,
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

module.exports = router;
