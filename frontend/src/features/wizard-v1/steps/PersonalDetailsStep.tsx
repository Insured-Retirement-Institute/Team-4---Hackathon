import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import { useWizardFormController } from '../formController';

function PersonalDetailsStep() {
  const { values, errors, setValue } = useWizardFormController();

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
          Personal Details
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please provide the applicant's personal information as it appears on official government-issued ID.
        </Typography>
      </div>

      <Divider />

      <Typography variant="subtitle1" fontWeight="medium">
        Basic Information
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            select
            label="Title"
            fullWidth
            value={values.title}
            onChange={(event) => setValue('title', event.target.value)}
          >
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="mr">Mr.</MenuItem>
            <MenuItem value="mrs">Mrs.</MenuItem>
            <MenuItem value="ms">Ms.</MenuItem>
            <MenuItem value="dr">Dr.</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="First Name"
            fullWidth
            required
            placeholder="e.g. John"
            value={values.firstName}
            onChange={(event) => setValue('firstName', event.target.value)}
            error={Boolean(errors.firstName)}
            helperText={errors.firstName}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            label="Last Name"
            fullWidth
            required
            placeholder="e.g. Smith"
            value={values.lastName}
            onChange={(event) => setValue('lastName', event.target.value)}
            error={Boolean(errors.lastName)}
            helperText={errors.lastName}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Date of Birth"
            type="date"
            fullWidth
            required
            value={values.dateOfBirth}
            onChange={(event) => setValue('dateOfBirth', event.target.value)}
            error={Boolean(errors.dateOfBirth)}
            helperText={errors.dateOfBirth}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Social Security Number"
            fullWidth
            required
            placeholder="XXX-XX-XXXX"
            value={values.ssn}
            onChange={(event) => setValue('ssn', event.target.value)}
            error={Boolean(errors.ssn)}
            helperText={errors.ssn ?? 'Your SSN is encrypted and stored securely'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label="Marital Status"
            fullWidth
            value={values.maritalStatus}
            onChange={(event) => setValue('maritalStatus', event.target.value)}
          >
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="single">Single</MenuItem>
            <MenuItem value="married">Married</MenuItem>
            <MenuItem value="divorced">Divorced</MenuItem>
            <MenuItem value="widowed">Widowed</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            select
            label="Citizenship Status"
            fullWidth
            value={values.citizenshipStatus}
            onChange={(event) => setValue('citizenshipStatus', event.target.value)}
          >
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="us_citizen">U.S. Citizen</MenuItem>
            <MenuItem value="permanent_resident">Permanent Resident</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      <Divider />

      <Typography variant="subtitle1" fontWeight="medium">
        Contact Information
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Email Address"
            type="email"
            fullWidth
            required
            placeholder="john.smith@email.com"
            value={values.email}
            onChange={(event) => setValue('email', event.target.value)}
            error={Boolean(errors.email)}
            helperText={errors.email}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Phone Number"
            fullWidth
            required
            placeholder="+1 (555) 000-0000"
            value={values.phone}
            onChange={(event) => setValue('phone', event.target.value)}
            error={Boolean(errors.phone)}
            helperText={errors.phone}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            label="Residential Address"
            fullWidth
            required
            placeholder="123 Main Street"
            value={values.address}
            onChange={(event) => setValue('address', event.target.value)}
            error={Boolean(errors.address)}
            helperText={errors.address}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="City"
            fullWidth
            required
            value={values.city}
            onChange={(event) => setValue('city', event.target.value)}
            error={Boolean(errors.city)}
            helperText={errors.city}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="State"
            fullWidth
            required
            placeholder="e.g. CA"
            value={values.state}
            onChange={(event) => setValue('state', event.target.value)}
            error={Boolean(errors.state)}
            helperText={errors.state}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="ZIP Code"
            fullWidth
            required
            placeholder="e.g. 90210"
            value={values.zipCode}
            onChange={(event) => setValue('zipCode', event.target.value)}
            error={Boolean(errors.zipCode)}
            helperText={errors.zipCode}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}

export default PersonalDetailsStep;
