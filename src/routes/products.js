const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../services/productService');

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

// GET /products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No product found with id '${req.params.id}'.`,
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

    const product = await createProduct(req.body);
    res.status(201).json(product);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

// PUT /products/:id
router.put('/:id', async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No product found with id '${req.params.id}'.`,
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

// DELETE /products/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteProduct(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No product found with id '${req.params.id}'.`,
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
