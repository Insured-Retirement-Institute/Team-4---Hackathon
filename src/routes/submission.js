const express = require('express');
const router = express.Router();
const { getProduct } = require('../services/productStore');
const { validate } = require('../services/validationEngine');

// POST /application/:applicationId/submit
router.post('/:applicationId/submit', (req, res) => {
  try {
    const { productId, answers, metadata } = req.body || {};

    if (!productId || !answers) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Request body must include productId and answers.',
        details: null
      });
    }

    const product = getProduct(productId);
    if (!product) {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No application definition found for product ID '${productId}'.`,
        details: null
      });
    }

    // Run full validation
    const validationResult = validate(product, answers, 'full', null);

    if (!validationResult.valid) {
      return res.status(422).json(validationResult);
    }

    // Generate confirmation
    const seq = String(Date.now() % 100000000).padStart(8, '0');
    const confirmationNumber = `ANN-${new Date().getFullYear()}-${seq}`;

    res.json({
      confirmationNumber,
      status: 'received',
      submittedAt: new Date().toISOString(),
      message: 'Your application has been received and is pending review. You will be contacted within 2 business days.'
    });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null
    });
  }
});

module.exports = router;
