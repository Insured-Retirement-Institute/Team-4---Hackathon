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
  validateWritingAgentCommissions(submission.agentCertification, errors);
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

function validateWritingAgentCommissions(agentCert, errors) {
  if (!agentCert || !Array.isArray(agentCert.writingAgents) || agentCert.writingAgents.length === 0) return;

  const sum = agentCert.writingAgents.reduce((s, a) => s + (a.commissionPercentage || 0), 0);
  if (sum !== 100) {
    errors.push({
      field: 'agentCertification.writingAgents',
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

  // Annuitant SSN
  checkEncrypted(submission.annuitant?.ssn, 'annuitant.ssn', paths);

  // Joint annuitant SSN
  if (submission.jointAnnuitant) {
    checkEncrypted(submission.jointAnnuitant.ssn, 'jointAnnuitant.ssn', paths);
  }

  // Owner SSN/TIN
  if (submission.owner && !submission.owner.sameAsAnnuitant) {
    if (submission.owner.type === 'individual' && submission.owner.person) {
      checkEncrypted(submission.owner.person.ssn, 'owner.person.ssn', paths);
    } else if (submission.owner.type === 'entity' && submission.owner.entity) {
      checkEncrypted(submission.owner.entity.tin, 'owner.entity.tin', paths);
    }
  }

  // Joint owner SSN
  if (submission.jointOwner) {
    checkEncrypted(submission.jointOwner.ssn, 'jointOwner.ssn', paths);
  }

  // Beneficiary SSNs
  for (const group of ['ownerBeneficiaries', 'annuitantBeneficiaries']) {
    if (Array.isArray(submission[group])) {
      submission[group].forEach((b, i) => {
        if (b.ssn) checkEncrypted(b.ssn, `${group}[${i}].ssn`, paths);
      });
    }
  }

  // Transfer party SSNs
  if (Array.isArray(submission.transfers)) {
    submission.transfers.forEach((t, i) => {
      const sp = t.surrenderingParties;
      if (sp) {
        checkEncrypted(sp.ownerSsn, `transfers[${i}].surrenderingParties.ownerSsn`, paths);
        if (sp.jointOwnerSsn) checkEncrypted(sp.jointOwnerSsn, `transfers[${i}].surrenderingParties.jointOwnerSsn`, paths);
        if (sp.annuitantSsn) checkEncrypted(sp.annuitantSsn, `transfers[${i}].surrenderingParties.annuitantSsn`, paths);
        if (sp.jointAnnuitantSsn) checkEncrypted(sp.jointAnnuitantSsn, `transfers[${i}].surrenderingParties.jointAnnuitantSsn`, paths);
        if (sp.contingentAnnuitantSsn) checkEncrypted(sp.contingentAnnuitantSsn, `transfers[${i}].surrenderingParties.contingentAnnuitantSsn`, paths);
      }
    });
  }

  for (const path of paths) {
    errors.push({
      field: path,
      rule: 'ssn_encrypted',
      message: `EncryptedValue at ${path} must have encrypted: true`,
    });
  }
}

function checkEncrypted(val, path, failures) {
  if (val && typeof val === 'object' && val.encrypted !== true) {
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

  // Writing agent signature dates
  if (submission.agentCertification?.writingAgents) {
    submission.agentCertification.writingAgents.forEach((agent, i) => {
      if (agent.signatureDate && agent.signatureDate !== submissionDate) {
        errors.push({
          field: `agentCertification.writingAgents[${i}].signatureDate`,
          rule: 'signature_date_equals_submission',
          message: `Agent signature date (${agent.signatureDate}) must equal submission date (${submissionDate})`,
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
