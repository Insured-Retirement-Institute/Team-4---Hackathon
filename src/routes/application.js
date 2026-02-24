const express = require('express');
const router = express.Router();
const { getProduct } = require('../services/productStore');

// GET /application/:productId
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const locale = req.query.locale || 'en-US';
    const product = await getProduct(productId);

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

module.exports = router;
