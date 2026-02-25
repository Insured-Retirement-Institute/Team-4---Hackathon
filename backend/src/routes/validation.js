const express = require('express');
const router = express.Router();
const { getProduct } = require('../services/productStore');
const { validate } = require('../services/validationEngine');
const { getApplicationById, updateApplicationAnswers, updateApplicationSuitabilityDecision } = require('../services/applicationService');
const { transformSubmission } = require('../services/submissionTransformer');
const { evaluateSuitability } = require('../services/suitabilityService');

// POST /application/:applicationId/validate
router.post('/:applicationId/validate', async (req, res) => {
  try {
    const { productId, answers: bodyAnswers } = req.body || {};

    if (!productId || !bodyAnswers) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Both productId and answers are required in the request body.',
        details: null
      });
    }

    const application = await getApplicationById(req.params.applicationId);

    if (!application) {
      return res.status(404).json({
        code: 'APPLICATION_NOT_FOUND',
        message: `Application '${req.params.applicationId}' not found.`,
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

    const mergedAnswers = { ...application.answers, ...bodyAnswers };

    // Persist merged answers back if body included new answers
    if (Object.keys(bodyAnswers).length > 0) {
      await updateApplicationAnswers(req.params.applicationId, mergedAnswers);
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

    const result = validate(product, mergedAnswers, scope, pageId);

    if (scope === 'full') {
      const applicationId = req.params.applicationId;
      const payload = transformSubmission(product, mergedAnswers, { applicationId });
      const suitabilityDecision = await evaluateSuitability(payload, product);

      await updateApplicationSuitabilityDecision(applicationId, suitabilityDecision);

      if (suitabilityDecision.valid === false) {
        result.valid = false;
      }
      if (Array.isArray(suitabilityDecision.errors) && suitabilityDecision.errors.length > 0) {
        result.errors = result.errors.concat(suitabilityDecision.errors);
      }

      return res.json({ ...result, suitabilityDecision });
    }

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
