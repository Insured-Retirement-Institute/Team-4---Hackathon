/**
 * Validates a canonical ApplicationSubmission payload against business rules.
 * @param {object} submission - The canonical ApplicationSubmission
 * @returns {{ valid: boolean, errors: Array<{ field: string, rule: string, message: string }> }}
 */
function validateSubmission(submission) {
  const errors = [];

  validateBeneficiaryPercentages(submission.ownerBeneficiaries, 'ownerBeneficiaries', errors);
  validateBeneficiaryPercentages(submission.annuitantBeneficiaries, 'annuitantBeneficiaries', errors);
  validateAllocationPercentages(submission.investmentAllocations, errors);
  validateWritingAgentCommissions(submission.producerCertification, errors);
  validateTransferCount(submission.transfers, submission.funding, errors);
  validateEncryptedValues(submission, errors);
  validateSignatureDates(submission, errors);

  return { valid: errors.length === 0, errors };
}

function validateBeneficiaryPercentages(beneficiaries, fieldPrefix, errors) {
  if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) return;

  const primary = beneficiaries.filter(b => b.type === 'primary');
  const contingent = beneficiaries.filter(b => b.type === 'contingent');

  if (primary.length > 0) {
    const primarySum = primary.reduce((sum, b) => sum + (b.percentage || 0), 0);
    if (primarySum !== 100) {
      errors.push({
        field: fieldPrefix,
        rule: 'beneficiary_percentage_sum',
        message: `Primary beneficiary percentages must sum to 100 (current: ${primarySum})`,
      });
    }
  }

  if (contingent.length > 0) {
    const contingentSum = contingent.reduce((sum, b) => sum + (b.percentage || 0), 0);
    if (contingentSum !== 100) {
      errors.push({
        field: fieldPrefix,
        rule: 'beneficiary_percentage_sum',
        message: `Contingent beneficiary percentages must sum to 100 (current: ${contingentSum})`,
      });
    }
  }
}

function validateAllocationPercentages(allocations, errors) {
  if (!Array.isArray(allocations) || allocations.length === 0) return;

  const sum = allocations.reduce((s, a) => s + (a.percentage || 0), 0);
  if (sum !== 100) {
    errors.push({
      field: 'investmentAllocations',
      rule: 'allocation_percentage_sum',
      message: `Investment allocation percentages must sum to 100 (current: ${sum})`,
    });
  }
}

function validateWritingAgentCommissions(producerCert, errors) {
  if (!producerCert || !Array.isArray(producerCert.producers) || producerCert.producers.length === 0) return;

  const sum = producerCert.producers.reduce((s, a) => s + (a.commissionPercentage || 0), 0);
  if (sum !== 100) {
    errors.push({
      field: 'producerCertification.producers',
      rule: 'commission_percentage_sum',
      message: `Writing agent commission percentages must sum to 100 (current: ${sum})`,
    });
  }
}

function validateTransferCount(transfers, funding, errors) {
  if (!funding || !Array.isArray(funding.methods)) return;

  const transferMethods = funding.methods.filter(
    m => m.type === 'exchange_1035' || m.type === 'direct_transfer'
  );
  const expectedCount = transferMethods.length;
  const actualCount = Array.isArray(transfers) ? transfers.length : 0;

  if (actualCount !== expectedCount) {
    errors.push({
      field: 'transfers',
      rule: 'transfer_count_consistency',
      message: `Expected ${expectedCount} transfer(s) based on funding methods, but found ${actualCount}`,
    });
  }
}

