import { useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { green } from '@mui/material/colors';
import { APPLICATION_DEFINITION } from './applicationDefinition';
import { WizardV2FormProvider, useWizardV2Controller } from './formController';
import WizardField from './WizardField';
import WizardSidebar from './WizardSidebar';

const greenWizardTheme = createTheme({
  palette: {
    primary: {
      main: green[700],
      dark: green[900],
      light: green[500],
      contrastText: '#fff',
    },
    secondary: {
      main: green[600],
    },
    success: {
      main: green[600],
    },
    background: {
      default: green[50],
      paper: '#fff',
    },
  },
});

function ReviewPanel() {
  const { pages, values } = useWizardV2Controller();

  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h2" fontWeight="bold">
        Review & Submit
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Confirm all answers before final submission.
      </Typography>

      {pages.map((page) => (
        <Paper key={page.id} variant="outlined" sx={{ p: 2.5, borderColor: 'success.light' }}>
          <Typography variant="subtitle1" fontWeight="bold" color="primary.main" gutterBottom>
            {page.title}
          </Typography>
          <Stack spacing={1.25}>
            {page.questions.map((question) => {
              const rawValue = values[question.id];
              const displayValue = typeof rawValue === 'boolean' ? (rawValue ? 'Yes' : 'No') : rawValue || 'Not provided';

              return (
                <Stack key={question.id} direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    {question.label}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    {displayValue}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function WizardPageContent() {
  const { pages, validatePage, populateWithDummyData } = useWizardV2Controller();
  const [currentStep, setCurrentStep] = useState(0);
  const [showSubmissionBanner, setShowSubmissionBanner] = useState(false);

  const isReviewStep = currentStep === pages.length;
  const totalSteps = pages.length + 1;
  const progress = (currentStep / (totalSteps - 1)) * 100;

  const currentPage = isReviewStep ? null : pages[currentStep];

  const stepLabel = useMemo(() => {
    if (isReviewStep) {
      return 'Review & Submit';
    }

    return currentPage?.title ?? '';
  }, [currentPage, isReviewStep]);

  const handleNext = () => {
    if (!isReviewStep && currentPage && !validatePage(currentPage)) {
      return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    setShowSubmissionBanner(true);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <WizardSidebar pages={pages} currentStep={currentStep} />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <LinearProgress variant="determinate" value={progress} color="success" sx={{ height: 6 }} />

        <Box sx={{ p: { xs: 2, md: 4 }, flex: 1 }}>
          <Box sx={{ maxWidth: 860, mx: 'auto' }}>
            <Paper
              variant="outlined"
              sx={{ mb: 3, p: { xs: 2.5, md: 3 }, borderColor: 'success.light', bgcolor: 'background.paper' }}
            >
              <Typography variant="h5" component="h1" fontWeight="bold" color="primary.main" gutterBottom>
                {APPLICATION_DEFINITION.productName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {APPLICATION_DEFINITION.description}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip label={APPLICATION_DEFINITION.carrier} color="success" size="small" />
                <Chip label={`Step ${currentStep + 1} of ${totalSteps}`} variant="outlined" color="success" size="small" />
                <Typography variant="caption" color="text.secondary">
                  Active section: {stepLabel}
                </Typography>
                <Button size="small" variant="outlined" color="success" onClick={populateWithDummyData}>
                  Fill Dummy Data
                </Button>
              </Stack>
            </Paper>

            {showSubmissionBanner && (
              <Alert icon={<CheckIcon fontSize="inherit" />} severity="success" sx={{ mb: 3 }}>
                Application submitted successfully. You can review data and navigate back if updates are needed.
              </Alert>
            )}

            {!isReviewStep && currentPage && (
              <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderColor: 'divider' }}>
                <Typography variant="h6" component="h2" gutterBottom>
                  {currentPage.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {currentPage.description}
                </Typography>

                <Grid container spacing={2}>
                  {currentPage.questions.map((question) => (
                    <Grid key={question.id} size={{ xs: 12, md: question.type === 'long_text' ? 12 : 6 }}>
                      <WizardField question={question} />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}

            {isReviewStep && <ReviewPanel />}
          </Box>
        </Box>

        <Divider />
        <Box
          sx={{
            p: { xs: 2, md: 3 },
            bgcolor: 'background.paper',
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ maxWidth: 860, mx: 'auto' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                disabled={currentStep === 0}
                color="inherit"
              >
                Back
              </Button>

              <Stack direction="row" spacing={1.5}>
                {!isReviewStep && (
                  <Button variant="contained" color="success" endIcon={<ArrowForwardIcon />} onClick={handleNext}>
                    Save & Next
                  </Button>
                )}
                {isReviewStep && (
                  <Button variant="contained" color="success" onClick={handleSubmit}>
                    Submit Application
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function WizardPageV2() {
  return (
    <ThemeProvider theme={greenWizardTheme}>
      <WizardV2FormProvider>
        <WizardPageContent />
      </WizardV2FormProvider>
    </ThemeProvider>
  );
}

export default WizardPageV2;
