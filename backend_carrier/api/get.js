const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/applications/:submissionId', (req, res) => {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'Missing submissionId in path'
      });
    }

    const appsDir = path.join(__dirname, '..', 'apps');

    // Load metadata file directly using submissionId
    const metadataPath = path.join(appsDir, `${submissionId}_POLICY.json`);
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({
        error: 'Submission not found',
        details: `No submission found with submissionId: ${submissionId}`
      });
    }

    const metadataFile = fs.readFileSync(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataFile);

    // Load the submission data
    const submissionFilePath = path.join(appsDir, `${submissionId}_SUB.json`);
    if (!fs.existsSync(submissionFilePath)) {
      return res.status(404).json({
        error: 'Submission data not found',
        details: `Submission file not found for submissionId: ${submissionId}`
      });
    }

    const submissionFile = fs.readFileSync(submissionFilePath, 'utf-8');
    const submission = JSON.parse(submissionFile);

    res.json({
      submission: metadata,
      data: submission
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
