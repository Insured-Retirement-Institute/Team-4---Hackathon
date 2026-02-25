import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HistoryIcon from '@mui/icons-material/History';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type Product, getProducts } from '../services/applicationService';
import { listSaves } from '../services/applicationStorageService';

export default function ProductSelectionPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);

  const inProgressSaves = listSaves().filter((s) => s.status === 'in_progress');

  useEffect(() => {
    getProducts()
      .then((data) => {
        console.log('Products:', data);
        setProducts(data);
      })
      .catch((err) => console.error('Failed to fetch products:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleStart = () => {
    if (!selected) return;
    navigate(`/wizard-v2/${encodeURIComponent(selected.productId)}`);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <LinearProgress
        variant={loading ? 'indeterminate' : 'determinate'}
        value={100}
        color="secondary"
        sx={{ height: 4 }}
      />

      <Box sx={{ flex: 1, p: { xs: 2, md: 4 } }}>
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>

          {/* ── In-progress banner ────────────────────────────────────────── */}
          {inProgressSaves.length > 0 && (
            <Alert
              icon={<HistoryIcon fontSize="inherit" />}
              severity="info"
              sx={{ mb: 3 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => navigate('/applications')}
                >
                  View all
                </Button>
              }
            >
              <strong>
                {inProgressSaves.length === 1
                  ? '1 application in progress'
                  : `${inProgressSaves.length} applications in progress`}
              </strong>
              {' — '}
              {inProgressSaves
                .slice(0, 2)
                .map((s, i) => (
                  <Box
                    key={s.id}
                    component="span"
                    onClick={() => navigate(`/wizard-v2/${encodeURIComponent(s.productId)}?resume=${s.id}`)}
                    sx={{ cursor: 'pointer', textDecoration: 'underline', mr: i < Math.min(inProgressSaves.length, 2) - 1 ? 1 : 0 }}
                  >
                    {s.productName}
                  </Box>
                ))}
              {inProgressSaves.length > 2 && ` and ${inProgressSaves.length - 2} more`}
            </Alert>
          )}

          {/* ── Header ───────────────────────────────────────────────────── */}
          <Box mb={3}>
            <Chip label="New Application" color="secondary" size="small" sx={{ mb: 1, fontWeight: 600 }} />
            <Typography variant="h5" fontWeight={700} letterSpacing="-0.25px">
              Choose a product
            </Typography>
          </Box>

          {/* ── Skeleton grid ─────────────────────────────────────────────── */}
          {loading && (
            <Grid container spacing={2}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ width: 36, height: 36, bgcolor: 'grey.200', borderRadius: 1.5, flexShrink: 0 }} />
                        <Box flex={1}>
                          <Box sx={{ height: 10, bgcolor: 'grey.200', borderRadius: 1, mb: 1, width: '40%' }} />
                          <Box sx={{ height: 13, bgcolor: 'grey.200', borderRadius: 1, mb: 1, width: '70%' }} />
                          <Box sx={{ height: 10, bgcolor: 'grey.100', borderRadius: 1, width: '90%' }} />
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* ── Product grid ──────────────────────────────────────────────── */}
          {!loading && (
            <Grid container spacing={2}>
              {products.map((product) => {
                const isSelected = selected?.id === product.id;
                return (
                  <Grid key={product.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card
                      elevation={0}
                      sx={{
                        border: '2px solid',
                        borderColor: isSelected ? 'secondary.main' : 'divider',
                        bgcolor: isSelected ? 'rgba(33,150,243,0.06)' : 'background.paper',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        boxShadow: isSelected ? '0 0 0 3px rgba(33,150,243,0.12)' : 'none',
                        '&:hover': { borderColor: isSelected ? 'secondary.main' : 'secondary.light' },
                        height: '100%',
                      }}
                    >
                      <CardActionArea onClick={() => setSelected(product)} sx={{ height: '100%', alignItems: 'flex-start' }}>
                        <CardContent sx={{ p: 2, height: '100%' }}>
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            {/* Icon */}
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 1.5,
                                bgcolor: isSelected ? 'secondary.main' : 'grey.100',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isSelected ? 'white' : 'text.secondary',
                                flexShrink: 0,
                                mt: 0.25,
                              }}
                            >
                              <DescriptionOutlinedIcon sx={{ fontSize: 18 }} />
                            </Box>

                            {/* Text */}
                            <Box flex={1} minWidth={0}>
                              <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                                <Typography
                                  variant="overline"
                                  color="text.secondary"
                                  sx={{ fontSize: 9, letterSpacing: 0.8, lineHeight: 1.2, display: 'block' }}
                                >
                                  {product.carrier}
                                </Typography>
                                {isSelected && (
                                  <CheckCircleIcon sx={{ fontSize: 16, color: 'secondary.main', flexShrink: 0, ml: 0.5 }} />
                                )}
                              </Stack>
                              <Typography
                                variant="subtitle2"
                                fontWeight={700}
                                lineHeight={1.3}
                                sx={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {product.productName || product.productId}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  lineHeight: 1.5,
                                  mt: 0.5,
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

      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          p: { xs: 2, md: 3 },
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <Box sx={{ maxWidth: 1000, mx: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {selected ? `Selected: ${selected.productName || selected.productId}` : 'No product selected'}
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            size="large"
            endIcon={<ArrowForwardIcon />}
            disabled={!selected}
            onClick={handleStart}
          >
            Start Application
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
