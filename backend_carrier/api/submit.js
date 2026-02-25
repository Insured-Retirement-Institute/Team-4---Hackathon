const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const router = express.Router();

router.post('/applications/submit', (req, res) => {
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
    const appsDir = path.join(__dirname, '..', 'apps');
    
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
      submissionId: submissionId,
      applicationId: applicationId,
      policyNumber: policyNumber,
      received: receivedTimestamp
    };

    // Save the metadata to a file named with the submissionId
    const metadataFilePath = path.join(appsDir, `${submissionId}_POLICY.json`);
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2), 'utf-8');

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
