import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { ApplicationDefinition } from '../../types/application';
import { useApplication } from '../../context/ApplicationContext';
import { getApplication, submitApplication, validateApplication } from '../../services/applicationService';
import {
  loadApplicationData,
  markSubmitted,
  saveApplication,
  type SavedApplicationData,
} from '../../services/applicationStorageService';
import { WizardV2FormProvider, useWizardV2Controller } from './formController';
import WizardField from './WizardField';
import WizardSidebar from './WizardSidebar';
import { evaluateVisibility } from './visibility';

type DocusignStartResponse = {
  signingUrl?: string;
  envelopeId?: string;
  error?: string;
  message?: string;
};

type AnswerMap = Record<string, string | boolean | Record<string, string | boolean>[]>;

function asString(value: string | boolean | Record<string, string | boolean>[] | undefined) {
  if (typeof value === 'string') return value.trim();
  return '';
}

function asBool(value: string | boolean | Record<string, string | boolean>[] | undefined) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
  return false;
}

function asNumber(value: string | boolean | Record<string, string | boolean>[] | undefined) {
  if (typeof value === 'boolean') return 0;
  if (Array.isArray(value)) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function encryptedValue(raw: string | boolean | Record<string, string | boolean>[] | undefined) {
  const plain = asString(raw);
  const digits = plain.replace(/\D/g, '');
  const hint = digits.slice(-4);
  return {
    isEncrypted: true as const,
    value: plain ? `enc_mock_${digits || plain}` : 'enc_mock_empty',
    hint: hint || '0000',
  };
}

function signatureRecord(signatureToken: string | boolean | Record<string, string | boolean>[] | undefined) {
  return {
    capturedImage: asString(signatureToken) || null,
    attestation: {
      signedAt: new Date().toISOString(),
      method: 'drawn' as const,
      isProducerWitnessed: false,
      witnessProducerNpn: null,
      ipAddress: null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
  };
}

function buildSubmissionPayload(values: AnswerMap, definition: ApplicationDefinition) {
  const taxStatusMap: Record<string, 'non_qualified' | 'ira' | 'roth_ira' | 'sep_ira' | 'tsa_403b' | 'inherited_ira'> = {
    non_qualified: 'non_qualified',
    ira: 'ira',
    roth_ira: 'roth_ira',
    sep_ira: 'sep_ira',
    tsa_403b: 'tsa_403b',
    inherited_ira: 'inherited_ira',
  };

  const transferScope = asString(values.transfer_scope);
  const transferTiming = asString(values.transfer_timing);
  const ownerSameAsAnnuitant = asBool(values.owner_same_as_annuitant);
  const allocationQuestion = definition.pages
    .flatMap((page) => page.questions)
    .find((question) => question.id === 'investment_allocations');
  const allocationFundsById = new Map(
    (allocationQuestion?.allocationConfig?.funds ?? []).map((fund) => [fund.id, fund]),
  );
  const investmentAllocationsRaw = Array.isArray(values.investment_allocations)
    ? values.investment_allocations
    : [];
  const investmentAllocations = investmentAllocationsRaw
    .map((entry) => {
      const fundId = asString(entry.fundId);
      const fund = allocationFundsById.get(fundId);
      if (!fundId || !fund) return null;

      return {
        fundId,
        fundName: fund.name,
        percentage: asNumber(entry.percentage),
        creditingMethod: fund.creditingMethod ?? null,
        index: fund.index ?? null,
        termYears: typeof fund.termYears === 'number' ? fund.termYears : null,
        hasStrategyFee: Boolean(fund.hasStrategyFee),
        strategyFeeAnnualPct:
          typeof fund.strategyFeeAnnualPct === 'number' ? fund.strategyFeeAnnualPct : null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return {
    envelope: {
      submissionId: typeof crypto !== 'undefined' ? crypto.randomUUID() : `sub_${Date.now()}`,
      applicationId: `app_${definition.id}`,
      schemaVersion: '1.0.0',
      submittedAt: new Date().toISOString(),
      applicationDefinitionId: definition.id,
      applicationDefinitionVersion: definition.version,
      carrier: {
        name: definition.carrier,
        carrierId: 'fig-carrier-midland-national',
      },
      product: {
        productId: definition.productId,
        productName: definition.productName,
        formNumbers: [],
      },
      submissionMode: 'pdf_fill' as const,
      submissionSource: 'web' as const,
      submittingProducerNpn: null,
      ipAddress: null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
    annuitant: {
      firstName: asString(values.annuitant_first_name),
      middleName: asString(values.annuitant_middle_initial) || null,
      lastName: asString(values.annuitant_last_name),
      dateOfBirth: asString(values.annuitant_dob),
      gender: asString(values.annuitant_gender) === 'female' ? 'female' : 'male',
      taxId: encryptedValue(values.annuitant_ssn),
      address: {
        street1: asString(values.annuitant_street_address),
        street2: null,
        city: asString(values.annuitant_city),
        state: asString(values.annuitant_state),
        zip: asString(values.annuitant_zip),
      },
      phone: asString(values.annuitant_phone),
      email: null,
      isUsCitizen: asString(values.annuitant_us_citizen) === 'yes',
    },
    jointAnnuitant: asBool(values.has_joint_annuitant)
      ? {
        firstName: asString(values.joint_annuitant_first_name),
        middleName: asString(values.joint_annuitant_middle_initial) || null,
        lastName: asString(values.joint_annuitant_last_name),
        dateOfBirth: asString(values.joint_annuitant_dob),
        gender: asString(values.joint_annuitant_gender) === 'female' ? 'female' : 'male',
        taxId: encryptedValue(values.joint_annuitant_ssn),
        address: {
          street1: asString(values.joint_annuitant_street_address),
          street2: null,
          city: asString(values.joint_annuitant_city),
          state: asString(values.joint_annuitant_state),
          zip: asString(values.joint_annuitant_zip),
        },
        phone: asString(values.joint_annuitant_phone),
        email: null,
        isUsCitizen: asString(values.joint_annuitant_us_citizen) === 'yes',
      }
      : null,
    owner: ownerSameAsAnnuitant
      ? { isSameAsAnnuitant: true }
      : {
        isSameAsAnnuitant: false,
        type: 'individual',
        person: {
          firstName: asString(values.owner_first_name),
          middleName: asString(values.owner_middle_initial) || null,
          lastName: asString(values.owner_last_name),
          dateOfBirth: asString(values.owner_dob),
          gender: asString(values.owner_gender) === 'female' ? 'female' : 'male',
          taxId: encryptedValue(values.owner_ssn_tin),
          address: {
            street1: asString(values.owner_street_address),
            street2: null,
            city: asString(values.owner_city),
            state: asString(values.owner_state),
            zip: asString(values.owner_zip),
          },
          phone: asString(values.owner_phone),
          email: asString(values.owner_email) || null,
          isUsCitizen: asString(values.owner_citizenship_status) !== 'non_resident_alien',
        },
      },
    jointOwner: asBool(values.has_joint_owner)
      ? {
        firstName: asString(values.joint_owner_first_name),
        middleName: asString(values.joint_owner_middle_initial) || null,
        lastName: asString(values.joint_owner_last_name),
        dateOfBirth: asString(values.joint_owner_dob),
        gender: asString(values.joint_owner_gender) === 'female' ? 'female' : 'male',
        taxId: encryptedValue(values.joint_owner_ssn),
        address: {
          street1: asString(values.joint_owner_street_address),
          street2: null,
          city: asString(values.joint_owner_city),
          state: asString(values.joint_owner_state),
          zip: asString(values.joint_owner_zip),
        },
        phone: asString(values.joint_owner_phone),
        email: asString(values.joint_owner_email) || null,
        isUsCitizen: true,
      }
      : null,
    ownerBeneficiaries: [],
    annuitantBeneficiaries: [],
    identityVerification: {
      citizenshipStatus: (asString(values.owner_citizenship_status) || 'us_citizen') as
        | 'us_citizen'
        | 'us_resident_alien'
        | 'non_resident_alien',
      countryOfCitizenship: asString(values.owner_country_of_citizenship) || null,
      governmentId: {
        type: 'drivers_license',
        number: asString(values.owner_id_number),
        issuedBy: asString(values.owner_id_state || values.owner_id_country),
        expirationDate: asString(values.owner_id_expiration),
      },
      occupation: asString(values.owner_occupation),
      employerName: asString(values.owner_employer_name) || null,
      yearsEmployed: asString(values.owner_years_employed) || null,
      nonNaturalDocumentType: asString(values.owner_non_natural_doc_type) || null,
    },
    product: {
      taxStatus: taxStatusMap[asString(values.tax_status)] ?? 'non_qualified',
      iraContributionTaxYear: asNumber(values.ira_contribution_tax_year) || null,
    },
    funding: {
      methods: [
        { type: 'check', amount: asNumber(values.check_amount) },
        { type: 'direct_transfer', amount: asNumber(values.direct_transfer_amount) },
        { type: 'exchange_1035', amount: asNumber(values.exchange_1035_amount) },
        { type: 'qualified_rollover', amount: asNumber(values.qualified_rollover_amount) },
        { type: 'salary_reduction', amount: asNumber(values.salary_reduction_amount) },
      ].filter((item) => item.amount > 0),
      multipleCheckHandling: asString(values.multiple_check_handling) || null,
      totalPremium:
        asNumber(values.check_amount) +
        asNumber(values.direct_transfer_amount) +
        asNumber(values.exchange_1035_amount) +
        asNumber(values.qualified_rollover_amount) +
        asNumber(values.salary_reduction_amount),
    },
    investmentAllocations,
    transfers: [
      {
        index: 1,
        receiving: {
          contractNumber: asString(values.receiving_contract_number) || null,
          carrierDtcc: asString(values.receiving_carrier_dtcc) || null,
        },
        surrenderingCompany: {
          name: asString(values.surrendering_company_name),
          address: {
            street1: asString(values.surrendering_street_address_1),
            street2: asString(values.surrendering_address_2) || null,
            city: asString(values.surrendering_city),
            state: asString(values.surrendering_state),
            zip: asString(values.surrendering_zip),
          },
          phone: asString(values.surrendering_phone) || null,
          phoneExt: asString(values.surrendering_phone_ext) || null,
          fax: asString(values.surrendering_fax) || null,
        },
        surrenderingContract: {
          accountNumber: asString(values.surrendering_account_number),
          planType: asString(values.surrendering_plan_type) || 'other',
          productType: asString(values.surrendering_product_type) || 'other',
          estimatedAmount: asNumber(values.estimated_transfer_amount),
        },
        surrenderingParties: {
          ownerName: asString(values.surrendering_owner_name),
          ownerTaxId: encryptedValue(values.surrendering_owner_ssn),
          jointOwnerName: asString(values.surrendering_joint_owner_name) || null,
          jointOwnerTaxId: asString(values.surrendering_joint_owner_ssn)
            ? encryptedValue(values.surrendering_joint_owner_ssn)
            : null,
          annuitantName: asString(values.surrendering_annuitant_name) || null,
          annuitantTaxId: asString(values.surrendering_annuitant_ssn)
            ? encryptedValue(values.surrendering_annuitant_ssn)
            : null,
          jointAnnuitantName: asString(values.surrendering_joint_annuitant_name) || null,
          jointAnnuitantTaxId: asString(values.surrendering_joint_annuitant_ssn)
            ? encryptedValue(values.surrendering_joint_annuitant_ssn)
            : null,
          contingentAnnuitantName: asString(values.surrendering_contingent_annuitant_name) || null,
          contingentAnnuitantTaxId: asString(values.surrendering_contingent_annuitant_ssn)
            ? encryptedValue(values.surrendering_contingent_annuitant_ssn)
            : null,
        },
        transferInstructions: {
          scope: transferScope || 'full',
          partialAmountType: asString(values.partial_amount_type) || null,
          partialDollarAmount: asNumber(values.partial_dollar_amount) || null,
          partialPercentage: asNumber(values.partial_percentage) || null,
          timing: transferTiming || 'asap',
          specificDate: asString(values.transfer_specific_date) || null,
        },
        acknowledgments: {
          isRmdAcknowledged: asBool(values.rmd_acknowledged),
          isPartial1035Acknowledged: asBool(values.partial_1035_acknowledged),
          isTsa403bTransferAcknowledged: asBool(values.tsa_403b_transfer_acknowledged),
          isGeneralDisclosuresAcknowledged: asBool(values.general_disclosures_acknowledged),
          isBackupWithholding: asBool(values.backup_withholding),
          isTaxpayerCertificationAcknowledged: asBool(values.taxpayer_certification_acknowledged),
        },
        signatures: {
          ownerSignature: signatureRecord(values.transfer_owner_signature),
          ownerSignatureDate: asString(values.transfer_owner_signature_date),
          jointOwnerSignature: asString(values.transfer_joint_owner_signature)
            ? signatureRecord(values.transfer_joint_owner_signature)
            : null,
          jointOwnerSignatureDate: asString(values.transfer_joint_owner_signature_date) || null,
          annuitantSignature: asString(values.transfer_annuitant_signature)
            ? signatureRecord(values.transfer_annuitant_signature)
            : null,
          spouseSignature: asString(values.transfer_spouse_signature)
            ? signatureRecord(values.transfer_spouse_signature)
            : null,
          spouseSignatureDate: asString(values.transfer_spouse_signature_date) || null,
          tsaEmployer: asString(values.tsa_employer_signature)
            ? {
              name: asString(values.tsa_employer_name),
              title: asString(values.tsa_employer_title),
              signature: signatureRecord(values.tsa_employer_signature),
              signatureDate: asString(values.tsa_employer_signature_date),
            }
            : null,
        },
      },
    ],
    replacement: {
      hasExistingInsurance: asBool(values.has_existing_insurance),
      isReplacement: asBool(values.is_replacement),
      replacedContracts: [],
    },
    disclosures: [],
    applicationSignatures: {
      isOwnerStatementAcknowledged: asBool(values.owner_statement_acknowledged),
      isFraudWarningAcknowledged: asBool(values.fraud_warning_acknowledged),
      ownerSignature: signatureRecord(values.owner_signature),
      ownerSignatureDate: asString(values.date_signed),
      jointOwnerSignature: asString(values.joint_owner_signature) ? signatureRecord(values.joint_owner_signature) : null,
      jointOwnerSignatureDate: asString(values.date_signed) || null,
      spouseSignature: asString(values.spouse_signature) ? signatureRecord(values.spouse_signature) : null,
      signedAtCity: asString(values.signed_at_city),
      signedAtState: asString(values.signed_at_state),
      ownerEmail: asString(values.owner_email) || null,
      jointOwnerEmail: asString(values.joint_owner_email) || null,
    },
    producerCertification: {
      isProducerAwareOfExistingInsurance: asBool(values.agent_replacement_existing),
      isProducerBelievesReplacement: asBool(values.agent_replacement_replacing),
      replacingCompanyName: asString(values.agent_replacement_company) || null,
      producers: [],
    },
  };
}

function getSignerDefaults(values: AnswerMap) {
  const ownerSameAsAnnuitant = asBool(values.owner_same_as_annuitant);
  const ownerName = [asString(values.owner_first_name), asString(values.owner_last_name)]
    .filter(Boolean)
    .join(' ')
    .trim();
  const annuitantName = [asString(values.annuitant_first_name), asString(values.annuitant_last_name)]
    .filter(Boolean)
    .join(' ')
    .trim();
  const signerName = ownerSameAsAnnuitant ? annuitantName || ownerName : ownerName || annuitantName;
  const signerEmail = asString(values.owner_email) || asString(values.annuitant_email);

  return {
    signerName: signerName.trim(),
    signerEmail: signerEmail.trim(),
  };
}

function ReviewPanel() {
  const { pages, values } = useWizardV2Controller();

  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h2" fontWeight="bold">
        Review & Submit
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Confirm all answers before final submission.
      </Typography>

      {pages.map((page) => (
        <Paper key={page.id} variant="outlined" sx={{ p: 2.5, borderColor: 'divider' }}>
          <Typography variant="subtitle1" fontWeight="bold" color="primary.main" gutterBottom>
            {page.title}
          </Typography>
          <Stack spacing={1.25}>
            {page.questions.map((question) => {
              const rawValue = values[question.id];
              const isMissingValue =
                rawValue === undefined
                || rawValue === null
                || (typeof rawValue === 'string' && !rawValue.trim())
                || (Array.isArray(rawValue) && rawValue.length === 0);

              const displayValue = Array.isArray(rawValue)
                ? `${rawValue.length} item${rawValue.length === 1 ? '' : 's'}`
                : typeof rawValue === 'boolean'
                  ? rawValue
                    ? 'Yes'
                    : 'No'
                  : rawValue || 'Not provided';

              return (
                <Stack
                  key={question.id}
                  direction="row"
                  justifyContent="space-between"
                  spacing={2}
                  sx={isMissingValue ? { color: 'error.main' } : undefined}
                >
                  <Typography variant="body2" color={isMissingValue ? 'error.main' : 'text.secondary'}>
                    {question.label}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={isMissingValue ? 'error.main' : 'text.primary'}
                    sx={{ textAlign: 'right', fontWeight: isMissingValue ? 600 : 400 }}
                  >
                    {displayValue}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

interface WizardPageContentProps {
  saveId: string;
  initialStep: number;
}

function WizardPageContent({ saveId, initialStep }: WizardPageContentProps) {
  const navigate = useNavigate();
  const { definition, pages, values, validatePage, isPageComplete, populateWithDummyData, bulkSetValues } = useWizardV2Controller();
  const { collectedFields, mergeFields } = useApplication();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [showSubmissionBanner, setShowSubmissionBanner] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docusignError, setDocusignError] = useState<string | null>(null);
  const [isDocusignLoading, setIsDocusignLoading] = useState(false);
  const [docusignOpened, setDocusignOpened] = useState(false);
  const [docusignEnvelopeId, setDocusignEnvelopeId] = useState<string | null>(null);
  const [signerDialogOpen, setSignerDialogOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerFieldErrors, setSignerFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const lastAppliedRef = useRef<Record<string, string | boolean>>({});

  // ── Persistence ────────────────────────────────────────────────────────────

  const persistProgress = (step: number, status: 'in_progress' | 'submitted' = 'in_progress') => {
    const entry = {
      id: saveId,
      productId: definition.productId,
      productName: definition.productName,
      carrier: definition.carrier,
      version: definition.version,
      lastSavedAt: new Date().toISOString(),
      status,
      currentStep: step,
    };
    const data: SavedApplicationData = { currentStep: step, values: values as Record<string, unknown> };
    saveApplication(entry, data);
  };

  // ── AI field sync ──────────────────────────────────────────────────────────

  useEffect(() => {
    const newFields: Record<string, string | boolean> = {};
    for (const [key, val] of Object.entries(collectedFields)) {
      if ((typeof val === 'string' || typeof val === 'boolean') && lastAppliedRef.current[key] !== val) {
        newFields[key] = val;
      }
    }
    if (Object.keys(newFields).length > 0) {
      lastAppliedRef.current = { ...lastAppliedRef.current, ...newFields };
      bulkSetValues(newFields);
    }
  }, [collectedFields, bulkSetValues]);

  useEffect(() => {
    const nonEmpty: Record<string, string | boolean> = {};
    for (const [key, val] of Object.entries(values)) {
      if (typeof val === 'string' && val.trim()) {
        nonEmpty[key] = val;
      } else if (typeof val === 'boolean' && val) {
        nonEmpty[key] = val;
      }
    }
    if (Object.keys(nonEmpty).length > 0) {
      lastAppliedRef.current = { ...lastAppliedRef.current, ...nonEmpty };
      mergeFields(nonEmpty);
    }
  }, [values, mergeFields]);

  // ── Step state ─────────────────────────────────────────────────────────────

  const isIntroStep = currentStep === 0;
  const isReviewStep = currentStep === pages.length + 1;
  const totalSteps = pages.length + 2;
  const progress = (currentStep / (totalSteps - 1)) * 100;

  const currentPage = !isIntroStep && !isReviewStep ? pages[currentStep - 1] : null;
  const sidebarStep = isIntroStep ? -1 : isReviewStep ? pages.length : currentStep - 1;

  const stepLabel = useMemo(() => {
    if (isIntroStep) return 'Application Overview';
    if (isReviewStep) return 'Review & Submit';
    return currentPage?.title ?? '';
  }, [currentPage, isIntroStep, isReviewStep]);

  const isFormComplete = useMemo(
    () => pages.every((page) => isPageComplete(page)),
    [isPageComplete, pages],
  );

  const shouldShowDocusignStatus = Boolean(
    isDocusignLoading || docusignError || docusignOpened || docusignEnvelopeId,
  );

  const handleNext = () => {
    if (!isReviewStep && currentPage && !validatePage(currentPage)) return;
    if (currentStep < totalSteps - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      persistProgress(next);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      persistProgress(prev);
    }
  };

  // ── Exit ───────────────────────────────────────────────────────────────────

  const handleExitSaveAndLeave = () => {
    persistProgress(currentStep, 'in_progress');
    navigate('/applications');
  };

  const handleExitDiscard = () => navigate('/applications');

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmissionError(null);
    setShowSubmissionBanner(false);
    setIsSubmitting(true);

    const submissionPayload = buildSubmissionPayload(values as AnswerMap, definition);
    const applicationId = `app_${definition.id}`;
    const requestPayload = {
      productId: definition.productId,
      answers: values as unknown as Record<string, string | number | boolean | null>,
    };

    try {
      const validateResult = await validateApplication(applicationId, requestPayload, 'full');

      if (!validateResult.valid) {
        const firstValidationMessage = validateResult.errors?.[0]?.message;
        setSubmissionError(firstValidationMessage || 'Validation failed. Please review your answers and try again.');
        return;
      }

      await submitApplication(applicationId, {
        ...requestPayload,
        metadata: {
          submissionSource: 'web',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
      });

      console.log('eapp_submission_payload', submissionPayload);
      markSubmitted(saveId);
      setShowSubmissionBanner(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Unable to reach the server. Please try again.');
      console.error('Submission request failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

const handleStartDocusign = async (
  requestedName: string,
  requestedEmail: string,
  popup?: Window | null
) => {
  setDocusignError(null);
  setDocusignOpened(false);
  setDocusignEnvelopeId(null);
  setIsDocusignLoading(true);

  const applicationId = `app_${definition.id}`;

  try {
    const response = await fetch(`/application/${applicationId}/docusign/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signerEmail: requestedEmail,
        signerName: requestedName,
      }),
    });

    const result = (await response.json()) as DocusignStartResponse;

    if (!response.ok) {
      if (popup && !popup.closed) popup.close();
      setDocusignError(result.error || result.message || 'DocuSign request failed. Please try again.');
      return;
    }

    if (!result.signingUrl) {
      if (popup && !popup.closed) popup.close();
      setDocusignError('DocuSign did not return a signing URL.');
      return;
    }

    setDocusignEnvelopeId(result.envelopeId ?? null);

    // If we successfully opened a tab synchronously, navigate it now.
    if (popup && !popup.closed) {
      popup.location.href = result.signingUrl;
    } else {
      // Fallback: if popup was blocked, navigate current tab
      window.location.href = result.signingUrl;
    }

    setDocusignOpened(true);
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    console.error('DocuSign request failed:', error);
    setDocusignError('Unable to reach the DocuSign service. Please try again.');
  } finally {
    setIsDocusignLoading(false);
  }
};

const handleDocusignClick = () => {
  const defaults = getSignerDefaults(values as AnswerMap);

  if (!defaults.signerName || !defaults.signerEmail) {
    setSignerName(defaults.signerName);
    setSignerEmail(defaults.signerEmail);
    setSignerFieldErrors({});
    setSignerDialogOpen(true);
    return;
  }

  // Open the tab immediately (user gesture), then fill it after fetch returns.
  const popup = window.open('', '_blank', 'noopener,noreferrer');

  // Optional: if popup blocked, show a helpful message.
  if (!popup) {
    setDocusignError('Your browser blocked the DocuSign popup. Please allow popups and try again.');
  }

  handleStartDocusign(defaults.signerName, defaults.signerEmail, popup);
};

  const handleSignerDialogClose = () => {
    if (!isDocusignLoading) {
      setSignerDialogOpen(false);
    }
  };

  const handleSignerDialogContinue = () => {
    const trimmedName = signerName.trim();
    const trimmedEmail = signerEmail.trim();
    const nextErrors: { name?: string; email?: string } = {};

    if (!trimmedName) {
      nextErrors.name = 'Full name is required.';
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      nextErrors.email = 'Valid email is required.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setSignerFieldErrors(nextErrors);
      return;
    }

    setSignerFieldErrors({});
    setSignerDialogOpen(false);
    handleStartDocusign(trimmedName, trimmedEmail);
  };

  const handleSidebarPageClick = (pageIndex: number) => {
    setCurrentStep(pageIndex + 1);
  };

  const handleSidebarIntroClick = () => {
    setCurrentStep(0);
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 48px)', overflow: 'hidden', bgcolor: 'background.default' }}>
      <WizardSidebar
        pages={pages}
        currentStep={sidebarStep}
        productName={definition.productName}
        carrier={definition.carrier}
        isPageComplete={(index) => isPageComplete(pages[index])}
        onIntroClick={handleSidebarIntroClick}
        onPageClick={handleSidebarPageClick}
      />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <LinearProgress variant="determinate" value={progress} color="secondary" sx={{ height: 6, flexShrink: 0 }} />

        <Box sx={{ p: { xs: 2, md: 4 }, flex: 1, overflowY: 'auto' }}>
          <Box sx={{ maxWidth: 860, mx: 'auto' }}>
            {isIntroStep && (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                <Chip label={definition.carrier} color="secondary" size="small" />
                <Chip label={`Step ${currentStep + 1} of ${totalSteps}`} variant="outlined" color="secondary" size="small" />
                <Typography variant="caption" color="text.secondary">
                  Active section: {stepLabel}
                </Typography>
                <Button size="small" variant="outlined" color="secondary" onClick={populateWithDummyData}>
                  Fill Dummy Data
                </Button>
              </Stack>
            )}

            {showSubmissionBanner && (
              <Alert icon={<CheckIcon fontSize="inherit" />} severity="success" sx={{ mb: 3 }}>
                Application submitted successfully. You can review data and navigate back if updates are needed.
              </Alert>
            )}

            {submissionError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {submissionError}
              </Alert>
            )}

            {isIntroStep && Object.keys(collectedFields).length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {Object.keys(collectedFields).length} fields have been pre-filled from your AI conversation. Review and complete the remaining sections.
              </Alert>
            )}

            {isIntroStep && (
              <Paper
                variant="outlined"
                sx={{ p: { xs: 2.5, md: 3.5 }, borderColor: 'secondary.light', bgcolor: 'background.paper' }}
              >
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                  {definition.carrier}
                </Typography>
                <Typography variant="h4" component="h1" fontWeight="bold" color="primary.main" gutterBottom>
                  {definition.productName}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                  <Chip label={`Version ${definition.version}`} size="small" variant="outlined" />
                  {definition.effectiveDate && (
                    <Chip label={`Effective ${definition.effectiveDate}`} size="small" variant="outlined" />
                  )}
                  <Chip label={`${definition.pages.length} sections`} size="small" variant="outlined" />
                </Stack>
                <Typography variant="body1" color="text.secondary">
                  {definition.description}
                </Typography>
              </Paper>
            )}

            {!isReviewStep && currentPage && (
              <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderColor: 'divider' }}>
                <Typography variant="h6" component="h2" gutterBottom>
                  {currentPage.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {currentPage.description}
                </Typography>

                <Grid container spacing={2}>
                  {currentPage.questions.filter((q) => evaluateVisibility(q.visibility, values)).map((question) => (
                    <Grid
                      key={question.id}
                      size={{
                        xs: 12,
                        md:
                          question.type === 'long_text'
                            || question.type === 'repeatable_group'
                            || question.type === 'allocation_table'
                            ? 12
                            : 6,
                      }}
                    >
                      <WizardField question={question} />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}

            {isReviewStep && <ReviewPanel />}

            {isReviewStep && shouldShowDocusignStatus && (
              <Stack spacing={1.5} sx={{ mt: 3 }}>
                {isDocusignLoading && (
                  <Alert severity="info" icon={<CircularProgress size={16} color="inherit" />}>
                    Starting DocuSign session...
                  </Alert>
                )}
                {docusignError && <Alert severity="error">{docusignError}</Alert>}
                {docusignOpened && (
                  <Alert severity="success">
                    DocuSign opened in a new tab. After signing, return here to continue.
                  </Alert>
                )}
                {docusignEnvelopeId && (
                  <Typography variant="caption" color="text.secondary">
                    Envelope ID: {docusignEnvelopeId}
                  </Typography>
                )}
                {docusignOpened && (
                  <Box>
                    <Button variant="outlined" size="small" component="a" href="/docusign/return">
                      Go to DocuSign return page
                    </Button>
                  </Box>
                )}
              </Stack>
            )}
          </Box>
        </Box>

        <Divider />

        {/* ── Bottom navigation ────────────────────────────────────────── */}
        <Box
          sx={{
            p: { xs: 2 },
            bgcolor: 'background.paper',
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ maxWidth: 860, mx: 'auto' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  startIcon={<ExitToAppIcon />}
                  onClick={() => setExitDialogOpen(true)}
                  color="warning"
                  variant="outlined"
                  size="small"
                >
                  Exit
                </Button>
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <Button
                  startIcon={<ArrowBackIcon />}
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  color="secondary"
                  variant="outlined"
                  size="small"
                >
                  Back
                </Button>
                {!isReviewStep && (
                  <Button variant="contained" color="secondary" size="small" endIcon={<ArrowForwardIcon />} onClick={handleNext}>
                    {isIntroStep ? 'Start Application' : 'Save & Next'}
                  </Button>
                )}
                {isReviewStep && (
                  <>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleDocusignClick}
                      disabled={isDocusignLoading}
                      startIcon={isDocusignLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                      {isDocusignLoading ? 'Starting DocuSign...' : 'Sign with DocuSign'}
                    </Button>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      onClick={handleSubmit}
                      disabled={isSubmitting || !isFormComplete}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Application'}
                    </Button>
                  </>
                )}
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Box>

      <Dialog
        open={signerDialogOpen}
        onClose={handleSignerDialogClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Signer details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Full name"
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              error={Boolean(signerFieldErrors.name)}
              helperText={signerFieldErrors.name}
              autoFocus
            />
            <TextField
              label="Email"
              type="email"
              value={signerEmail}
              onChange={(event) => setSignerEmail(event.target.value)}
              error={Boolean(signerFieldErrors.email)}
              helperText={signerFieldErrors.email}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSignerDialogClose} disabled={isDocusignLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSignerDialogContinue}
            disabled={isDocusignLoading}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>
      {/* ── Exit confirmation dialog ──────────────────────────────────── */}
      <Dialog
        open={exitDialogOpen}
        onClose={() => setExitDialogOpen(false)}
        aria-labelledby="exit-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="exit-dialog-title">Save your progress?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your answers will be saved so you can continue this application later from the Applications page.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button size='small' onClick={() => setExitDialogOpen(false)}>Cancel</Button>
          <Button size='small' onClick={handleExitDiscard} color="warning">
            Exit without saving
          </Button>
          <Button size='small' onClick={handleExitSaveAndLeave} variant="contained" color="secondary">
            Save & Exit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function WizardPageV2() {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('resume');

  const [definition, setDefinition] = useState<ApplicationDefinition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load saved resume data once at mount — no effect needed, localStorage is synchronous
  const [initialValues] = useState<Record<string, unknown> | undefined>(() => {
    if (!resumeId) return undefined;
    return loadApplicationData(resumeId)?.values;
  });
  const [initialStep] = useState<number>(() => {
    if (!resumeId) return 0;
    return loadApplicationData(resumeId)?.currentStep ?? 0;
  });

  // Each save has its own UUID — stable for the lifetime of this session
  const [saveId] = useState<string>(() => resumeId ?? crypto.randomUUID());

  useEffect(() => {
    if (!productId) return;

    getApplication(decodeURIComponent(productId))
      .then(setDefinition)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load application definition'));
  }, [productId]);

  if (loadError) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{loadError}</Alert>
      </Box>
    );
  }

  if (!definition) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  return (
    <WizardV2FormProvider definition={definition} initialValues={initialValues}>
      <WizardPageContent saveId={saveId} initialStep={initialStep} />
    </WizardV2FormProvider>
  );
}

export default WizardPageV2;