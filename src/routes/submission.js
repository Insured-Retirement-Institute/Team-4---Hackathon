const express = require('express');
const router = express.Router();
const { getProduct } = require('../services/productStore');
const { validate } = require('../services/validationEngine');
const { getApplicationById, updateApplicationStatus } = require('../services/applicationService');
const { createSubmission } = require('../services/submissionService');

// POST /application/:applicationId/submit
router.post('/:applicationId/submit', async (req, res) => {
  try {
    const application = await getApplicationById(req.params.applicationId);

    if (!application) {
      return res.status(404).json({
        code: 'APPLICATION_NOT_FOUND',
        message: `Application '${req.params.applicationId}' not found.`,
        details: null
      });
    }

    if (application.status === 'submitted') {
      return res.status(409).json({
        code: 'APPLICATION_ALREADY_SUBMITTED',
        message: 'This application has already been submitted.',
        details: null
      });
    }

    const product = getProduct(application.productId);
    if (!product) {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No application definition found for product ID '${application.productId}'.`,
        details: null
      });
    }

    const bodyAnswers = (req.body && req.body.answers) || {};
    const metadata = (req.body && req.body.metadata) || {};
    const mergedAnswers = { ...application.answers, ...bodyAnswers };

    // Run full validation
    const validationResult = validate(product, mergedAnswers, 'full', null);

    if (!validationResult.valid) {
      return res.status(422).json(validationResult);
    }

    // Generate confirmation number
    const seq = String(Date.now() % 100000000).padStart(8, '0');
    const confirmationNumber = `ANN-${new Date().getFullYear()}-${seq}`;

    // Persist submission
    const submission = await createSubmission({
      applicationId: application.id,
      productId: application.productId,
      answers: mergedAnswers,
      confirmationNumber,
      metadata,
    });

    // Mark application as submitted
    await updateApplicationStatus(application.id, 'submitted');

    res.json({
      id: submission.id,
      confirmationNumber: submission.confirmationNumber,
      status: submission.status,
      submittedAt: submission.submittedAt,
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
