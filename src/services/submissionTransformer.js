const { evaluateVisibility } = require('./validationEngine');

// ─────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────

function encryptSSN(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 0) return null;
  const hint = digits.slice(-4);
  return { encrypted: true, value: raw, hint };
}

function yesNoToBool(val) {
  if (typeof val === 'boolean') return val;
  if (val === 'yes') return true;
  if (val === 'no') return false;
  return val;
}

function buildAddress(source, prefix) {
  return {
    street1: source[`${prefix}_street_address`] || '',
    street2: source[`${prefix}_address_2`] || null,
    city: source[`${prefix}_city`] || '',
    state: source[`${prefix}_state`] || '',
    zip: source[`${prefix}_zip`] || '',
  };
}

function buildSignatureRecord(signatureValue) {
  if (!signatureValue) return null;
  if (typeof signatureValue === 'object' && signatureValue.capturedImage !== undefined) {
    return signatureValue;
  }
  // Raw signature data from the frontend is the captured image string
  return {
    capturedImage: typeof signatureValue === 'string' ? signatureValue : null,
    attestation: {
      signedAt: new Date().toISOString(),
      method: 'drawn',
      agentWitnessed: false,
      witnessAgentNpn: null,
      ipAddress: null,
      userAgent: null,
    },
  };
}

function buildPersonParty(source, prefix) {
  return {
    firstName: source[`${prefix}_first_name`] || '',
    middleInitial: source[`${prefix}_middle_initial`] || null,
    lastName: source[`${prefix}_last_name`] || '',
    dateOfBirth: source[`${prefix}_dob`] || '',
    gender: source[`${prefix}_gender`] || '',
    ssn: encryptSSN(source[`${prefix}_ssn`]),
    address: buildAddress(source, prefix),
    phone: source[`${prefix}_phone`] || '',
    email: source[`${prefix}_email`] || null,
    usCitizen: yesNoToBool(source[`${prefix}_us_citizen`]) === true,
  };
}

// ─────────────────────────────────────────────────────────────────
// SECTION BUILDERS
// ─────────────────────────────────────────────────────────────────

function buildEnvelope(product, context) {
  return {
    submissionId: context.submissionId || require('crypto').randomUUID(),
    applicationId: context.applicationId,
    schemaVersion: '1.0.0',
    submittedAt: context.submittedAt || new Date().toISOString(),
    applicationDefinitionId: product.id,
    applicationDefinitionVersion: product.version || '1.0.0',
    carrier: {
      name: product.carrier || '',
      carrierId: product.carrierId || `fig-carrier-${(product.carrier || '').toLowerCase().replace(/\s+/g, '-')}`,
    },
    product: {
      productId: product.productId || '',
      productName: product.productName || '',
      formNumbers: product.formNumbers || [],
    },
    submissionMode: product.submissionMode || 'pdf_fill',
    submissionSource: context.submissionSource || 'web',
    submittingAgentNpn: context.submittingAgentNpn || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
  };
}

function buildAnnuitant(answers) {
  return buildPersonParty(answers, 'annuitant');
}

function buildJointAnnuitant(answers) {
  if (yesNoToBool(answers.has_joint_annuitant) !== true) return null;

  const party = buildPersonParty(answers, 'joint_annuitant');

  // If address is same as annuitant, copy it
  if (yesNoToBool(answers.joint_annuitant_address_same) === true) {
    party.address = buildAddress(answers, 'annuitant');
    if (!party.phone) party.phone = answers.annuitant_phone || '';
  }

  return party;
}

function buildOwner(answers) {
  if (yesNoToBool(answers.owner_same_as_annuitant) === true) {
    return { sameAsAnnuitant: true };
  }

  const ownerType = answers.owner_type;

  if (ownerType === 'trust' || ownerType === 'corporation') {
    return {
      sameAsAnnuitant: false,
      type: 'entity',
      entity: {
        entityName: answers.owner_trust_name || '',
        entityType: ownerType === 'corporation' ? 'corporation' : 'trust',
        entityDate: ownerType === 'trust' ? (answers.owner_trust_date || null) : null,
        tin: encryptSSN(answers.owner_ssn_tin),
        address: buildAddress(answers, 'owner'),
        phone: answers.owner_phone || '',
        email: answers.owner_email || null,
      },
    };
  }

  // Default: individual
  return {
    sameAsAnnuitant: false,
    type: 'individual',
    person: {
      firstName: answers.owner_first_name || '',
      middleInitial: answers.owner_middle_initial || null,
      lastName: answers.owner_last_name || '',
      dateOfBirth: answers.owner_dob || '',
      gender: answers.owner_gender || '',
      ssn: encryptSSN(answers.owner_ssn_tin),
      address: buildAddress(answers, 'owner'),
      phone: answers.owner_phone || '',
      email: answers.owner_email || null,
      usCitizen: true, // owner citizenship handled in identity verification
    },
  };
}

