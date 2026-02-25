const { evaluateVisibility } = require('./validationEngine');

// ─────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────

function encryptSSN(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 0) return null;
  const hint = digits.slice(-4);
  return { isEncrypted: true, value: raw, hint };
}

function yesNoToBool(val) {
  if (typeof val === 'boolean') return val;
  if (val === 'yes') return true;
  if (val === 'no') return false;
  return val;
}

function buildAddress(source, prefix) {
  return {
    street1: source[`${prefix}_street_address`] || source[`${prefix}ResidentialAddress`] || '',
    street2: source[`${prefix}_address_2`] || source[`${prefix}MailingAddress`] || null,
    city: source[`${prefix}_city`] || source[`${prefix}City`] || '',
    state: source[`${prefix}_state`] || source[`${prefix}State`] || '',
    zip: source[`${prefix}_zip`] || source[`${prefix}Zip`] || '',
  };
}

// Capitalize first letter helper for camelCase field lookups
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

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
      isProducerWitnessed: false,
      witnessProducerNpn: null,
      ipAddress: null,
      userAgent: null,
    },
  };
}

function buildPersonParty(source, prefix) {
  // camelCase prefix: "annuitant" → "annuitantFirstName"; snake_case: "annuitant" → "annuitant_first_name"
  const cc = prefix.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); // snake to camelCase base
  return {
    firstName: source[`${prefix}_first_name`] || source[`${cc}FirstName`] || '',
    middleName: source[`${prefix}_middle_initial`] || source[`${cc}MiddleName`] || null,
    lastName: source[`${prefix}_last_name`] || source[`${cc}LastName`] || '',
    dateOfBirth: source[`${prefix}_dob`] || source[`${cc}Dob`] || '',
    gender: source[`${prefix}_gender`] || source[`${cc}Gender`] || '',
    taxId: encryptSSN(source[`${prefix}_ssn`] || source[`${cc}TaxId`]),
    address: buildAddress(source, prefix),
    phone: source[`${prefix}_phone`] || source[`${cc}Phone`] || source[`${cc}HomePhone`] || '',
    email: source[`${prefix}_email`] || source[`${cc}Email`] || null,
    isUsCitizen: source[`${prefix}_us_citizen`] !== undefined
      ? yesNoToBool(source[`${prefix}_us_citizen`]) === true
      : source[`${cc}NonResidentAlien`] !== undefined
        ? yesNoToBool(source[`${cc}NonResidentAlien`]) !== true
        : false,
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
    submittingProducerNpn: context.submittingProducerNpn || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
  };
}

function buildAnnuitant(answers) {
  return buildPersonParty(answers, 'annuitant');
}

function buildJointAnnuitant(answers) {
  if (yesNoToBool(answers.has_joint_annuitant ?? answers.hasJointAnnuitant) !== true) return null;

  const party = buildPersonParty(answers, 'joint_annuitant');

  // If address is same as annuitant, copy it
  if (yesNoToBool(answers.joint_annuitant_address_same) === true) {
    party.address = buildAddress(answers, 'annuitant');
    if (!party.phone) party.phone = answers.annuitant_phone || answers.annuitantPhone || '';
  }

  return party;
}

function buildOwner(answers) {
  // Midland snake_case: owner_same_as_annuitant
  // EquiTrust camelCase: isOwnerSameAsAnnuitant
  if (
    yesNoToBool(answers.owner_same_as_annuitant) === true ||
    yesNoToBool(answers.isOwnerSameAsAnnuitant) === true
  ) {
    return { isSameAsAnnuitant: true };
  }

  const ownerType = answers.owner_type || answers.ownerType;

  // camelCase products: "natural_person" means individual owner; check if same as annuitant by name
  if (ownerType === 'natural_person') {
    const ownerFirst = answers.ownerFirstName || '';
    const annFirst = answers.annuitantFirstName || '';
    const ownerLast = answers.ownerLastName || '';
    const annLast = answers.annuitantLastName || '';
    if (ownerFirst && annFirst && ownerFirst === annFirst && ownerLast === annLast) {
      return { isSameAsAnnuitant: true };
    }
  }

  if (ownerType === 'trust' || ownerType === 'corporation') {
    return {
      isSameAsAnnuitant: false,
      type: 'entity',
      entity: {
        entityName: answers.owner_trust_name || '',
        entityType: ownerType === 'corporation' ? 'corporation' : 'trust',
        entityDate: ownerType === 'trust' ? (answers.owner_trust_date || null) : null,
        taxId: encryptSSN(answers.ownerTaxId || answers.owner_ssn_tin),
        address: buildAddress(answers, 'owner'),
        phone: answers.ownerPhone || answers.ownerHomePhone || answers.owner_phone || '',
        email: answers.ownerEmail || answers.owner_email || null,
      },
    };
  }

  // Individual owner (natural_person for camelCase, or default for snake_case)
  return {
    isSameAsAnnuitant: false,
    type: 'individual',
    person: {
      firstName: answers.ownerFirstName || answers.owner_first_name || '',
      middleName: answers.ownerMiddleName || answers.owner_middle_initial || null,
      lastName: answers.ownerLastName || answers.owner_last_name || '',
      dateOfBirth: answers.ownerDob || answers.owner_dob || '',
      gender: answers.ownerGender || answers.owner_gender || '',
      taxId: encryptSSN(answers.ownerTaxId || answers.owner_ssn_tin),
      address: buildAddress(answers, 'owner'),
      phone: answers.ownerPhone || answers.ownerHomePhone || answers.owner_phone || '',
      email: answers.ownerEmail || answers.owner_email || null,
      isUsCitizen: true,
    },
  };
}

