import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';

function SuitabilityReviewStep() {
  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
          Suitability Review
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Regulators require us to confirm this product is appropriate for your financial objectives and time horizon.
        </Typography>
      </div>

      <Alert severity="warning" variant="outlined">
        This section is required by FINRA and state insurance regulators. Please answer all questions honestly.
      </Alert>

      <Divider />

      <Typography variant="subtitle1" fontWeight="medium">
        Investment Objectives
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select label="Primary Investment Objective" fullWidth defaultValue="">
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="preservation">Capital Preservation</MenuItem>
            <MenuItem value="income">Income Generation</MenuItem>
            <MenuItem value="growth">Growth</MenuItem>
            <MenuItem value="speculation">Speculation</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select label="Investment Time Horizon" fullWidth defaultValue="">
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="short">Short Term (under 3 years)</MenuItem>
            <MenuItem value="medium">Medium Term (3–7 years)</MenuItem>
            <MenuItem value="long">Long Term (7+ years)</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select label="Expected Need for Funds" fullWidth defaultValue="">
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="no_need">No foreseeable need</MenuItem>
            <MenuItem value="within_3">Within 3 years</MenuItem>
            <MenuItem value="within_7">Within 7 years</MenuItem>
            <MenuItem value="retirement">At retirement</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select label="Reaction to Market Loss" fullWidth defaultValue="">
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="sell">Sell to prevent further loss</MenuItem>
            <MenuItem value="hold">Hold and wait for recovery</MenuItem>
            <MenuItem value="buy_more">Buy more at lower prices</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      <Divider />

      <Typography variant="subtitle1" fontWeight="medium">
        Existing Annuity / Replacement Disclosure
      </Typography>

      <Stack spacing={2}>
        <FormControlLabel
          control={<Checkbox />}
          label={
            <Typography variant="body2">
              This application is replacing an existing annuity or life insurance policy (1035 Exchange)
            </Typography>
          }
        />
        <FormControlLabel
          control={<Checkbox />}
          label={
            <Typography variant="body2">
              I have been informed of all surrender charges and fees associated with this product
            </Typography>
          }
        />
        <FormControlLabel
          control={<Checkbox />}
          label={
            <Typography variant="body2">
              I understand this annuity has a surrender period during which withdrawals may be subject to charges
            </Typography>
          }
        />
      </Stack>

      <Divider />

      <Typography variant="subtitle1" fontWeight="medium">
        Applicant Acknowledgment
      </Typography>

      <TextField
        label="Additional Notes (Optional)"
        multiline
        rows={3}
        fullWidth
        placeholder="Any additional context about the applicant's financial situation or objectives..."
      />

      <FormControlLabel
        control={<Checkbox color="primary" />}
        label={
          <Typography variant="body2">
            I confirm the information provided in this application is accurate and complete to the best of my knowledge.
          </Typography>
        }
      />
    </Stack>
  );
}

export default SuitabilityReviewStep;
