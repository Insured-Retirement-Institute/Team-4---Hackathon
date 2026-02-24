import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import { useWizardFormController } from '../formController';

function FinancialProfileStep() {
  const { values, errors, setValue } = useWizardFormController();

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
          Financial Profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This information helps us ensure the annuity product is suitable for your financial situation.
        </Typography>
      </div>

      <Alert severity="info" variant="outlined">
        All financial information is used solely for suitability assessment and is kept strictly confidential.
      </Alert>

      <Divider />

      <Typography variant="subtitle1" fontWeight="medium">
        Income
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label="Employment Status"
            fullWidth
            value={values.employmentStatus}
            onChange={(event) => setValue('employmentStatus', event.target.value)}
            error={Boolean(errors.employmentStatus)}
            helperText={errors.employmentStatus}
          >
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="employed">Employed</MenuItem>
            <MenuItem value="self_employed">Self-Employed</MenuItem>
            <MenuItem value="retired">Retired</MenuItem>
            <MenuItem value="unemployed">Unemployed</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label="Annual Household Income"
            fullWidth
            value={values.annualHouseholdIncome}
            onChange={(event) => setValue('annualHouseholdIncome', event.target.value)}
            error={Boolean(errors.annualHouseholdIncome)}
            helperText={errors.annualHouseholdIncome}
          >
            <MenuItem value="">Select range</MenuItem>
            <MenuItem value="under_50k">Under $50,000</MenuItem>
            <MenuItem value="50k_100k">$50,000 – $100,000</MenuItem>
            <MenuItem value="100k_200k">$100,000 – $200,000</MenuItem>
            <MenuItem value="200k_500k">$200,000 – $500,000</MenuItem>
            <MenuItem value="over_500k">Over $500,000</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label="Source of Funds"
            fullWidth
            value={values.sourceOfFunds}
            onChange={(event) => setValue('sourceOfFunds', event.target.value)}
            error={Boolean(errors.sourceOfFunds)}
            helperText={errors.sourceOfFunds}
          >
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="savings">Personal Savings</MenuItem>
            <MenuItem value="ira_rollover">IRA / 401(k) Rollover</MenuItem>
            <MenuItem value="inheritance">Inheritance</MenuItem>
            <MenuItem value="business_proceeds">Business Proceeds</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label="Federal Tax Bracket"
            fullWidth
            value={values.federalTaxBracket}
            onChange={(event) => setValue('federalTaxBracket', event.target.value)}
          >
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="10">10%</MenuItem>
            <MenuItem value="12">12%</MenuItem>
            <MenuItem value="22">22%</MenuItem>
            <MenuItem value="24">24%</MenuItem>
            <MenuItem value="32">32%</MenuItem>
            <MenuItem value="35">35%</MenuItem>
            <MenuItem value="37">37%</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      <Divider />

      <Typography variant="subtitle1" fontWeight="medium">
        Net Worth & Assets
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label="Estimated Net Worth"
            fullWidth
            value={values.estimatedNetWorth}
            onChange={(event) => setValue('estimatedNetWorth', event.target.value)}
          >
            <MenuItem value="">Select range</MenuItem>
            <MenuItem value="under_100k">Under $100,000</MenuItem>
            <MenuItem value="100k_500k">$100,000 – $500,000</MenuItem>
            <MenuItem value="500k_1m">$500,000 – $1,000,000</MenuItem>
            <MenuItem value="1m_5m">$1M – $5M</MenuItem>
            <MenuItem value="over_5m">Over $5M</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label="Liquid Net Worth"
            fullWidth
            value={values.liquidNetWorth}
            onChange={(event) => setValue('liquidNetWorth', event.target.value)}
          >
            <MenuItem value="">Select range</MenuItem>
            <MenuItem value="under_50k">Under $50,000</MenuItem>
            <MenuItem value="50k_250k">$50,000 – $250,000</MenuItem>
            <MenuItem value="250k_1m">$250,000 – $1,000,000</MenuItem>
            <MenuItem value="over_1m">Over $1,000,000</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label="Investment Experience"
            fullWidth
            value={values.investmentExperience}
            onChange={(event) => setValue('investmentExperience', event.target.value)}
          >
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="none">None</MenuItem>
            <MenuItem value="limited">Limited (1–3 years)</MenuItem>
            <MenuItem value="moderate">Moderate (3–10 years)</MenuItem>
            <MenuItem value="extensive">Extensive (10+ years)</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label="Risk Tolerance"
            fullWidth
            value={values.riskTolerance}
            onChange={(event) => setValue('riskTolerance', event.target.value)}
            error={Boolean(errors.riskTolerance)}
            helperText={errors.riskTolerance}
          >
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="conservative">Conservative</MenuItem>
            <MenuItem value="moderate">Moderate</MenuItem>
            <MenuItem value="aggressive">Aggressive</MenuItem>
          </TextField>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default FinancialProfileStep;