function buildJointOwner(answers) {
  if (yesNoToBool(answers.has_joint_owner ?? answers.hasJointOwner) !== true) return null;

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
  // Support both snake_case group ID and camelCase group ID
  const items = answers[groupId] || answers[groupId.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
  if (!Array.isArray(items) || items.length === 0) return [];

  return items.map((item, i) => ({
    index: i + 1,
    type: item.bene_type || item.beneType || 'primary',
    entityType: item.bene_entity_type || item.beneEntityType || 'individual',
    distributionMethod: item.bene_distribution_method || item.beneDistributionMethod || 'per_stirpes',
    firstName: item.bene_first_name || item.beneFirstName || '',
    middleName: item.bene_middle_initial || item.beneMiddleName || null,
    lastName: item.bene_last_name || item.beneLastName || '',
    taxId: encryptSSN(item.bene_ssn || item.beneTaxId),
    dateOfBirth: item.bene_dob || item.beneDob || null,
    relationship: item.bene_relationship || item.beneRelationship || 'other',
    address: {
      street1: item.bene_street_address || item.beneStreetAddress || item.beneAddress || '',
      street2: null,
      city: item.bene_city || item.beneCity || '',
      state: item.bene_state || item.beneState || '',
      zip: item.bene_zip || item.beneZip || '',
    },
    phone: item.bene_phone || item.benePhone || null,
    email: item.bene_email || item.beneEmail || null,
    percentage: Number(item.bene_percentage ?? item.benePercentage) || 0,
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
  const taxStatus = answers.tax_status || answers.taxStatus || 'non_qualified';
  const needsTaxYear = ['ira', 'roth_ira', 'sep_ira'].includes(taxStatus);

  return {
    taxStatus,
    iraContributionTaxYear: needsTaxYear
      ? (Number(answers.ira_contribution_tax_year || answers.iraContributionTaxYear) || null)
      : null,
  };
}

function buildFunding(answers) {
  const selectedMethods = answers.funding_methods || answers.fundingMethods || [];
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

  // Aspida uses totalSinglePremium as an explicit field; prefer it if methods didn't sum
  if (totalPremium === 0) {
    totalPremium = Number(answers.totalSinglePremium || answers.total_single_premium) || 0;
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
      ownerTaxId: encryptSSN(inst.surrendering_owner_ssn),
      jointOwnerName: inst.surrendering_joint_owner_name || null,
      jointOwnerTaxId: encryptSSN(inst.surrendering_joint_owner_ssn),
      annuitantName: inst.surrendering_annuitant_name || null,
      annuitantTaxId: encryptSSN(inst.surrendering_annuitant_ssn),
      jointAnnuitantName: inst.surrendering_joint_annuitant_name || null,
      jointAnnuitantTaxId: encryptSSN(inst.surrendering_joint_annuitant_ssn),
      contingentAnnuitantName: inst.surrendering_contingent_annuitant_name || null,
      contingentAnnuitantTaxId: encryptSSN(inst.surrendering_contingent_annuitant_ssn),
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
      isRmdAcknowledged: inst.rmd_acknowledged != null ? yesNoToBool(inst.rmd_acknowledged) : null,
      isPartial1035Acknowledged: inst.partial_1035_acknowledged != null ? yesNoToBool(inst.partial_1035_acknowledged) : null,
      isTsa403bTransferAcknowledged: inst.tsa_403b_transfer_acknowledged != null ? yesNoToBool(inst.tsa_403b_transfer_acknowledged) : null,
      isGeneralDisclosuresAcknowledged: yesNoToBool(inst.general_disclosures_acknowledged) === true,
      isBackupWithholding: yesNoToBool(inst.backup_withholding) === true,
      isTaxpayerCertificationAcknowledged: yesNoToBool(inst.taxpayer_certification_acknowledged) === true,
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
  const hasExisting = yesNoToBool(answers.has_existing_insurance ?? answers.hasExistingInsurance) === true;
  const isReplacement = yesNoToBool(answers.is_replacement ?? answers.isReplacement) === true;

  const contracts = [];
  const contractList = answers.replacement_contracts || answers.replacementContracts;
  if (isReplacement && Array.isArray(contractList)) {
    contractList.forEach((item, i) => {
      contracts.push({
        index: i + 1,
        companyName: item.replacement_company_name || item.replInsurerName || item.replacementInsurerName || '',
        contractNumber: item.replacement_contract_number || item.replacementPolicyNumber || '',
      });
    });
  }

  return {
    hasExistingInsurance: hasExisting,
    isReplacement,
    replacedContracts: contracts,
    willPayPenaltyToObtainFunds: isReplacement
      ? yesNoToBool(answers.suitReplacePenalty ?? answers.suit_replace_penalty) ?? null
      : null,
    replacementPenaltyPct: isReplacement
      ? (Number(answers.suitReplacePenaltyAmount ?? answers.suit_replace_penalty_amount) || null)
      : null,
    replacedProductHasLivingOrDeathBenefits: isReplacement
      ? yesNoToBool(answers.suitReplaceHasLivingDeathBenefit ?? answers.suit_replace_has_living_death_benefit) ?? null
      : null,
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
        isViewRequired: disc.viewRequired || false,
        isViewCompleted: disc.viewRequired ? true : true, // assume completed if submitted
        acknowledgedAt: new Date().toISOString(),
        signature: buildSignatureRecord(
          ack.type === 'boolean' ? null : ackValue
        ) || {
          capturedImage: null,
          attestation: {
            signedAt: new Date().toISOString(),
            method: 'clicked',
            isProducerWitnessed: false,
            witnessProducerNpn: null,
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
  const ownerSig = answers.owner_signature || answers.ownerSignature;
  const jointSig = answers.joint_owner_signature || answers.jointOwnerSignature;
  const dateSigned = answers.date_signed || answers.dateSigned || '';

  return {
    isOwnerStatementAcknowledged: yesNoToBool(
      answers.owner_statement_acknowledged ?? answers.isOwnerStatementAcknowledged
    ) === true,
    isFraudWarningAcknowledged: yesNoToBool(
      answers.fraud_warning_acknowledged ?? answers.isFraudWarningDisclosureAcknowledged
    ) === true,
    ownerSignature: buildSignatureRecord(ownerSig),
    ownerSignatureDate: dateSigned,
    jointOwnerSignature: buildSignatureRecord(jointSig),
    jointOwnerSignatureDate: jointSig ? (dateSigned || null) : null,
    spouseSignature: buildSignatureRecord(answers.spouse_signature),
    signedAtCity: answers.signed_at_city || answers.signedAtStateCity || answers.signedAtCity || '',
    signedAtState: answers.signed_at_state || answers.signedAtState || answers.ownerState || '',
    ownerEmail: answers.owner_email || answers.ownerEmail || null,
    jointOwnerEmail: answers.joint_owner_email || answers.jointOwnerEmail || null,
  };
}

function buildProducerCertification(answers) {
  const producers = [];

  // Midland-style: writing_agents array with agent_ prefixed fields
  if (Array.isArray(answers.writing_agents)) {
    answers.writing_agents.forEach((agent, i) => {
      producers.push({
        index: i + 1,
        producerNumber: agent.agent_number || '',
        npn: null,
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

  // camelCase products (Aspida/EquiTrust): writingProducers array with producer-prefixed fields
  if (Array.isArray(answers.writingProducers)) {
    answers.writingProducers.forEach((prod, i) => {
      producers.push({
        index: i + 1,
        producerNumber: prod.producerStateLicense || prod.producerNumber || '',
        npn: prod.producerNpn || null,
        fullName: prod.producerFullName || '',
        email: prod.producerEmail || '',
        phone: prod.producerPhone || '',
        commissionPercentage: Number(prod.producerCommissionPercentage) || 0,
        commissionOption: answers.commissionOption || '',
        signature: buildSignatureRecord(prod.producerSignature),
        signatureDate: prod.producerDateSigned || '',
      });
    });
  }

  // Suitability fields for the engine
  const conflicts = answers.suitProducerConflicts ?? answers.suit_producer_conflicts;
  const hasConflict = conflicts === 'yes' || conflicts === true;

  return {
    isProducerAwareOfExistingInsurance: yesNoToBool(answers.agent_replacement_existing) === true,
    isProducerBelievesReplacement: yesNoToBool(answers.agent_replacement_replacing) === true,
    replacingCompanyName: yesNoToBool(answers.agent_replacement_replacing) === true
      ? (answers.agent_replacement_company || null)
      : null,
    hasConflictOfInterest: hasConflict,
    agentCertQ3Passed: yesNoToBool(
      answers.producerCertReasonableEffort ?? answers.producer_cert_reasonable_effort
    ) === true,
    agentCertQ4Passed: yesNoToBool(
      answers.producerCertSuitable ?? answers.producer_cert_suitable
    ) === true,
    agentCertQ5Passed: yesNoToBool(
      answers.producerCertNoDiminishedCapacity ?? answers.producer_cert_no_diminished_capacity
    ) === true,
    producers,
  };
}

function buildSuitabilityProfile(answers) {
  // EquiTrust uses fna* prefix, Aspida uses suit* prefix, Midland uses suit_ snake_case
  const income = answers.suitAnnualHouseholdIncome
    ?? answers.fnaAnnualHouseholdIncome
    ?? answers.suit_annual_household_income;
  const expenses = answers.suitAnnualHouseholdExpenses
    ?? answers.fnaAnnualHouseholdExpenses
    ?? answers.suit_annual_household_expenses;
  const netWorth = answers.suitNetWorth
    ?? answers.fnaEstimatedNetWorth
    ?? answers.suit_net_worth;
  const liquidAssets = answers.suitLiquidAssets
    ?? answers.fnaCheckingSavings // EquiTrust: checking/savings as primary liquid
    ?? answers.suit_liquid_assets;
  // EquiTrust also has fnaOtherLiquidAssets — add to liquid if present
  const otherLiquid = Number(answers.fnaOtherLiquidAssets) || 0;
  const liquidTotal = (Number(liquidAssets) || 0) + otherLiquid;

  const hasEmergency = answers.suitHasEmergencyFunds
    ?? answers.hasSufficientAssets // EquiTrust equivalent
    ?? answers.suit_has_emergency_funds;

  const holdYears = answers.suitHowLongKeep
    ?? answers.fnaHowLongKeep
    ?? answers.suit_how_long_keep;

  const nursingHome = answers.suitSkilledNursing
    ?? answers.isInNursingHome // EquiTrust
    ?? answers.suit_skilled_nursing;

  return {
    annualHouseholdIncome: Number(income) || null,
    annualHouseholdExpenses: Number(expenses) || null,
    totalNetWorth: Number(netWorth) || null,
    liquidNetWorth: liquidTotal || null,
    hasEmergencyFunds: yesNoToBool(hasEmergency) ?? null,
    expectedHoldYears: Number(holdYears) || null,
    hasNursingHomeStay: yesNoToBool(nursingHome) ?? null,
    nursingHomeCareType:
      answers.suitSkilledNursingExplain ?? answers.suit_skilled_nursing_explain ?? null,
    nursingHomeCareMonths: null,
    incomeCoversLivingExpenses:
      yesNoToBool(answers.suitFlIncomeCoversExpenses ?? answers.suit_fl_income_covers_expenses) ?? null,
    incomeSufficientForFutureExpenses:
      yesNoToBool(answers.suitFlIncomeSufficientFuture ?? answers.suit_fl_income_sufficient_future) ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────

/**
 * Transform raw answers into the canonical ApplicationSubmission payload.
 * @param {object} product - The full application definition
 * @param {object} answers - The raw answer map
 * @param {object} context - { applicationId, submittedAt, submittingProducerNpn, ipAddress, userAgent }
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
    producerCertification: buildProducerCertification(answers),
    suitabilityProfile: buildSuitabilityProfile(answers),
  };
}

module.exports = { transformSubmission };
