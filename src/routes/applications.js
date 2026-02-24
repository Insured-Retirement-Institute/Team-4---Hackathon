const express = require('express');
const router = express.Router();
const { getProduct } = require('../services/productStore');
const {
  createApplication,
  getApplicationById,
  updateApplicationAnswers,
} = require('../services/applicationService');

// POST /applications
router.post('/', async (req, res) => {
  try {
    const { productId } = req.body || {};

    if (!productId) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Request body must include productId.',
        details: null
      });
    }

    const product = await getProduct(productId);
    if (!product) {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No application definition found for product ID '${productId}'.`,
        details: null
      });
    }

    const application = await createApplication(productId);
    res.status(201).json(application);
  } catch (err) {
    console.error('Error creating application:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null
    });
  }
});

// GET /applications/:id
router.get('/:id', async (req, res) => {
  try {
    const application = await getApplicationById(req.params.id);

    if (!application) {
      return res.status(404).json({
        code: 'APPLICATION_NOT_FOUND',
        message: `Application '${req.params.id}' not found.`,
        details: null
      });
    }

    res.json(application);
  } catch (err) {
    console.error('Error fetching application:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null
    });
  }
});

// PUT /applications/:id/answers
router.put('/:id/answers', async (req, res) => {
  try {
    const application = await getApplicationById(req.params.id);

    if (!application) {
      return res.status(404).json({
        code: 'APPLICATION_NOT_FOUND',
        message: `Application '${req.params.id}' not found.`,
        details: null
      });
    }

    if (application.status === 'submitted') {
      return res.status(409).json({
        code: 'APPLICATION_ALREADY_SUBMITTED',
        message: 'Cannot update answers on a submitted application.',
        details: null
      });
    }

    const { answers } = req.body || {};

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Request body must include answers.',
        details: null
      });
    }

    const mergedAnswers = { ...application.answers, ...answers };
    const updated = await updateApplicationAnswers(req.params.id, mergedAnswers);

    res.json(updated);
  } catch (err) {
    console.error('Error updating application answers:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null
    });
  }
});

module.exports = router;