function buildJointOwner(answers) {
  if (yesNoToBool(answers.has_joint_owner) !== true) return null;

  const party = buildPersonParty(answers, 'joint_owner');

  // If address is same as owner, copy it
  if (yesNoToBool(answers.joint_owner_address_same) === true) {
    if (yesNoToBool(answers.owner_same_as_annuitant) === true) {
      party.address = buildAddress(answers, 'annuitant');
    } else {
      party.address = buildAddress(answers, 'owner');
    }
  }

  return party;
}

function buildBeneficiaries(answers, groupId) {
  const items = answers[groupId];
  if (!Array.isArray(items) || items.length === 0) return [];

  return items.map((item, i) => ({
    index: i + 1,
    type: item.bene_type || 'primary',
    entityType: item.bene_entity_type || 'individual',
    distributionMethod: item.bene_distribution_method || 'per_stirpes',
    firstName: item.bene_first_name || '',
    middleInitial: item.bene_middle_initial || null,
    lastName: item.bene_last_name || '',
    ssn: encryptSSN(item.bene_ssn),
    dateOfBirth: item.bene_dob || null,
    relationship: item.bene_relationship || 'other',
    address: {
      street1: item.bene_street_address || '',
      street2: null,
      city: item.bene_city || '',
      state: item.bene_state || '',
      zip: item.bene_zip || '',
    },
    phone: item.bene_phone || null,
    email: item.bene_email || null,
    percentage: Number(item.bene_percentage) || 0,
  }));
}

function buildIdentityVerification(answers) {
  const citizenshipStatus = answers.owner_citizenship_status || 'us_citizen';
  const idType = answers.owner_id_type;

  // Determine issuedBy based on ID type
  let issuedBy = '';
  if (idType === 'drivers_license' || idType === 'state_id') {
    issuedBy = answers.owner_id_state || '';
  } else if (idType === 'passport' || idType === 'alien_registration') {
    issuedBy = answers.owner_id_country || '';
  }

  return {
    citizenshipStatus,
    countryOfCitizenship: citizenshipStatus !== 'us_citizen'
      ? (answers.owner_country_of_citizenship || null)
      : null,
    governmentId: {
      type: idType || 'drivers_license',
      number: answers.owner_id_number || '',
      issuedBy,
      expirationDate: answers.owner_id_expiration || '',
    },
    occupation: answers.owner_occupation || '',
    employerName: answers.owner_employer_name || null,
    yearsEmployed: answers.owner_years_employed || null,
    nonNaturalDocumentType: answers.owner_non_natural_doc_type || null,
  };
}

function buildProduct(answers) {
  const taxStatus = answers.tax_status || 'non_qualified';
  const needsTaxYear = ['ira', 'roth_ira', 'sep_ira'].includes(taxStatus);

  return {
    taxStatus,
    iraContributionTaxYear: needsTaxYear
      ? (Number(answers.ira_contribution_tax_year) || null)
      : null,
  };
}

function buildFunding(answers) {
  const selectedMethods = answers.funding_methods || [];
  const methodAmountMap = {
    check: 'check_amount',
    direct_transfer: 'direct_transfer_amount',
    exchange_1035: 'exchange_1035_amount',
    qualified_rollover: 'qualified_rollover_amount',
    salary_reduction: 'salary_reduction_amount',
  };

  const methods = [];
  let totalPremium = 0;

  for (const methodType of selectedMethods) {
    const amountField = methodAmountMap[methodType];
    const amount = Number(answers[amountField]) || 0;
    methods.push({ type: methodType, amount });
    totalPremium += amount;
  }

  return {
    methods,
    multipleCheckHandling: answers.multiple_check_handling || null,
    totalPremium,
  };
}

function buildInvestmentAllocations(answers, product) {
  const allocations = answers.investment_allocations;
  if (!Array.isArray(allocations)) return [];

  // Build fund lookup from product definition
  const fundMap = {};
  const pages = product.pages || [];
  for (const page of pages) {
    for (const q of (page.questions || [])) {
      if (q.type === 'allocation_table' && q.allocationConfig && q.allocationConfig.funds) {
        for (const fund of q.allocationConfig.funds) {
          fundMap[fund.id] = fund;
        }
      }
    }
  }

  return allocations.map(entry => {
    const fund = fundMap[entry.fundId] || {};
    return {
      fundId: entry.fundId,
      fundName: fund.name || entry.fundId,
      percentage: Number(entry.percentage) || 0,
      creditingMethod: fund.creditingMethod || null,
      index: fund.index || null,
      termYears: fund.termYears != null ? fund.termYears : null,
      hasStrategyFee: fund.hasStrategyFee || false,
      strategyFeeAnnualPct: fund.strategyFeeAnnualPct != null ? fund.strategyFeeAnnualPct : null,
    };
  });
}