function validateEncryptedValues(submission, errors) {
  const paths = [];

  // Annuitant taxId
  checkEncrypted(submission.annuitant?.taxId, 'annuitant.taxId', paths);

  // Joint annuitant taxId
  if (submission.jointAnnuitant) {
    checkEncrypted(submission.jointAnnuitant.taxId, 'jointAnnuitant.taxId', paths);
  }

  // Owner taxId
  if (submission.owner && !submission.owner.isSameAsAnnuitant) {
    if (submission.owner.type === 'individual' && submission.owner.person) {
      checkEncrypted(submission.owner.person.taxId, 'owner.person.taxId', paths);
    } else if (submission.owner.type === 'entity' && submission.owner.entity) {
      checkEncrypted(submission.owner.entity.taxId, 'owner.entity.taxId', paths);
    }
  }

  // Joint owner taxId
  if (submission.jointOwner) {
    checkEncrypted(submission.jointOwner.taxId, 'jointOwner.taxId', paths);
  }

  // Beneficiary taxIds
  for (const group of ['ownerBeneficiaries', 'annuitantBeneficiaries']) {
    if (Array.isArray(submission[group])) {
      submission[group].forEach((b, i) => {
        if (b.taxId) checkEncrypted(b.taxId, `${group}[${i}].taxId`, paths);
      });
    }
  }

  // Transfer party taxIds
  if (Array.isArray(submission.transfers)) {
    submission.transfers.forEach((t, i) => {
      const sp = t.surrenderingParties;
      if (sp) {
        checkEncrypted(sp.ownerTaxId, `transfers[${i}].surrenderingParties.ownerTaxId`, paths);
        if (sp.jointOwnerTaxId) checkEncrypted(sp.jointOwnerTaxId, `transfers[${i}].surrenderingParties.jointOwnerTaxId`, paths);
        if (sp.annuitantTaxId) checkEncrypted(sp.annuitantTaxId, `transfers[${i}].surrenderingParties.annuitantTaxId`, paths);
        if (sp.jointAnnuitantTaxId) checkEncrypted(sp.jointAnnuitantTaxId, `transfers[${i}].surrenderingParties.jointAnnuitantTaxId`, paths);
        if (sp.contingentAnnuitantTaxId) checkEncrypted(sp.contingentAnnuitantTaxId, `transfers[${i}].surrenderingParties.contingentAnnuitantTaxId`, paths);
      }
    });
  }

  for (const path of paths) {
    errors.push({
      field: path,
      rule: 'ssn_encrypted',
      message: `EncryptedValue at ${path} must have isEncrypted: true`,
    });
  }
}

function checkEncrypted(val, path, failures) {
  if (val && typeof val === 'object' && val.isEncrypted !== true) {
    failures.push(path);
  }
}

function validateSignatureDates(submission, errors) {
  const submittedAt = submission.envelope?.submittedAt;
  if (!submittedAt) return;

  const submissionDate = submittedAt.split('T')[0];

  // Owner signature date
  const ownerSigDate = submission.applicationSignatures?.ownerSignatureDate;
  if (ownerSigDate && ownerSigDate !== submissionDate) {
    errors.push({
      field: 'applicationSignatures.ownerSignatureDate',
      rule: 'signature_date_equals_submission',
      message: `Owner signature date (${ownerSigDate}) must equal submission date (${submissionDate})`,
    });
  }

  // Producer signature dates
  if (submission.producerCertification?.producers) {
    submission.producerCertification.producers.forEach((producer, i) => {
      if (producer.signatureDate && producer.signatureDate !== submissionDate) {
        errors.push({
          field: `producerCertification.producers[${i}].signatureDate`,
          rule: 'signature_date_equals_submission',
          message: `Producer signature date (${producer.signatureDate}) must equal submission date (${submissionDate})`,
        });
      }
    });
  }

  // Transfer signature dates
  if (Array.isArray(submission.transfers)) {
    submission.transfers.forEach((t, i) => {
      const sigs = t.signatures;
      if (!sigs) return;

      if (sigs.ownerSignatureDate && sigs.ownerSignatureDate !== submissionDate) {
        errors.push({
          field: `transfers[${i}].signatures.ownerSignatureDate`,
          rule: 'signature_date_equals_submission',
          message: `Transfer owner signature date (${sigs.ownerSignatureDate}) must equal submission date (${submissionDate})`,
        });
      }
      if (sigs.jointOwnerSignatureDate && sigs.jointOwnerSignatureDate !== submissionDate) {
        errors.push({
          field: `transfers[${i}].signatures.jointOwnerSignatureDate`,
          rule: 'signature_date_equals_submission',
          message: `Transfer joint owner signature date must equal submission date`,
        });
      }
      if (sigs.spouseSignatureDate && sigs.spouseSignatureDate !== submissionDate) {
        errors.push({
          field: `transfers[${i}].signatures.spouseSignatureDate`,
          rule: 'signature_date_equals_submission',
          message: `Transfer spouse signature date must equal submission date`,
        });
      }
      if (sigs.tsaEmployer && sigs.tsaEmployer.signatureDate && sigs.tsaEmployer.signatureDate !== submissionDate) {
        errors.push({
          field: `transfers[${i}].signatures.tsaEmployer.signatureDate`,
          rule: 'signature_date_equals_submission',
          message: `TSA employer signature date must equal submission date`,
        });
      }
    });
  }
}

module.exports = { validateSubmission };
