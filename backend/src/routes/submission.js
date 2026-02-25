const express = require('express');
const router = express.Router();
const { getProduct } = require('../services/productStore');
const { validate } = require('../services/validationEngine');
const { getApplicationById, updateApplicationStatus } = require('../services/applicationService');
const { createSubmission } = require('../services/submissionService');
const { transformSubmission } = require('../services/submissionTransformer');
const { validateSubmission } = require('../services/submissionValidator');

// POST /application/:applicationId/submit
router.post('/:applicationId/submit', async (req, res) => {
  try {
    const { productId, answers: bodyAnswers, metadata: bodyMetadata } = req.body || {};

    if (!productId || !bodyAnswers) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Both productId and answers are required in the request body.',
        details: null
      });
    }

    const metadata = bodyMetadata || {};

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

    const product = await getProduct(productId);
    if (!product) {
      return res.status(404).json({
        code: 'PRODUCT_NOT_FOUND',
        message: `No application definition found for product ID '${productId}'.`,
        details: null
      });
    }

    const mergedAnswers = { ...application.answers, ...bodyAnswers };

    // Server-stamp signature dates with current UTC date.
    // Prevents timezone-mismatch rejections (e.g. user signs at 11pm CST
    // but server UTC date has rolled to the next day).
    const serverDate = new Date().toISOString().split('T')[0];
    mergedAnswers.date_signed = serverDate;
    if (Array.isArray(mergedAnswers.writing_agents)) {
      mergedAnswers.writing_agents = mergedAnswers.writing_agents.map(agent => ({
        ...agent,
        agent_date_signed: serverDate,
      }));
    }

    // 1. Run full answer validation
    const validationResult = validate(product, mergedAnswers, 'full', null);

    if (!validationResult.valid) {
      return res.status(422).json(validationResult);
    }

    // 2. Transform answers into canonical payload
    const now = new Date();
    const payload = transformSubmission(product, mergedAnswers, {
      applicationId: application.id,
      submittedAt: now.toISOString(),
      submittingProducerNpn: metadata.agentId || null,
      ipAddress: metadata.ipAddress || req.ip || null,
      userAgent: metadata.userAgent || req.get('User-Agent') || null,
      submissionSource: metadata.submissionSource || 'web',
    });

    // 3. Run submission-level business validation
    const submissionValidation = validateSubmission(payload);

    if (!submissionValidation.valid) {
      return res.status(422).json({
        valid: false,
        errors: submissionValidation.errors,
      });
    }

    // Generate confirmation number
    const seq = String(Date.now() % 100000000).padStart(8, '0');
    const confirmationNumber = `ANN-${now.getFullYear()}-${seq}`;

    // 4. Persist submission with canonical payload + raw answers
    const submission = await createSubmission({
      applicationId: application.id,
      productId: application.productId,
      payload,
      rawAnswers: mergedAnswers,
      confirmationNumber,
      metadata,
    });

    // Mark application as submitted
    await updateApplicationStatus(application.id, 'submitted');

    // 5. Return confirmation response
    res.json({
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
