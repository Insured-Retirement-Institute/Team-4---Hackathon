import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ApprovedDistributorsPanel from './ApprovedDistributors/ApprovedDistributorsPanel';
import ApplicationEditorPanel from './ApplicationEditor/ApplicationEditorPanel';
import ProductSelectionPanel from './ProductSelection/ProductSelectionPanel';
import { type Product } from '../../../services/apiService';

const APP_BUILDER_SELECTED_PRODUCT_KEY = 'app_builder_selected_product';
const getProductKey = (product: Product | null) => product?.id || product?.productId || '';

function AppBuilderTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedDistributorIds, setSelectedDistributorIds] = useState<string[]>([]);
  const [saveHandler, setSaveHandler] = useState<null | (() => Promise<{ ok: boolean; message: string }>)>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveNoticeOpen, setSaveNoticeOpen] = useState(false);
  const [saveNoticeMessage, setSaveNoticeMessage] = useState('');
  const [saveNoticeSeverity, setSaveNoticeSeverity] = useState<'success' | 'error'>('success');
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
    setSelectedDistributorIds([]);
    setSaveStatus('idle');
    setActiveTab(0);
  };

  const handleSaveApplication = async () => {
    if (!saveHandler) {
      setSaveStatus('error');
      setSaveNoticeMessage('Unable to save application right now.');
      setSaveNoticeSeverity('error');
      setSaveNoticeOpen(true);
      return;
    }
    setSaveStatus('saving');
    const result = await saveHandler();
    setSaveNoticeMessage(result.message);
    setSaveNoticeSeverity(result.ok ? 'success' : 'error');
    setSaveNoticeOpen(true);
    setSaveStatus(result.ok ? 'success' : 'error');
    if (result.ok) {
      setSelectedProduct(null);
      setSelectedDistributorIds([]);
      setActiveTab(0);
    }
  };

  const registerSaveHandler = (handler: () => Promise<{ ok: boolean; message: string }>) => {
    setSaveHandler(() => handler);
  };

  useEffect(() => {
    setSelectedDistributorIds([]);
    setSaveStatus('idle');
  }, [selectedProduct?.productId]);

  useEffect(() => {
    if (!hasSelectedProduct && activeTab === 1) {
      setActiveTab(0);
    }
  }, [activeTab, hasSelectedProduct]);

  useEffect(() => {
    if (!saveNoticeOpen) return;
    const timeoutId = window.setTimeout(() => {
      setSaveNoticeOpen(false);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [saveNoticeOpen, saveNoticeMessage]);

  const steps = [
    { label: 'Product Selection', disabled: false },
    { label: 'Application Editor', disabled: !hasSelectedProduct },
    { label: 'Approved Distributors', disabled: !hasSelectedProduct },
  ];
  const isFirstStep = activeTab === 0;
  const isLastStep = activeTab === steps.length - 1;

  const handleBack = () => {
    if (isFirstStep) return;
    setActiveTab((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    if (isLastStep) return;
    if (activeTab === 0 && !hasSelectedProduct) return;
    setActiveTab((prev) => Math.min(steps.length - 1, prev + 1));
  };

  const nextDisabled =
    isLastStep ||
    (activeTab === 0 && !hasSelectedProduct) ||
    (activeTab === 1 && !hasSelectedProduct);
  const updateDisabled = saveStatus === 'saving' || selectedDistributorIds.length === 0;

  return (
    <Box>
      <Box sx={{ mb: 2, overflowX: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 760, py: 1 }}>
          {steps.map((step, index) => {
            const active = activeTab === index;
            const completedOrActive = index <= activeTab;
            return (
              <Stack key={step.label} direction="row" alignItems="center" spacing={1.25} sx={{ flex: 1 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'default',
                    opacity: step.disabled ? 0.6 : 1,
                    color: completedOrActive ? '#3a9df7' : '#8d929b',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: completedOrActive ? '#3a9df7' : '#b7bcc5',
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography sx={{ fontWeight: active ? 700 : 600, color: completedOrActive ? '#3a9df7' : '#8d929b' }}>
                    {step.label}
                  </Typography>
                </Box>
                {index < steps.length - 1 ? (
                  <Box sx={{ flex: 1, height: 1, minWidth: 40, bgcolor: activeTab > index ? '#3a9df7' : '#d2d6dd' }} />
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      </Box>

      <Box sx={{ pb: 11 }}>
        {activeTab === 0 && (
          <ProductSelectionPanel
            selectedProductKey={getProductKey(selectedProduct) || null}
            onSelectProduct={handleProductSelect}
            onInvalidSelection={handleInvalidSelection}
          />
        )}
        {hasSelectedProduct ? (
          <Box sx={{ display: activeTab === 1 ? 'block' : 'none' }}>
            <ApplicationEditorPanel
              selectedProduct={selectedProduct}
              selectedDistributorIds={selectedDistributorIds}
              onRegisterSaveHandler={registerSaveHandler}
            />
          </Box>
        ) : null}
        {activeTab === 2 && (
          <ApprovedDistributorsPanel
            selectedDistributorIds={selectedDistributorIds}
            onToggleDistributor={(distributorId) =>
              setSelectedDistributorIds((prev) =>
                prev.includes(distributorId) ? prev.filter((id) => id !== distributorId) : [...prev, distributorId],
              )
            }
          />
        )}
      </Box>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          py: 1.5,
          px: 3,
          borderTop: 'none',
          bgcolor: 'transparent',
          boxShadow: 'none',
        }}
      >
        <Stack direction="row" spacing={1} justifyContent="space-between">
          {isFirstStep ? <Box /> : (
            <Button
              variant="outlined"
              onClick={handleBack}
              sx={{ bgcolor: '#ffffff', '&:hover': { bgcolor: '#ffffff' } }}
            >
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button
              variant="contained"
              onClick={handleSaveApplication}
              disabled={updateDisabled}
              sx={{ bgcolor: '#3a9df7', '&:hover': { bgcolor: '#258ff0' } }}
            >
              {saveStatus === 'saving' ? 'Updating...' : 'Update Product'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={nextDisabled}
              sx={{ bgcolor: '#3a9df7', '&:hover': { bgcolor: '#258ff0' } }}
            >
              Next
            </Button>
          )}
        </Stack>
      </Box>

      <Snackbar
        key={saveNoticeMessage}
        open={saveNoticeOpen}
        autoHideDuration={3000}
        resumeHideDuration={3000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setSaveNoticeOpen(false);
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSaveNoticeOpen(false)}
          severity={saveNoticeSeverity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {saveNoticeMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default AppBuilderTabs;
