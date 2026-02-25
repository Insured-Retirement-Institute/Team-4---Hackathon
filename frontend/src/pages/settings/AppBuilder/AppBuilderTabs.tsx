import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ApprovedDistributorsPanel from './ApprovedDistributors/ApprovedDistributorsPanel';
import ApplicationEditorPanel from './ApplicationEditor/ApplicationEditorPanel';
import ProductSelectionPanel from './ProductSelection/ProductSelectionPanel';
import { type Product } from '../../../services/apiService';

const APP_BUILDER_SELECTED_PRODUCT_KEY = 'app_builder_selected_product';
const getProductKey = (product: Product | null) => product?.id || product?.productId || '';

function AppBuilderTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const hasSelectedProduct = Boolean(getProductKey(selectedProduct));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(APP_BUILDER_SELECTED_PRODUCT_KEY);
    if (!raw) return;
    try {
      setSelectedProduct(JSON.parse(raw) as Product);
    } catch {
      window.localStorage.removeItem(APP_BUILDER_SELECTED_PRODUCT_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedProduct) {
      window.localStorage.removeItem(APP_BUILDER_SELECTED_PRODUCT_KEY);
      return;
    }
    window.localStorage.setItem(APP_BUILDER_SELECTED_PRODUCT_KEY, JSON.stringify(selectedProduct));
  }, [selectedProduct]);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleInvalidSelection = () => {
    setSelectedProduct(null);
    setActiveTab(0);
  };

  useEffect(() => {
    if (!hasSelectedProduct && activeTab === 1) {
      setActiveTab(0);
    }
  }, [activeTab, hasSelectedProduct]);

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, nextTab: number) => setActiveTab(nextTab)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTabs-indicator': {
              backgroundColor: '#3a9df7',
            },
          }}
        >
          <Tab
            label="Product Selection"
            sx={{
              '&.Mui-selected': {
                color: '#3a9df7',
                fontWeight: 700,
              },
            }}
          />
          <Tab
            label="Application Editor"
            disabled={!hasSelectedProduct}
            sx={{
              '&.Mui-selected': {
                color: '#3a9df7',
                fontWeight: 700,
              },
            }}
          />
          <Tab
            label="Approved Distributors"
            sx={{
              '&.Mui-selected': {
                color: '#3a9df7',
                fontWeight: 700,
              },
            }}
          />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <ProductSelectionPanel
          selectedProductKey={getProductKey(selectedProduct) || null}
          onSelectProduct={handleProductSelect}
          onInvalidSelection={handleInvalidSelection}
        />
      )}
      {activeTab === 1 && <ApplicationEditorPanel selectedProduct={selectedProduct} />}
      {activeTab === 2 && <ApprovedDistributorsPanel />}
    </Box>
  );
}

export default AppBuilderTabs;
