const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const router = express.Router();

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
router.post('/submit', (req, res) => {
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

module.exports = router;
