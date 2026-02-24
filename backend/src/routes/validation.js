const express = require('express');
const router = express.Router();
const { getProduct } = require('../services/productStore');
const { validate } = require('../services/validationEngine');

// POST /application/:applicationId/validate
router.post('/:applicationId/validate', (req, res) => {
  try {
    const { productId, answers } = req.body || {};

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

    const scope = req.query.scope || 'full';
    const pageId = req.query.pageId || null;

    if (scope === 'page' && !pageId) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'pageId query parameter is required when scope is "page".',
        details: null
      });
    }

    const result = validate(product, answers, scope, pageId);
    res.json(result);
  } catch (err) {
    console.error('Validation error:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null
    });
  }
});

module.exports = router;
