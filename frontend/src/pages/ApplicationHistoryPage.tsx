import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HistoryIcon from '@mui/icons-material/History';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { listApplications, getProducts, type ApplicationInstance, type Product } from '../services/apiService';

interface EnrichedApplication extends ApplicationInstance {
  productName: string;
  carrier: string;
  productType: string;
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

function formatProductType(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ApplicationHistoryPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<EnrichedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'submitted'>('all');
  const [carrierFilter, setCarrierFilter] = useState<string[]>([]);
  const [productTypeFilter, setProductTypeFilter] = useState<string[]>([]);

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
              productType: product?.productType ?? '',
              version: product?.version ?? '',
            };
          })
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setApplications(enriched);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load applications'))
      .finally(() => setLoading(false));
  }, []);

  const carriers = useMemo(
    () => [...new Set(applications.map((a) => a.carrier).filter(Boolean))].sort(),
    [applications],
  );

  const productTypes = useMemo(
    () => [...new Set(applications.map((a) => a.productType).filter(Boolean))].sort(),
    [applications],
  );

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (carrierFilter.length > 0 && !carrierFilter.includes(app.carrier)) return false;
      if (productTypeFilter.length > 0 && !productTypeFilter.includes(app.productType)) return false;
      return true;
    });
  }, [applications, statusFilter, carrierFilter, productTypeFilter]);

  const handleContinue = (app: EnrichedApplication) => {
    navigate(`/wizard-v2/${encodeURIComponent(app.productId)}?resume=${app.id}`);
  };

  const handleCarrierChange = (e: SelectChangeEvent<string[]>) => {
    const val = e.target.value;
    setCarrierFilter(typeof val === 'string' ? val.split(',') : val);
  };

  const handleProductTypeChange = (e: SelectChangeEvent<string[]>) => {
    const val = e.target.value;
    setProductTypeFilter(typeof val === 'string' ? val.split(',') : val);
  };

  const showFilters = !loading && !error && applications.length > 0;

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
        <Typography variant="body1" color="text.secondary" mb={4}>
          Pick up where you left off or review submitted applications.
        </Typography>

        {showFilters && (
          <Stack spacing={2} mb={3}>
            {/* Row: status toggles + dropdowns */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} flexWrap="wrap">
              {/* Status toggle — no label */}
              <ToggleButtonGroup
                value={statusFilter}
                color="secondary"
                exclusive
                onChange={(_, val) => { if (val) setStatusFilter(val); }}
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 2,
                    py: 0.625,
                    fontSize: 13,
                    textTransform: 'none',
                    fontWeight: 500,
                  },
                }}
              >
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="in_progress">In Progress</ToggleButton>
                <ToggleButton value="submitted">Submitted</ToggleButton>
              </ToggleButtonGroup>

              {/* Carrier multi-select */}
              {carriers.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Carrier</InputLabel>
                  <Select
                    multiple
                    value={carrierFilter}
                    onChange={handleCarrierChange}
                    input={<OutlinedInput label="Carrier" />}
                    renderValue={(selected) =>
                      selected.length === 0
                        ? ''
                        : selected.length === 1
                        ? selected[0]
                        : `${selected.length} carriers`
                    }
                  >
                    {carriers.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Product type multi-select */}
              {productTypes.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Product Type</InputLabel>
                  <Select
                    multiple
                    size="small"
                    value={productTypeFilter}
                    onChange={handleProductTypeChange}
                    input={<OutlinedInput label="Product Type" />}
                    renderValue={(selected) =>
                      selected.length === 0
                        ? ''
                        : selected.length === 1
                        ? formatProductType(selected[0])
                        : `${selected.length} types`
                    }
                  >
                    {productTypes.map((t) => (
                      <MenuItem key={t} value={t}>
                        {formatProductType(t)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>

            <Divider />
          </Stack>
        )}

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

        {!loading && !error && applications.length > 0 && filtered.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              No applications match the selected filters.
            </Typography>
          </Box>
        )}

        {!loading && !error && filtered.length > 0 && (
          <Stack spacing={2}>
            {filtered.map((app) => (
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
                          {app.productType && (
                            <Chip
                              label={formatProductType(app.productType)}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: 10 }}
                            />
                          )}
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

                    {app.status !== 'submitted' && (
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
