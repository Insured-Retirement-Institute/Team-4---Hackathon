const express = require('express');
const { deleteSubmission, getSubmission } = require('../lib/carrierSubmissionsDb.js');
const router = express.Router();

router.delete('/applications/:submissionId', async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'Missing submissionId in path'
      });
    }

    // Check if the submission exists
    const submission = await getSubmission(submissionId);
    if (!submission) {
      return res.status(404).json({
        error: 'Submission not found',
        details: `No submission found with submissionId: ${submissionId}`
      });
    }

    // Delete from DynamoDB
    await deleteSubmission(submissionId);

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
