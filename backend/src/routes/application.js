const express = require('express');
const router = express.Router();
const { startEmbeddedSigning } = require('../services/docusignService');

// POST /application/:applicationId/docusign/start
// Manual test:
// curl -X POST http://localhost:8080/application/test-app-123/docusign/start \
//   -H "Content-Type: application/json" \
//   -d '{"signerEmail":"you@example.com","signerName":"Test Signer"}'
router.post('/:applicationId/docusign/start', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { signerEmail, signerName } = req.body || {};

    const normalizedEmail = typeof signerEmail === 'string' ? signerEmail.trim() : '';
    const normalizedName = typeof signerName === 'string' ? signerName.trim() : '';

    if (!applicationId || !normalizedEmail || !normalizedName || !normalizedEmail.includes('@')) {
      return res
        .status(400)
        .json({ error: 'signerEmail and signerName are required.' });
    }

    const result = await startEmbeddedSigning({
      applicationId,
      signerEmail: normalizedEmail,
      signerName: normalizedName
    });

    console.info('DocuSign start success:', {
      applicationId,
      envelopeId: result?.envelopeId
    });

    res.status(200).json(result);
  } catch (err) {
    console.error('DocuSign start error:', err);
    res.status(500).json({ error: 'Failed to start signing process' });
  }
});

module.exports = router;
