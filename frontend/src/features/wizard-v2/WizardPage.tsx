import { useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { green } from '@mui/material/colors';
import { APPLICATION_DEFINITION } from './applicationDefinition';
import { WizardV2FormProvider, useWizardV2Controller } from './formController';
import WizardField from './WizardField';
import WizardSidebar from './WizardSidebar';

const greenWizardTheme = createTheme({
  palette: {
    primary: {
      main: green[700],
      dark: green[900],
      light: green[500],
      contrastText: '#fff',
    },
    secondary: {
      main: green[600],
    },
    success: {
      main: green[600],
    },
    background: {
      default: green[50],
      paper: '#fff',
    },
  },
});

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
    encrypted: true as const,
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
      agentWitnessed: false,
      witnessAgentNpn: null,
      ipAddress: null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
  };
}

function buildSubmissionPayload(values: AnswerMap) {
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

  return {
    envelope: {
      submissionId: typeof crypto !== 'undefined' ? crypto.randomUUID() : `sub_${Date.now()}`,
      applicationId: `app_${APPLICATION_DEFINITION.id}`,
      schemaVersion: '1.0.0',
      submittedAt: new Date().toISOString(),
      applicationDefinitionId: APPLICATION_DEFINITION.id,
      applicationDefinitionVersion: APPLICATION_DEFINITION.version,
      carrier: {
        name: APPLICATION_DEFINITION.carrier,
        carrierId: 'fig-carrier-midland-national',
      },
      product: {
        productId: APPLICATION_DEFINITION.productId,
        productName: APPLICATION_DEFINITION.productName,
        formNumbers: [],
      },
      submissionMode: 'pdf_fill' as const,
      submissionSource: 'web' as const,
      submittingAgentNpn: null,
      ipAddress: null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
    annuitant: {
      firstName: asString(values.annuitant_first_name),
      middleInitial: asString(values.annuitant_middle_initial) || null,
      lastName: asString(values.annuitant_last_name),
      dateOfBirth: asString(values.annuitant_dob),
      gender: asString(values.annuitant_gender) === 'female' ? 'female' : 'male',
      ssn: encryptedValue(values.annuitant_ssn),
      address: {
        street1: asString(values.annuitant_street_address),
        street2: null,
        city: asString(values.annuitant_city),
        state: asString(values.annuitant_state),
        zip: asString(values.annuitant_zip),
      },
      phone: asString(values.annuitant_phone),
      email: null,
      usCitizen: asString(values.annuitant_us_citizen) === 'yes',
    },
    jointAnnuitant: asBool(values.has_joint_annuitant)
      ? {
          firstName: asString(values.joint_annuitant_first_name),
          middleInitial: asString(values.joint_annuitant_middle_initial) || null,
          lastName: asString(values.joint_annuitant_last_name),
          dateOfBirth: asString(values.joint_annuitant_dob),
          gender: asString(values.joint_annuitant_gender) === 'female' ? 'female' : 'male',
          ssn: encryptedValue(values.joint_annuitant_ssn),
          address: {
            street1: asString(values.joint_annuitant_street_address),
            street2: null,
            city: asString(values.joint_annuitant_city),
            state: asString(values.joint_annuitant_state),
            zip: asString(values.joint_annuitant_zip),
          },
          phone: asString(values.joint_annuitant_phone),
          email: null,
          usCitizen: asString(values.joint_annuitant_us_citizen) === 'yes',
        }
      : null,
    owner: ownerSameAsAnnuitant
      ? { sameAsAnnuitant: true }
      : {
          sameAsAnnuitant: false,
          type: 'individual',
          person: {
            firstName: asString(values.owner_first_name),
            middleInitial: asString(values.owner_middle_initial) || null,
            lastName: asString(values.owner_last_name),
            dateOfBirth: asString(values.owner_dob),
            gender: asString(values.owner_gender) === 'female' ? 'female' : 'male',
            ssn: encryptedValue(values.owner_ssn_tin),
            address: {
              street1: asString(values.owner_street_address),
              street2: null,
              city: asString(values.owner_city),
              state: asString(values.owner_state),
              zip: asString(values.owner_zip),
            },
            phone: asString(values.owner_phone),
            email: asString(values.owner_email) || null,
            usCitizen: asString(values.owner_citizenship_status) !== 'non_resident_alien',
          },
        },
    jointOwner: asBool(values.has_joint_owner)
      ? {
          firstName: asString(values.joint_owner_first_name),
          middleInitial: asString(values.joint_owner_middle_initial) || null,
          lastName: asString(values.joint_owner_last_name),
          dateOfBirth: asString(values.joint_owner_dob),
          gender: asString(values.joint_owner_gender) === 'female' ? 'female' : 'male',
          ssn: encryptedValue(values.joint_owner_ssn),
          address: {
            street1: asString(values.joint_owner_street_address),
            street2: null,
            city: asString(values.joint_owner_city),
            state: asString(values.joint_owner_state),
            zip: asString(values.joint_owner_zip),
          },
          phone: asString(values.joint_owner_phone),
          email: asString(values.joint_owner_email) || null,
          usCitizen: true,
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
    investmentAllocations: [],
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
          ownerSsn: encryptedValue(values.surrendering_owner_ssn),
          jointOwnerName: asString(values.surrendering_joint_owner_name) || null,
          jointOwnerSsn: asString(values.surrendering_joint_owner_ssn)
            ? encryptedValue(values.surrendering_joint_owner_ssn)
            : null,
          annuitantName: asString(values.surrendering_annuitant_name) || null,
          annuitantSsn: asString(values.surrendering_annuitant_ssn)
            ? encryptedValue(values.surrendering_annuitant_ssn)
            : null,
          jointAnnuitantName: asString(values.surrendering_joint_annuitant_name) || null,
          jointAnnuitantSsn: asString(values.surrendering_joint_annuitant_ssn)
            ? encryptedValue(values.surrendering_joint_annuitant_ssn)
            : null,
          contingentAnnuitantName: asString(values.surrendering_contingent_annuitant_name) || null,
          contingentAnnuitantSsn: asString(values.surrendering_contingent_annuitant_ssn)
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
          rmdAcknowledged: asBool(values.rmd_acknowledged),
          partial1035Acknowledged: asBool(values.partial_1035_acknowledged),
          tsa403bTransferAcknowledged: asBool(values.tsa_403b_transfer_acknowledged),
          generalDisclosuresAcknowledged: asBool(values.general_disclosures_acknowledged),
          backupWithholding: asBool(values.backup_withholding),
          taxpayerCertificationAcknowledged: asBool(values.taxpayer_certification_acknowledged),
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
      ownerStatementAcknowledged: asBool(values.owner_statement_acknowledged),
      fraudWarningAcknowledged: asBool(values.fraud_warning_acknowledged),
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
    agentCertification: {
      agentAwareOfExistingInsurance: asBool(values.agent_replacement_existing),
      agentBelievesReplacement: asBool(values.agent_replacement_replacing),
      replacingCompanyName: asString(values.agent_replacement_company) || null,
      writingAgents: [],
    },
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
        <Paper key={page.id} variant="outlined" sx={{ p: 2.5, borderColor: 'success.light' }}>
          <Typography variant="subtitle1" fontWeight="bold" color="primary.main" gutterBottom>
            {page.title}
          </Typography>
          <Stack spacing={1.25}>
            {page.questions.map((question) => {
              const rawValue = values[question.id];
              const displayValue = Array.isArray(rawValue)
                ? `${rawValue.length} item${rawValue.length === 1 ? '' : 's'}`
                : typeof rawValue === 'boolean'
                ? rawValue
                  ? 'Yes'
                  : 'No'
                : rawValue || 'Not provided';

              return (
                <Stack key={question.id} direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    {question.label}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
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

function WizardPageContent() {
  const { pages, values, validatePage, populateWithDummyData } = useWizardV2Controller();
  const [currentStep, setCurrentStep] = useState(0);
  const [showSubmissionBanner, setShowSubmissionBanner] = useState(false);

  const isReviewStep = currentStep === pages.length;
  const totalSteps = pages.length + 1;
  const progress = (currentStep / (totalSteps - 1)) * 100;

  const currentPage = isReviewStep ? null : pages[currentStep];

  const stepLabel = useMemo(() => {
    if (isReviewStep) {
      return 'Review & Submit';
    }

    return currentPage?.title ?? '';
  }, [currentPage, isReviewStep]);

  const handleNext = () => {
    if (!isReviewStep && currentPage && !validatePage(currentPage)) {
      return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    const submissionPayload = buildSubmissionPayload(values as AnswerMap);
    console.log('eapp_submission_payload', submissionPayload);
    setShowSubmissionBanner(true);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <WizardSidebar pages={pages} currentStep={currentStep} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <LinearProgress variant="determinate" value={progress} color="success" sx={{ height: 6 }} />

        <Box sx={{ p: { xs: 2, md: 4 }, flex: 1 }}>
          <Box sx={{ maxWidth: 860, mx: 'auto' }}>
            <Paper
              variant="outlined"
              sx={{ mb: 3, p: { xs: 2.5, md: 3 }, borderColor: 'success.light', bgcolor: 'background.paper' }}
            >
              <Typography variant="h5" component="h1" fontWeight="bold" color="primary.main" gutterBottom>
                {APPLICATION_DEFINITION.productName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {APPLICATION_DEFINITION.description}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip label={APPLICATION_DEFINITION.carrier} color="success" size="small" />
                <Chip label={`Step ${currentStep + 1} of ${totalSteps}`} variant="outlined" color="success" size="small" />
                <Typography variant="caption" color="text.secondary">
                  Active section: {stepLabel}
                </Typography>
                <Button size="small" variant="outlined" color="success" onClick={populateWithDummyData}>
                  Fill Dummy Data
                </Button>
              </Stack>
            </Paper>

            {showSubmissionBanner && (
              <Alert icon={<CheckIcon fontSize="inherit" />} severity="success" sx={{ mb: 3 }}>
                Application submitted successfully. You can review data and navigate back if updates are needed.
              </Alert>
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
                  {currentPage.questions.map((question) => (
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
          </Box>
        </Box>

        <Divider />
        <Box
          sx={{
            p: { xs: 2, md: 3 },
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
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                disabled={currentStep === 0}
                color="inherit"
              >
                Back
              </Button>

              <Stack direction="row" spacing={1.5}>
                {!isReviewStep && (
                  <Button variant="contained" color="success" endIcon={<ArrowForwardIcon />} onClick={handleNext}>
                    Save & Next
                  </Button>
                )}
                {isReviewStep && (
                  <Button variant="contained" color="success" onClick={handleSubmit}>
                    Submit Application
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function WizardPageV2() {
  return (
    <ThemeProvider theme={greenWizardTheme}>
      <WizardV2FormProvider>
        <WizardPageContent />
      </WizardV2FormProvider>
    </ThemeProvider>
  );
}

export default WizardPageV2;
