import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

function BeneficiaryStep() {
  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
          Beneficiary Information
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Designate who will receive the annuity benefits. Percentages across all primary beneficiaries must total 100%.
        </Typography>
      </div>

      <Divider />

      {/* Primary Beneficiary */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="medium">
            Primary Beneficiary
          </Typography>
          <Chip label="Required" size="small" color="primary" variant="outlined" />
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Full Name" fullWidth required placeholder="e.g. Jane Smith" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="Relationship" fullWidth defaultValue="">
              <MenuItem value="">Select</MenuItem>
              <MenuItem value="spouse">Spouse</MenuItem>
              <MenuItem value="child">Child</MenuItem>
              <MenuItem value="parent">Parent</MenuItem>
              <MenuItem value="sibling">Sibling</MenuItem>
              <MenuItem value="trust">Trust</MenuItem>
              <MenuItem value="estate">Estate</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Date of Birth"
              type="date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="SSN / Tax ID" fullWidth placeholder="XXX-XX-XXXX" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Benefit Percentage"
              fullWidth
              required
              placeholder="100"
              helperText="Enter a value between 1–100"
              slotProps={{ input: { endAdornment: <Typography variant="body2" color="text.secondary">%</Typography> } }}
            />
          </Grid>
        </Grid>
      </Box>

      <Divider />

      {/* Contingent Beneficiary */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="medium">
            Contingent Beneficiary
          </Typography>
          <Chip label="Optional" size="small" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Receives benefits if all primary beneficiaries predecease the annuitant.
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Full Name" fullWidth placeholder="e.g. Robert Smith" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="Relationship" fullWidth defaultValue="">
              <MenuItem value="">Select</MenuItem>
              <MenuItem value="spouse">Spouse</MenuItem>
              <MenuItem value="child">Child</MenuItem>
              <MenuItem value="parent">Parent</MenuItem>
              <MenuItem value="sibling">Sibling</MenuItem>
              <MenuItem value="trust">Trust</MenuItem>
              <MenuItem value="estate">Estate</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Date of Birth"
              type="date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Benefit Percentage"
              fullWidth
              placeholder="100"
              slotProps={{ input: { endAdornment: <Typography variant="body2" color="text.secondary">%</Typography> } }}
            />
          </Grid>
        </Grid>
      </Box>
    </Stack>
  );
}

export default BeneficiaryStep;
