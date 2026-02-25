const express = require('express');
const { getSubmission, listSubmissions } = require('../lib/carrierSubmissionsDb.js');
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

// GET /submissions - list submissions (paginated)
router.get('/submissions', async (req, res) => {
  try {
    // Optional query params: limit, startKey (base64-encoded JSON)
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    let exclusiveStartKey;
    if (req.query.startKey) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(req.query.startKey, 'base64').toString('utf8'));
      } catch (e) {
        return res.status(400).json({ error: 'Invalid startKey' });
      }
    }

    const result = await listSubmissions({ limit, exclusiveStartKey });

    // Map metadata only to keep payload small
    const items = (result.items || []).map(i => ({
      submissionId: i.submissionId,
      applicationId: i.applicationId,
      policyNumber: i.policyNumber,
      received: i.received
    }));

    // Encode lastEvaluatedKey as base64 JSON for client to pass back
    let nextToken = null;
    if (result.lastEvaluatedKey) {
      nextToken = Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64');
    }

    res.json({ items, nextToken });
  } catch (error) {
    console.error('Error listing submissions:', error);
    res.status(500).json({ error: 'Failed to list submissions', details: error.message });
  }
});

module.exports = router;