import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HistoryIcon from '@mui/icons-material/History';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { listApplications, getProducts, type ApplicationInstance, type Product } from '../services/apiService';

interface EnrichedApplication extends ApplicationInstance {
  productName: string;
  carrier: string;
  version: string;
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ApplicationHistoryPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<EnrichedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listApplications(), getProducts()])
      .then(([apps, products]) => {
        const productMap = new Map<string, Product>(products.map((p) => [p.productId, p]));
        const enriched: EnrichedApplication[] = apps
          .map((app) => {
            const product = productMap.get(app.productId);
            return {
              ...app,
              productName: product?.productName ?? app.productId,
              carrier: product?.carrier ?? '',
              version: product?.version ?? '',
            };
          })
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setApplications(enriched);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load applications'))
      .finally(() => setLoading(false));
  }, []);

  const handleContinue = (app: EnrichedApplication) => {
    navigate(`/wizard-v2/${encodeURIComponent(app.productId)}?resume=${app.id}`);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <LinearProgress variant="determinate" value={100} color="primary" sx={{ height: 4 }} />

      <Box sx={{ p: { xs: 2, md: 6 }, maxWidth: 860, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <HistoryIcon color="primary" />
          <Typography variant="h4" fontWeight={800} letterSpacing="-0.5px">
            Application History
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary" mb={5}>
          Pick up where you left off or review submitted applications.
        </Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress color="primary" />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && applications.length === 0 && (
          <Card
            elevation={0}
            sx={{ border: '1px dashed', borderColor: 'divider', textAlign: 'center', p: { xs: 4, md: 8 } }}
          >
            <DescriptionOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No saved applications yet
            </Typography>
            <Typography variant="body2" color="text.disabled" mb={3}>
              Applications you start will appear here so you can pick up where you left off.
            </Typography>
            <Button variant="contained" color="primary" onClick={() => navigate('/wizard-v2')}>
              Start an Application
            </Button>
          </Card>
        )}

        {!loading && !error && applications.length > 0 && (
          <Stack spacing={2}>
            {applications.map((app) => (
              <Card
                key={app.id}
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: app.status === 'submitted' ? 'success.light' : 'divider',
                  bgcolor: 'background.paper',
                  transition: 'box-shadow 0.15s',
                  '&:hover': { boxShadow: 2 },
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ sm: 'center' }}
                    justifyContent="space-between"
                  >
                    {/* Left: icon + details */}
                    <Stack direction="row" spacing={2} alignItems="center" flex={1} minWidth={0}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2,
                          bgcolor: app.status === 'submitted' ? 'success.50' : 'grey.100',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: app.status === 'submitted' ? 'success.main' : 'text.secondary',
                          flexShrink: 0,
                        }}
                      >
                        <DescriptionOutlinedIcon fontSize="small" />
                      </Box>

                      <Box minWidth={0}>
                        {app.carrier && (
                          <Typography
                            variant="overline"
                            color="text.secondary"
                            sx={{ fontSize: 10, letterSpacing: 1, lineHeight: 1.2, display: 'block' }}
                          >
                            {app.carrier}
                          </Typography>
                        )}
                        <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2} noWrap>
                          {app.productName}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap">
                          <Chip
                            label={app.status === 'submitted' ? 'Submitted' : 'In Progress'}
                            size="small"
                            color={app.status === 'submitted' ? 'success' : 'warning'}
                            sx={{ height: 20, fontSize: 10 }}
                          />
                          <Typography variant="caption" color="text.disabled">
                            Updated {relativeTime(app.updatedAt)}
                          </Typography>
                          {app.version && (
                            <Typography variant="caption" color="text.disabled">
                              · v{app.version}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </Stack>

                    {/* Right: actions */}
                    {app.status === 'in_progress' && (
                      <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          endIcon={<ArrowForwardIcon />}
                          onClick={() => handleContinue(app)}
                        >
                          Continue
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
