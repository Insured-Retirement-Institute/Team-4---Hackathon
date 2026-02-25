import { useEffect, useState } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { type Distributor, getDistributors } from '../../../../services/apiService';

type ApprovedDistributorsPanelProps = {
  selectedDistributorIds: string[];
  onToggleDistributor: (distributorId: string) => void;
};

function ApprovedDistributorsPanel({
  selectedDistributorIds,
  onToggleDistributor,
}: ApprovedDistributorsPanelProps) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    getDistributors()
      .then((data) => setDistributors(data))
      .catch((fetchError) => {
        console.error('Failed to load distributors for App Builder:', fetchError);
        setError('Unable to load distributors.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Approved Distributors
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Select one or more approved distributors.
      </Typography>

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Loading distributors...
        </Typography>
      ) : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && !error ? (
        <Grid container spacing={1.5}>
          {distributors.map((distributor) => {
            const selected = selectedDistributorIds.includes(distributor.distributorId);
            return (
              <Grid key={distributor.distributorId} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    borderWidth: 2,
                    borderColor: selected ? 'primary.main' : 'divider',
                    bgcolor: selected ? 'rgba(58,157,247,0.08)' : '#fff',
                  }}
                >
                  <CardActionArea onClick={() => onToggleDistributor(distributor.distributorId)}>
                    <CardContent sx={{ py: 1.5 }}>
                      <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color={selected ? 'primary.main' : 'text.secondary'}>
                            Distributor
                          </Typography>
                          {selected ? <CheckCircleIcon sx={{ fontSize: 16, color: 'primary.main' }} /> : null}
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: selected ? 'primary.main' : 'text.primary' }}>
                          {distributor.name}
                        </Typography>
                        <Box>
                          <Typography variant="caption" color={selected ? 'primary.main' : 'text.secondary'}>
                            {distributor.distributorId}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : null}

      {!loading && !error ? (
        <Typography variant="caption" color="text.secondary">
          {selectedDistributorIds.length} distributor{selectedDistributorIds.length === 1 ? '' : 's'} selected
        </Typography>
      ) : null}

    </Stack>
  );
}

export default ApprovedDistributorsPanel;
