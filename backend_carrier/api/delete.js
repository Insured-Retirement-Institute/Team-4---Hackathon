const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.delete('/applications/:submissionId', (req, res) => {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'Missing submissionId in path'
      });
    }

    const appsDir = path.join(__dirname, '..', 'apps');

    // Check if the submission exists
    const submissionFilePath = path.join(appsDir, `${submissionId}_SUB.json`);
    const policyFilePath = path.join(appsDir, `${submissionId}_POLICY.json`);

    if (!fs.existsSync(submissionFilePath) && !fs.existsSync(policyFilePath)) {
      return res.status(404).json({
        error: 'Submission not found',
        details: `No submission found with submissionId: ${submissionId}`
      });
    }

    // Delete the submission file if it exists
    if (fs.existsSync(submissionFilePath)) {
      fs.unlinkSync(submissionFilePath);
    }

    // Delete the policy file if it exists
    if (fs.existsSync(policyFilePath)) {
      fs.unlinkSync(policyFilePath);
    }

    res.json({
      message: 'Submission deleted successfully',
      submissionId: submissionId
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({
      error: 'Failed to delete submission',
      details: error.message
    });
  }
});

module.exports = router;
