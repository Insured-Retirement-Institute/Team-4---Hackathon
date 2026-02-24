import { useState } from 'react';
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
import Chip from '@mui/material/Chip';

const ANNUITY_TYPES = [
  {
    id: 'fixed',
    label: 'Fixed Annuity',
    description: 'Guaranteed interest rate with principal protection.',
    badge: 'Most Popular',
  },
  {
    id: 'fixed_indexed',
    label: 'Fixed Indexed Annuity',
    description: 'Returns linked to a market index with downside protection.',
    badge: 'Recommended',
  },
  {
    id: 'variable',
    label: 'Variable Annuity',
    description: 'Market-based returns with higher growth potential.',
    badge: null,
  },
];

function AnnuitySelectionStep() {
  const [selectedType, setSelectedType] = useState('fixed_indexed');

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h5" component="h2" fontWeight="bold" gutterBottom>
          Annuity Selection
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choose the annuity product type and configure your contract terms.
        </Typography>
      </div>

      {/* Product type cards */}
      <Grid container spacing={2}>
        {ANNUITY_TYPES.map((type) => (
          <Grid key={type.id} size={{ xs: 12, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{
                borderColor: selectedType === type.id ? 'primary.main' : 'divider',
                borderWidth: selectedType === type.id ? 2 : 1,
                transition: 'border-color 0.2s',
              }}
            >
              <CardActionArea onClick={() => setSelectedType(type.id)} sx={{ p: 0 }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: selectedType === type.id ? 'primary.main' : 'text.disabled',
                          bgcolor: selectedType === type.id ? 'primary.main' : 'transparent',
                          flexShrink: 0,
                        }}
                      />
                      {type.badge && (
                        <Chip label={type.badge} size="small" color="primary" />
                      )}
                    </Stack>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {type.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                      {type.description}
                    </Typography>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider />

      <Typography variant="subtitle1" fontWeight="medium">
        Contract Terms
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select label="Surrender Period" fullWidth defaultValue="">
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="3">3 Years</MenuItem>
            <MenuItem value="5">5 Years</MenuItem>
            <MenuItem value="7">7 Years</MenuItem>
            <MenuItem value="10">10 Years</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select label="Payout Option" fullWidth defaultValue="">
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="lump_sum">Lump Sum</MenuItem>
            <MenuItem value="lifetime">Lifetime Income</MenuItem>
            <MenuItem value="period_certain">Period Certain</MenuItem>
            <MenuItem value="joint_survivor">Joint & Survivor</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Initial Premium Amount"
            fullWidth
            required
            placeholder="e.g. 100,000"
            helperText="Minimum premium: $10,000"
            slotProps={{ input: { startAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>$</Typography> } }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select label="Qualified / Non-Qualified" fullWidth defaultValue="">
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="qualified_ira">Qualified – Traditional IRA</MenuItem>
            <MenuItem value="qualified_roth">Qualified – Roth IRA</MenuItem>
            <MenuItem value="qualified_401k">Qualified – 401(k) Rollover</MenuItem>
            <MenuItem value="non_qualified">Non-Qualified</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField select label="Optional Rider" fullWidth defaultValue="">
            <MenuItem value="">None</MenuItem>
            <MenuItem value="gmwb">Guaranteed Min. Withdrawal Benefit</MenuItem>
            <MenuItem value="glwb">Guaranteed Lifetime Withdrawal Benefit</MenuItem>
            <MenuItem value="death_benefit">Enhanced Death Benefit</MenuItem>
            <MenuItem value="ltc">Long-Term Care Rider</MenuItem>
          </TextField>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default AnnuitySelectionStep;
