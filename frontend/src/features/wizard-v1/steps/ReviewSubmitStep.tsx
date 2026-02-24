import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

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
          <ReviewRow label="Name" value="John Smith" />
          <ReviewRow label="Date of Birth" value="March 15, 1962" />
          <ReviewRow label="SSN" value="••• - •• - 4321" />
          <ReviewRow label="Address" value="123 Main St, Los Angeles, CA 90210" />
          <ReviewRow label="Email" value="john.smith@email.com" />
        </ReviewSection>

        <ReviewSection title="Beneficiary" stepNumber={2}>
          <ReviewRow label="Primary" value="Jane Smith (Spouse) — 100%" />
          <ReviewRow label="Contingent" value="Robert Smith (Child) — 100%" />
        </ReviewSection>

        <ReviewSection title="Financial Profile" stepNumber={3}>
          <ReviewRow label="Annual Income" value="$100,000 – $200,000" />
          <ReviewRow label="Net Worth" value="$500,000 – $1,000,000" />
          <ReviewRow label="Source of Funds" value="Personal Savings" />
          <ReviewRow label="Risk Tolerance" value="Moderate" />
        </ReviewSection>

        <ReviewSection title="Annuity Selection" stepNumber={4}>
          <ReviewRow label="Product Type" value="Fixed Indexed Annuity" />
          <ReviewRow label="Surrender Period" value="7 Years" />
          <ReviewRow label="Premium Amount" value="$150,000" />
          <ReviewRow label="Qualification" value="Non-Qualified" />
          <ReviewRow label="Rider" value="Guaranteed Lifetime Withdrawal Benefit" />
        </ReviewSection>

        <ReviewSection title="Payment Setup" stepNumber={5}>
          <ReviewRow label="Funding Method" value="Bank Transfer (ACH)" />
          <ReviewRow label="Bank" value="Chase Bank – Checking" />
          <ReviewRow label="Routing" value="••••••021" />
          <ReviewRow label="Account" value="••••••7890" />
        </ReviewSection>

        <ReviewSection title="Suitability Review" stepNumber={6}>
          <ReviewRow label="Objective" value="Income Generation" />
          <ReviewRow label="Time Horizon" value="Long Term (7+ years)" />
          <ReviewRow label="Disclosures" value="All acknowledged" />
        </ReviewSection>
      </Stack>

      <Alert severity="info" variant="outlined">
        By submitting, you authorize the processing of this application. You will receive a confirmation email within 1 business day.
      </Alert>
    </Stack>
  );
}

export default ReviewSubmitStep;
