import { useEffect, useState } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { type Product, getProducts } from '../../../../services/apiService';

type ProductSelectionPanelProps = {
  selectedProductKey: string | null;
  onSelectProduct: (product: Product) => void;
  onInvalidSelection: () => void;
};

const getProductKey = (product: Product) => product.id || product.productId;

function ProductSelectionPanel({ selectedProductKey, onSelectProduct, onInvalidSelection }: ProductSelectionPanelProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then((data) => setProducts(data))
      .catch((error) => console.error('Failed to load products for App Builder:', error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProductKey || loading) return;
    const exists = products.some((product) => getProductKey(product) === selectedProductKey);
    if (!exists) onInvalidSelection();
  }, [selectedProductKey, products, loading, onInvalidSelection]);

  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Choose a product
      </Typography>

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Loading products...
        </Typography>
      ) : (
        <Grid container spacing={1.5}>
          {products.map((product) => {
            const productKey = getProductKey(product);
            const selected = selectedProductKey === productKey;
            return (
              <Grid key={productKey} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    borderWidth: 2,
                    borderColor: selected ? 'primary.main' : 'divider',
                    bgcolor: selected ? 'rgba(58,157,247,0.08)' : '#fff',
                  }}
                >
                  <CardActionArea onClick={() => onSelectProduct(product)}>
                    <CardContent sx={{ py: 1.5 }}>
                      <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            {product.carrier}
                          </Typography>
                          {selected ? <CheckCircleIcon sx={{ fontSize: 16, color: 'primary.main' }} /> : null}
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {product.productName || product.productId}
                        </Typography>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {product.productId}
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
    </Stack>
  );
}

export default ProductSelectionPanel;
