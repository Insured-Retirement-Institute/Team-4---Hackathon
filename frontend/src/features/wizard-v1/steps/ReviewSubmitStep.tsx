import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useWizardFormController } from '../formController';

interface ReviewRowProps {
  label: string;
  value: string;
}

function ReviewRow({ label, value }: ReviewRowProps) {
  return (
    <Grid container>
      <Grid size={{ xs: 5 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Grid>
      <Grid size={{ xs: 7 }}>
        <Typography variant="body2" fontWeight="medium">{value}</Typography>
      </Grid>
    </Grid>
  );
}

interface ReviewSectionProps {
  title: string;
  stepNumber: number;
  children: React.ReactNode;
}

function ReviewSection({ title, stepNumber, children }: ReviewSectionProps) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Chip label={stepNumber} size="small" color="primary" sx={{ width: 24, height: 24, fontSize: 11 }} />
        <Typography variant="subtitle2" fontWeight="bold">{title}</Typography>
        <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main', ml: 'auto !important' }} />
      </Stack>
      <Box sx={{ pl: 4 }}>
        <Stack spacing={0.75}>{children}</Stack>
      </Box>
    </Box>
  );
}

function ReviewSubmitStep() {
  const { values } = useWizardFormController();
  const displayValue = (value: string) => (value.trim() ? value : '—');
  const maskedSsn = values.ssn ? `••• - •• - ${values.ssn.slice(-4)}` : '—';
  const primaryBeneficiary = values.primaryBeneficiaryName
    ? `${values.primaryBeneficiaryName} (${displayValue(values.primaryBeneficiaryRelationship)}) — ${displayValue(values.primaryBeneficiaryPercentage)}%`
    : '—';
  const contingentBeneficiary = values.contingentBeneficiaryName
    ? `${values.contingentBeneficiaryName} (${displayValue(values.contingentBeneficiaryRelationship)}) — ${displayValue(values.contingentBeneficiaryPercentage)}%`
    : '—';
  const disclosuresAcknowledged = [
    values.replacingExistingAnnuity,
    values.informedOfSurrenderCharges,
    values.understandsSurrenderPeriod,
  ].filter(Boolean).length;

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
          Review & Submit
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please review all information before submitting your annuity application.
        </Typography>
      </div>

      <Alert severity="success" variant="outlined" icon={<CheckCircleOutlineIcon />}>
        All sections are complete. Your application is ready to submit.
      </Alert>

      <Divider />

      <Stack spacing={3} divider={<Divider />}>
        <ReviewSection title="Personal Details" stepNumber={1}>
          <ReviewRow label="Name" value={displayValue(`${values.firstName} ${values.lastName}`.trim())} />
          <ReviewRow label="Date of Birth" value={displayValue(values.dateOfBirth)} />
          <ReviewRow label="SSN" value={maskedSsn} />
          <ReviewRow
            label="Address"
            value={displayValue(`${values.address}, ${values.city}, ${values.state} ${values.zipCode}`.replace(/\s+/g, ' ').trim())}
          />
          <ReviewRow label="Email" value={displayValue(values.email)} />
        </ReviewSection>

        <ReviewSection title="Beneficiary" stepNumber={2}>
          <ReviewRow label="Primary" value={primaryBeneficiary} />
          <ReviewRow label="Contingent" value={contingentBeneficiary} />
        </ReviewSection>

        <ReviewSection title="Financial Profile" stepNumber={3}>
          <ReviewRow label="Annual Income" value={displayValue(values.annualHouseholdIncome)} />
          <ReviewRow label="Net Worth" value={displayValue(values.estimatedNetWorth)} />
          <ReviewRow label="Source of Funds" value={displayValue(values.sourceOfFunds)} />
          <ReviewRow label="Risk Tolerance" value={displayValue(values.riskTolerance)} />
        </ReviewSection>

        <ReviewSection title="Annuity Selection" stepNumber={4}>
          <ReviewRow label="Product Type" value={displayValue(values.annuityType)} />
          <ReviewRow label="Surrender Period" value={displayValue(values.surrenderPeriod)} />
          <ReviewRow label="Premium Amount" value={displayValue(values.initialPremiumAmount)} />
          <ReviewRow label="Qualification" value={displayValue(values.qualificationType)} />
          <ReviewRow label="Rider" value={displayValue(values.optionalRider)} />
        </ReviewSection>

        <ReviewSection title="Payment Setup" stepNumber={5}>
          <ReviewRow label="Funding Method" value={displayValue(values.fundingMethod)} />
          {values.fundingMethod === 'bank_transfer' && (
            <>
              <ReviewRow label="Bank" value={displayValue(`${values.bankName} — ${values.bankAccountType}`)} />
              <ReviewRow label="Routing" value={displayValue(values.bankRoutingNumber)} />
              <ReviewRow label="Account" value={displayValue(values.bankAccountNumber)} />
            </>
          )}
          {values.fundingMethod === 'wire' && (
            <>
              <ReviewRow label="Institution" value={displayValue(values.transferInstitution)} />
              <ReviewRow label="Account / Policy" value={displayValue(values.transferAccountNumber)} />
              <ReviewRow label="Transfer Type" value={displayValue(values.transferType)} />
              <ReviewRow label="Transfer Amount" value={displayValue(values.transferAmount)} />
            </>
          )}
        </ReviewSection>

        <ReviewSection title="Suitability Review" stepNumber={6}>
          <ReviewRow label="Objective" value={displayValue(values.primaryObjective)} />
          <ReviewRow label="Time Horizon" value={displayValue(values.investmentTimeHorizon)} />
          <ReviewRow label="Disclosures" value={`${disclosuresAcknowledged}/3 acknowledged`} />
        </ReviewSection>
      </Stack>

      <Alert severity="info" variant="outlined">
        By submitting, you authorize the processing of this application. You will receive a confirmation email within 1 business day.
      </Alert>
    </Stack>
  );
}

export default ReviewSubmitStep;