function buildTransfers(answers) {
  const instances = answers['page-1035-transfer'];
  if (!Array.isArray(instances)) return [];

  return instances.map((inst, i) => ({
    index: i + 1,
    receiving: {
      contractNumber: inst.receiving_contract_number || null,
      carrierDtcc: inst.receiving_carrier_dtcc || null,
    },
    surrenderingCompany: {
      name: inst.surrendering_company_name || '',
      address: {
        street1: inst.surrendering_street_address_1 || '',
        street2: inst.surrendering_address_2 || null,
        city: inst.surrendering_city || '',
        state: inst.surrendering_state || '',
        zip: inst.surrendering_zip || '',
      },
      phone: inst.surrendering_phone || null,
      phoneExt: inst.surrendering_phone_ext || null,
      fax: inst.surrendering_fax || null,
    },
    surrenderingContract: {
      accountNumber: inst.surrendering_account_number || '',
      planType: inst.surrendering_plan_type || 'non_qualified',
      productType: inst.surrendering_product_type || 'annuity',
      estimatedAmount: Number(inst.estimated_transfer_amount) || 0,
    },
    surrenderingParties: {
      ownerName: inst.surrendering_owner_name || '',
      ownerSsn: encryptSSN(inst.surrendering_owner_ssn),
      jointOwnerName: inst.surrendering_joint_owner_name || null,
      jointOwnerSsn: encryptSSN(inst.surrendering_joint_owner_ssn),
      annuitantName: inst.surrendering_annuitant_name || null,
      annuitantSsn: encryptSSN(inst.surrendering_annuitant_ssn),
      jointAnnuitantName: inst.surrendering_joint_annuitant_name || null,
      jointAnnuitantSsn: encryptSSN(inst.surrendering_joint_annuitant_ssn),
      contingentAnnuitantName: inst.surrendering_contingent_annuitant_name || null,
      contingentAnnuitantSsn: encryptSSN(inst.surrendering_contingent_annuitant_ssn),
    },
    transferInstructions: {
      scope: inst.transfer_scope || 'full',
      partialAmountType: inst.partial_amount_type || null,
      partialDollarAmount: inst.partial_dollar_amount != null ? Number(inst.partial_dollar_amount) : null,
      partialPercentage: inst.partial_percentage != null ? Number(inst.partial_percentage) : null,
      timing: inst.transfer_timing || 'asap',
      specificDate: inst.transfer_specific_date || null,
    },
    acknowledgments: {
      rmdAcknowledged: inst.rmd_acknowledged != null ? yesNoToBool(inst.rmd_acknowledged) : null,
      partial1035Acknowledged: inst.partial_1035_acknowledged != null ? yesNoToBool(inst.partial_1035_acknowledged) : null,
      tsa403bTransferAcknowledged: inst.tsa_403b_transfer_acknowledged != null ? yesNoToBool(inst.tsa_403b_transfer_acknowledged) : null,
      generalDisclosuresAcknowledged: yesNoToBool(inst.general_disclosures_acknowledged) === true,
      backupWithholding: yesNoToBool(inst.backup_withholding) === true,
      taxpayerCertificationAcknowledged: yesNoToBool(inst.taxpayer_certification_acknowledged) === true,
    },
    signatures: {
      ownerSignature: buildSignatureRecord(inst.transfer_owner_signature),
      ownerSignatureDate: inst.transfer_owner_signature_date || '',
      jointOwnerSignature: buildSignatureRecord(inst.transfer_joint_owner_signature),
      jointOwnerSignatureDate: inst.transfer_joint_owner_signature_date || null,
      annuitantSignature: buildSignatureRecord(inst.transfer_annuitant_signature),
      spouseSignature: buildSignatureRecord(inst.transfer_spouse_signature),
      spouseSignatureDate: inst.transfer_spouse_signature_date || null,
      tsaEmployer: inst.tsa_employer_name ? {
        name: inst.tsa_employer_name,
        title: inst.tsa_employer_title || '',
        signature: buildSignatureRecord(inst.tsa_employer_signature),
        signatureDate: inst.tsa_employer_signature_date || '',
      } : null,
    },
  }));
}

function buildReplacement(answers) {
  const hasExisting = yesNoToBool(answers.has_existing_insurance) === true;
  const isReplacement = yesNoToBool(answers.is_replacement) === true;

  const contracts = [];
  if (isReplacement && Array.isArray(answers.replacement_contracts)) {
    answers.replacement_contracts.forEach((item, i) => {
      contracts.push({
        index: i + 1,
        companyName: item.replacement_company_name || '',
        contractNumber: item.replacement_contract_number || '',
      });
    });
  }

  return {
    hasExistingInsurance: hasExisting,
    isReplacement,
    replacedContracts: contracts,
  };
}

