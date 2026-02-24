const express = require('express');
const router = express.Router();
const { getProduct } = require('../services/productStore');
const { startEmbeddedSigning } = require('../services/docusignService');

// GET /application/:productId
router.get('/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    const product = getProduct(productId);

    if (!product) {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No application definition found for product ID '${productId}'.`,
        details: null
      });
    }

    res.json(product);
  } catch (err) {
    console.error('Error fetching application definition:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null
    });
  }
});

// POST /application/:applicationId/docusign/start
router.post('/:applicationId/docusign/start', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { signerEmail, signerName } = req.body || {};

    const normalizedEmail = typeof signerEmail === 'string' ? signerEmail.trim() : '';
    const normalizedName = typeof signerName === 'string' ? signerName.trim() : '';

    if (!applicationId || !normalizedEmail || !normalizedName || !normalizedEmail.includes('@')) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Request body must include valid signerEmail and signerName.',
        details: null
      });
    }

    const result = await startEmbeddedSigning({
      applicationId,
      signerEmail: normalizedEmail,
      signerName: normalizedName
    });

    res.json(result);
  } catch (err) {
    const errorDetails = err?.response?.data || err?.response?.body || err;
    console.error('DocuSign start error:', errorDetails);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null
    });
  }
});

module.exports = router;
