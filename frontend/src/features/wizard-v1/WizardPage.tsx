import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import WizardSidebar from './WizardSidebar';
import { WIZARD_STEPS } from './types';
import PersonalDetailsStep from './steps/PersonalDetailsStep';
import BeneficiaryStep from './steps/BeneficiaryStep';
import FinancialProfileStep from './steps/FinancialProfileStep';
import AnnuitySelectionStep from './steps/AnnuitySelectionStep';
import PaymentSetupStep from './steps/PaymentSetupStep';
import SuitabilityReviewStep from './steps/SuitabilityReviewStep';
import ReviewSubmitStep from './steps/ReviewSubmitStep';
import { WizardFormProvider, useWizardFormController } from './formController';

const STEP_COMPONENTS = [
  PersonalDetailsStep,
  BeneficiaryStep,
  FinancialProfileStep,
  AnnuitySelectionStep,
  PaymentSetupStep,
  SuitabilityReviewStep,
  ReviewSubmitStep,
];

const BREADCRUMB_LABELS = ['Welcome', 'Application', 'Review'];

function WizardPageContent() {
  const [currentStep, setCurrentStep] = useState(1);
  const { validateStep } = useWizardFormController();
  const totalSteps = WIZARD_STEPS.length;
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;

  const StepComponent = STEP_COMPONENTS[currentStep - 1];

  const handleNext = () => {
    const isStepValid = validateStep(currentStep);
    if (!isStepValid) return;
    if (currentStep < totalSteps) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handleSkip = () => {
    if (currentStep < totalSteps) setCurrentStep((s) => s + 1);
  };

  const isLastStep = currentStep === totalSteps;
  const breadcrumbIndex = currentStep <= 2 ? 0 : currentStep <= 5 ? 1 : 2;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'grey.100' }}>
      {/* Right sidebar */}
      <WizardSidebar currentStep={currentStep} />

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top progress bar */}
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 4, borderRadius: 0 }}
        />

        {/* Breadcrumb / step indicator */}
        <Box sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', px: 4, py: 1.5 }}>
          <Stack direction="row" spacing={4} alignItems="center">
            {BREADCRUMB_LABELS.map((label, i) => (
              <Typography
                key={label}
                variant="body2"
                fontWeight={i === breadcrumbIndex ? 'bold' : 'normal'}
                color={i === breadcrumbIndex ? 'primary.main' : 'text.disabled'}
                sx={{ cursor: 'default', userSelect: 'none' }}
              >
                {i === breadcrumbIndex ? `You are here — ${label}` : label}
              </Typography>
            ))}
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Step {currentStep} of {totalSteps}
            </Typography>
          </Stack>
        </Box>

        {/* Form area */}
        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, md: 4 } }}>
          <Box sx={{ maxWidth: 780, mx: 'auto' }}>
            {/* Back button */}
            {currentStep > 1 && (
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                size="small"
                sx={{ mb: 2, color: 'text.secondary' }}
              >
                Back
              </Button>
            )}

            {/* Step card */}
            <Paper elevation={0} variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 2 }}>
              <StepComponent />
            </Paper>

            {/* Navigation buttons */}
            <Stack
              direction="row"
              justifyContent="flex-end"
              alignItems="center"
              spacing={2}
              sx={{ mt: 3 }}
            >
              {!isLastStep && (
                <Button variant="text" color="inherit" onClick={handleSkip} sx={{ color: 'text.secondary' }}>
                  Save &amp; Skip
                </Button>
              )}
              <Button
                variant="contained"
                endIcon={!isLastStep ? <ArrowForwardIcon /> : undefined}
                onClick={handleNext}
                size="large"
                disableElevation
                color={isLastStep ? 'success' : 'primary'}
              >
                {isLastStep ? 'Submit Application' : 'Save & Go Next'}
              </Button>
              {!isLastStep && (
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  Or press enter ↵
                </Typography>
              )}
            </Stack>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ px: 4, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="caption" color="text.disabled">
            All rights reserved 2025 · Annuity Application Wizard v1
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function WizardPage() {
  return (
    <WizardFormProvider>
      <WizardPageContent />
    </WizardFormProvider>
  );
}

export default WizardPage;
