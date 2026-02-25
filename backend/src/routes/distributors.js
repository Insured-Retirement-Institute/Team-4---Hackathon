const express = require('express');
const router = express.Router();
const {
  getAllDistributors,
  getDistributorById,
  createDistributor,
  updateDistributor,
  deleteDistributor,
} = require('../services/distributorService');

// GET /distributors
router.get('/', async (req, res) => {
  try {
    const distributors = await getAllDistributors();
    res.json(distributors);
  } catch (err) {
    console.error('Error fetching distributors:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

// GET /distributors/:distributorId
router.get('/:distributorId', async (req, res) => {
  try {
    const distributor = await getDistributorById(req.params.distributorId);
    if (!distributor) {
      return res.status(404).json({
        code: 'DISTRIBUTOR_NOT_FOUND',
        message: `No distributor found with distributorId '${req.params.distributorId}'.`,
        details: null,
      });
    }
    res.json(distributor);
  } catch (err) {
    console.error('Error fetching distributor:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

// POST /distributors
router.post('/', async (req, res) => {
  try {
    const { distributorId, name } = req.body;
    const missing = [];
    if (!distributorId) missing.push('distributorId');
    if (!name) missing.push('name');

    if (missing.length > 0) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `Missing required fields: ${missing.join(', ')}.`,
        details: null,
      });
    }

    const distributor = await createDistributor(req.body);
    res.status(201).json(distributor);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(409).json({
        code: 'DUPLICATE_DISTRIBUTOR_ID',
        message: `A distributor with distributorId '${req.body.distributorId}' already exists.`,
        details: null,
      });
    }
    console.error('Error creating distributor:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

// PUT /distributors/:distributorId
router.put('/:distributorId', async (req, res) => {
  try {
    const distributor = await updateDistributor(req.params.distributorId, req.body);
    res.json(distributor);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(404).json({
        code: 'DISTRIBUTOR_NOT_FOUND',
        message: `No distributor found with distributorId '${req.params.distributorId}'.`,
        details: null,
      });
    }
    console.error('Error updating distributor:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

// DELETE /distributors/:distributorId
router.delete('/:distributorId', async (req, res) => {
  try {
    await deleteDistributor(req.params.distributorId);
    res.status(204).send();
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return res.status(404).json({
        code: 'DISTRIBUTOR_NOT_FOUND',
        message: `No distributor found with distributorId '${req.params.distributorId}'.`,
        details: null,
      });
    }
    console.error('Error deleting distributor:', err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      details: null,
    });
  }
});

module.exports = router;
