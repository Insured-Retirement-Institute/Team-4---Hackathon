const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../services/productService');
const { addProduct } = require('../services/productStore');
const { getDistributorById } = require('../services/distributorService');

// GET /products
router.get('/', async (req, res) => {
  try {
    const products = await getAllProducts();
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

// GET /products/:productId
router.get('/:productId', async (req, res) => {
  try {
    const product = await getProductById(req.params.productId);
    if (!product) {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No product found with productId '${req.params.productId}'.`,
        details: null,
      });
    }
    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

// POST /products
router.post('/', async (req, res) => {
  try {
    const { carrier, productName, productId } = req.body;
    const missing = [];
    if (!carrier) missing.push('carrier');
    if (!productName) missing.push('productName');
    if (!productId) missing.push('productId');

    if (missing.length > 0) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `Missing required fields: ${missing.join(', ')}.`,
        details: null,
      });
    }

    if (Array.isArray(req.body.distributors) && req.body.distributors.length > 0) {
      const invalidIds = [];
      for (const distId of req.body.distributors) {
        const dist = await getDistributorById(distId);
        if (!dist) invalidIds.push(distId);
      }
      if (invalidIds.length > 0) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: `Invalid distributor IDs: ${invalidIds.join(', ')}.`,
          details: { invalidDistributorIds: invalidIds },
        });
      }
    }

    const product = await createProduct(req.body);
    addProduct(product);
    res.status(201).json(product);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(409).json({
        code: 'DUPLICATE_PRODUCT_ID',
        message: `A product with productId '${req.body.productId}' already exists.`,
        details: null,
      });
    }
    console.error('Error creating product:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

// PUT /products/:productId
router.put('/:productId', async (req, res) => {
  try {
    if (Array.isArray(req.body.distributors) && req.body.distributors.length > 0) {
      const invalidIds = [];
      for (const distId of req.body.distributors) {
        const dist = await getDistributorById(distId);
        if (!dist) invalidIds.push(distId);
      }
      if (invalidIds.length > 0) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: `Invalid distributor IDs: ${invalidIds.join(', ')}.`,
          details: { invalidDistributorIds: invalidIds },
        });
      }
    }

    const product = await updateProduct(req.params.productId, req.body);
    addProduct(product);
    res.json(product);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No product found with productId '${req.params.productId}'.`,
        details: null,
      });
    }
    console.error('Error updating product:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

// DELETE /products/:productId
router.delete('/:productId', async (req, res) => {
  try {
    await deleteProduct(req.params.productId);
    res.status(204).send();
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No product found with productId '${req.params.productId}'.`,
        details: null,
      });
    }
    console.error('Error deleting product:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

module.exports = router;
