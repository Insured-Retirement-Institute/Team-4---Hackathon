import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Alert from '@mui/material/Alert';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import DescriptionIcon from '@mui/icons-material/Description';
import { useWizardFormController } from '../formController';

const FUNDING_METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer (ACH)', icon: <AccountBalanceIcon /> },
  { id: 'wire', label: '1035 Exchange / Rollover', icon: <SyncAltIcon /> },
  { id: 'check', label: 'Check / Money Order', icon: <DescriptionIcon /> },
];

function PaymentSetupStep() {
  const { values, errors, setValue } = useWizardFormController();
  const fundingMethod = values.fundingMethod;

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
          Payment Setup
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select how you will fund this annuity contract.
        </Typography>
      </div>

      {/* Funding method selection */}
      <Grid container spacing={2}>
        {FUNDING_METHODS.map((method) => (
          <Grid key={method.id} size={{ xs: 12, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{
                borderColor: fundingMethod === method.id ? 'primary.main' : 'divider',
                borderWidth: fundingMethod === method.id ? 2 : 1,
              }}
            >
              <CardActionArea onClick={() => setValue('fundingMethod', method.id)}>
                <CardContent>
                  <Stack spacing={1} alignItems="center" sx={{ textAlign: 'center', py: 1 }}>
                    <Box sx={{ color: fundingMethod === method.id ? 'primary.main' : 'text.secondary' }}>
                      {method.icon}
                    </Box>
                    <Typography variant="body2" fontWeight={fundingMethod === method.id ? 'bold' : 'normal'}>
                      {method.label}
                    </Typography>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider />

      {fundingMethod === 'bank_transfer' && (
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight="medium">
            Bank Account Details
          </Typography>
          <Alert severity="info" variant="outlined">
            A small test deposit may be made to verify your account before transfer.
          </Alert>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Account Type"
                fullWidth
                value={values.bankAccountType}
                onChange={(event) => setValue('bankAccountType', event.target.value)}
                error={Boolean(errors.bankAccountType)}
                helperText={errors.bankAccountType}
              >
                <MenuItem value="">Select</MenuItem>
                <MenuItem value="checking">Checking</MenuItem>
                <MenuItem value="savings">Savings</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Bank Name"
                fullWidth
                placeholder="e.g. Chase Bank"
                value={values.bankName}
                onChange={(event) => setValue('bankName', event.target.value)}
                error={Boolean(errors.bankName)}
                helperText={errors.bankName}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Routing Number"
                fullWidth
                required
                placeholder="9-digit ABA number"
                value={values.bankRoutingNumber}
                onChange={(event) => setValue('bankRoutingNumber', event.target.value)}
                error={Boolean(errors.bankRoutingNumber)}
                helperText={errors.bankRoutingNumber}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Account Number"
                fullWidth
                required
                placeholder="Your account number"
                value={values.bankAccountNumber}
                onChange={(event) => setValue('bankAccountNumber', event.target.value)}
                error={Boolean(errors.bankAccountNumber)}
                helperText={errors.bankAccountNumber}
              />
            </Grid>
          </Grid>
        </Stack>
      )}

      {fundingMethod === 'wire' && (
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight="medium">
            1035 Exchange / Rollover Details
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Transferring Institution"
                fullWidth
                required
                placeholder="e.g. Fidelity"
                value={values.transferInstitution}
                onChange={(event) => setValue('transferInstitution', event.target.value)}
                error={Boolean(errors.transferInstitution)}
                helperText={errors.transferInstitution}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Existing Policy / Account Number"
                fullWidth
                required
                value={values.transferAccountNumber}
                onChange={(event) => setValue('transferAccountNumber', event.target.value)}
                error={Boolean(errors.transferAccountNumber)}
                helperText={errors.transferAccountNumber}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Transfer Type"
                fullWidth
                value={values.transferType}
                onChange={(event) => setValue('transferType', event.target.value)}
                error={Boolean(errors.transferType)}
                helperText={errors.transferType}
              >
                <MenuItem value="">Select</MenuItem>
                <MenuItem value="full">Full Transfer</MenuItem>
                <MenuItem value="partial">Partial Transfer</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Transfer Amount"
                fullWidth
                placeholder="e.g. 50,000"
                value={values.transferAmount}
                onChange={(event) => setValue('transferAmount', event.target.value)}
                error={Boolean(errors.transferAmount)}
                helperText={errors.transferAmount}
                slotProps={{ input: { startAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>$</Typography> } }}
              />
            </Grid>
          </Grid>
        </Stack>
      )}

      {fundingMethod === 'check' && (
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight="medium">
            Check Instructions
          </Typography>
          <Alert severity="warning" variant="outlined">
            Make check payable to <strong>Annuity Services LLC</strong> and mail to the address below. Processing takes 5–7 business days upon receipt.
          </Alert>
          <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Typography variant="body2" color="text.secondary">Mail to:</Typography>
            <Typography variant="body2" fontWeight="medium">
              Annuity Services LLC<br />
              Attn: New Applications<br />
              123 Financial Ave, Suite 400<br />
              New York, NY 10001
            </Typography>
          </Box>
        </Stack>
      )}
    </Stack>
  );
}

export default PaymentSetupStep;
