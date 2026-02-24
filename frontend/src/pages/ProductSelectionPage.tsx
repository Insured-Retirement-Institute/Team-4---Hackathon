import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type Product, getApplication, getProducts } from '../services/applicationService';

export default function ProductSelectionPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    getProducts()
      .then((data) => {
        console.log('Products:', data);
        setProducts(data);
      })
      .catch((err) => console.error('Failed to fetch products:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async () => {
    if (!selected) return;
    setStarting(true);
    try {
      const application = await getApplication(selected.productId);
      console.log('Application definition:', application);
      navigate(`/wizard-v2/${encodeURIComponent(selected.productId)}`);
    } catch (err) {
      console.error('Failed to load application:', err);
      setStarting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <LinearProgress
        variant={loading ? 'indeterminate' : 'determinate'}
        value={100}
        color="success"
        sx={{ height: 6 }}
      />

      <Box sx={{ flex: 1, p: { xs: 2, md: 6 } }}>
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

          {/* ── Preface ─────────────────────────────────────────────────── */}
          <Box mb={6}>
            <Chip
              label="New Application"
              color="success"
              size="small"
              sx={{ mb: 2, fontWeight: 600 }}
            />
            <Typography variant="h3" fontWeight={800} mb={1} letterSpacing="-0.5px">
              Choose a product
            </Typography>
            <Typography variant="body1" color="text.secondary" maxWidth={520}>
              Select the annuity product you'd like to apply for. Once selected, we'll load the
              full application and guide you through each step.
            </Typography>
          </Box>

          {/* ── Skeleton grid ────────────────────────────────────────────── */}
          {loading && (
            <Grid container spacing={3}>
              {[1, 2, 3].map((i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: 200 }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ height: 16, bgcolor: 'grey.200', borderRadius: 1, mb: 2, width: '60%' }} />
                      <Box sx={{ height: 12, bgcolor: 'grey.100', borderRadius: 1, mb: 1, width: '40%' }} />
                      <Box sx={{ height: 12, bgcolor: 'grey.100', borderRadius: 1, width: '80%' }} />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* ── Product grid ─────────────────────────────────────────────── */}
          {!loading && (
            <Grid container spacing={3}>
              {products.map((product) => {
                const isSelected = selected?.id === product.id;
                return (
                  <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card
                      elevation={0}
                      sx={{
                        height: '100%',
                        border: '2px solid',
                        borderColor: isSelected ? 'success.main' : 'divider',
                        bgcolor: isSelected ? 'success.50' : 'background.paper',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        boxShadow: isSelected ? '0 0 0 3px rgba(46,125,50,0.12)' : 'none',
                        '&:hover': { borderColor: isSelected ? 'success.main' : 'success.light' },
                        position: 'relative',
                      }}
                    >
                      {/* Selected checkmark */}
                      {isSelected && (
                        <Box sx={{ position: 'absolute', top: 12, right: 12, color: 'success.main', lineHeight: 0 }}>
                          <CheckCircleIcon />
                        </Box>
                      )}

                      <CardActionArea
                        onClick={() => setSelected(product)}
                        sx={{ height: '100%', alignItems: 'flex-start' }}
                      >
                        <CardContent sx={{ p: 3, height: '100%' }}>
                          <Stack spacing={2} height="100%">
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 2,
                                bgcolor: isSelected ? 'success.main' : 'grey.100',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isSelected ? 'white' : 'text.secondary',
                              }}
                            >
                              <DescriptionOutlinedIcon fontSize="small" />
                            </Box>

                            <Box flex={1}>
                              <Typography variant="subtitle1" fontWeight={700} mb={0.5} lineHeight={1.3}>
                                {product.productId}
                              </Typography>
                              <Stack direction="row" spacing={0.75} mb={1.5} flexWrap="wrap" useFlexGap>
                                <Chip
                                  label={product.carrier}
                                  size="small"
                                  color={isSelected ? 'success' : 'default'}
                                  sx={{ fontSize: 11 }}
                                />
                                <Chip
                                  label={`v${product.version}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: 10, height: 20 }}
                                />
                              </Stack>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  lineHeight: 1.6,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {product.description}
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
          )}
        </Box>
      </Box>

      <Divider />
      <Box
        sx={{
          p: { xs: 2, md: 3 },
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ maxWidth: 1000, mx: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {selected ? `Selected: ${selected.productId}` : 'No product selected'}
          </Typography>
          <Button
            variant="contained"
            color="success"
            size="large"
            endIcon={starting ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardIcon />}
            disabled={!selected || starting}
            onClick={handleStart}
          >
            {starting ? 'Loading...' : 'Start Application'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