function buildDisclosures(product, answers) {
  const records = [];
  const pages = product.pages || [];

  for (const page of pages) {
    if (!page.disclosures || !Array.isArray(page.disclosures)) continue;

    for (const disc of page.disclosures) {
      // Only include disclosures that are visible given the current answers
      if (!evaluateVisibility(disc.visibility, answers)) continue;

      const ack = disc.acknowledgment;
      if (!ack) continue;

      const ackValue = answers[ack.questionId];

      records.push({
        disclosureId: disc.id,
        title: disc.title || '',
        acknowledgmentType: ack.type || 'boolean',
        acknowledgmentLabel: ack.label || '',
        viewRequired: disc.viewRequired || false,
        viewCompleted: disc.viewRequired ? true : true, // assume completed if submitted
        acknowledgedAt: new Date().toISOString(),
        signature: buildSignatureRecord(
          ack.type === 'boolean' ? null : ackValue
        ) || {
          capturedImage: null,
          attestation: {
            signedAt: new Date().toISOString(),
            method: 'clicked',
            agentWitnessed: false,
            witnessAgentNpn: null,
            ipAddress: null,
            userAgent: null,
          },
        },
      });
    }
  }

  return records;
}

function buildApplicationSignatures(answers) {
  return {
    ownerStatementAcknowledged: yesNoToBool(answers.owner_statement_acknowledged) === true,
    fraudWarningAcknowledged: yesNoToBool(answers.fraud_warning_acknowledged) === true,
    ownerSignature: buildSignatureRecord(answers.owner_signature),
    ownerSignatureDate: answers.date_signed || '',
    jointOwnerSignature: buildSignatureRecord(answers.joint_owner_signature),
    jointOwnerSignatureDate: answers.joint_owner_signature ? (answers.date_signed || null) : null,
    spouseSignature: buildSignatureRecord(answers.spouse_signature),
    signedAtCity: answers.signed_at_city || '',
    signedAtState: answers.signed_at_state || '',
    ownerEmail: answers.owner_email || null,
    jointOwnerEmail: answers.joint_owner_email || null,
  };
}

function buildAgentCertification(answers) {
  const agents = [];
  if (Array.isArray(answers.writing_agents)) {
    answers.writing_agents.forEach((agent, i) => {
      agents.push({
        index: i + 1,
        agentNumber: agent.agent_number || '',
        npn: null, // NPN not collected in current product definition
        fullName: agent.agent_full_name || '',
        email: agent.agent_email || '',
        phone: agent.agent_phone || '',
        commissionPercentage: Number(agent.agent_commission_percentage) || 0,
        commissionOption: agent.agent_commission_option || '',
        signature: buildSignatureRecord(agent.agent_signature),
        signatureDate: agent.agent_date_signed || '',
      });
    });
  }

  return {
    agentAwareOfExistingInsurance: yesNoToBool(answers.agent_replacement_existing) === true,
    agentBelievesReplacement: yesNoToBool(answers.agent_replacement_replacing) === true,
    replacingCompanyName: yesNoToBool(answers.agent_replacement_replacing) === true
      ? (answers.agent_replacement_company || null)
      : null,
    writingAgents: agents,
  };
}

// ─────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────

/**
 * Transform raw answers into the canonical ApplicationSubmission payload.
 * @param {object} product - The full application definition
 * @param {object} answers - The raw answer map
 * @param {object} context - { applicationId, submittedAt, submittingAgentNpn, ipAddress, userAgent }
 * @returns {object} ApplicationSubmission
 */
function transformSubmission(product, answers, context = {}) {
  return {
    envelope: buildEnvelope(product, context),
    annuitant: buildAnnuitant(answers),
    jointAnnuitant: buildJointAnnuitant(answers),
    owner: buildOwner(answers),
    jointOwner: buildJointOwner(answers),
    ownerBeneficiaries: buildBeneficiaries(answers, 'owner_beneficiaries'),
    annuitantBeneficiaries: buildBeneficiaries(answers, 'annuitant_beneficiaries'),
    identityVerification: buildIdentityVerification(answers),
    product: buildProduct(answers),
    funding: buildFunding(answers),
    investmentAllocations: buildInvestmentAllocations(answers, product),
    transfers: buildTransfers(answers),
    replacement: buildReplacement(answers),
    disclosures: buildDisclosures(product, answers),
    applicationSignatures: buildApplicationSignatures(answers),
    agentCertification: buildAgentCertification(answers),
  };
}

module.exports = { transformSubmission };
