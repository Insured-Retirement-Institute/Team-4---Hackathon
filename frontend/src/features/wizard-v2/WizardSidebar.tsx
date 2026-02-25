import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { PageDefinition } from './applicationDefinition';

interface WizardSidebarProps {
  pages: PageDefinition[];
  currentStep: number;
  productName: string;
  carrier: string;
  isPageComplete: (index: number) => boolean;
  onIntroClick: () => void;
  onPageClick: (index: number) => void;
}

function WizardSidebar({ pages, currentStep, productName, carrier, isPageComplete, onIntroClick, onPageClick }: WizardSidebarProps) {
  const reviewStepIndex = pages.length;
  const isIntroActive = currentStep === -1;
  const isIntroComplete = currentStep > -1;

  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        bgcolor: 'primary.dark',
        color: 'primary.contrastText',
        p: 3,
      }}
    >
      <Typography variant="h6" component="h2" fontWeight="bold" color="inherit">
        {carrier}
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 1 }}>
        {productName}
      </Typography>

      <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.2)' }} />

      <Stack spacing={1.25} sx={{ flex: 1 }}>
        <Box
          onClick={onIntroClick}
          sx={{
            borderRadius: 2,
            p: 1.25,
            bgcolor: isIntroActive ? 'rgba(255,255,255,0.15)' : 'transparent',
            cursor: 'pointer',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {isIntroComplete ? (
              <CheckCircleIcon sx={{ fontSize: 18, color: 'secondary.light' }} />
            ) : (
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: isIntroActive ? 'secondary.light' : 'rgba(255,255,255,0.6)',
                }}
              />
            )}
            <Typography
              variant="body2"
              fontWeight={isIntroActive ? 'bold' : 'medium'}
              sx={{ color: isIntroActive || isIntroComplete ? 'common.white' : 'rgba(255,255,255,0.8)' }}
            >
              {carrier}
            </Typography>
          </Stack>
        </Box>

        {pages.map((page, index) => {
          const isActive = currentStep === index;
          const isComplete = isPageComplete(index);

          return (
            <Box
              key={page.id}
              onClick={() => onPageClick(index)}
              sx={{
                borderRadius: 2,
                p: 1.25,
                bgcolor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {isComplete ? (
                  <CheckCircleIcon sx={{ fontSize: 18, color: 'secondary.light' }} />
                ) : (
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: isActive ? 'secondary.light' : 'rgba(255,255,255,0.6)',
                    }}
                  />
                )}
                <Typography
                  variant="body2"
                  fontWeight={isActive ? 'bold' : 'medium'}
                  sx={{ color: isActive || isComplete ? 'common.white' : 'rgba(255,255,255,0.8)' }}
                >
                  {page.title}
                </Typography>
              </Stack>
            </Box>
          );
        })}

        <Box
          sx={{
            borderRadius: 2,
            p: 1.25,
            bgcolor: currentStep === reviewStepIndex ? 'rgba(255,255,255,0.15)' : 'transparent',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {currentStep > reviewStepIndex ? (
              <CheckCircleIcon sx={{ fontSize: 18, color: 'secondary.light' }} />
            ) : (
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor:
                    currentStep === reviewStepIndex ? 'secondary.light' : 'rgba(255,255,255,0.6)',
                }}
              />
            )}
            <Typography
              variant="body2"
              fontWeight={currentStep === reviewStepIndex ? 'bold' : 'medium'}
              sx={{
                color:
                  currentStep === reviewStepIndex || currentStep > reviewStepIndex
                    ? 'common.white'
                    : 'rgba(255,255,255,0.8)',
              }}
            >
              Review & Submit
            </Typography>
          </Stack>
        </Box>
      </Stack>

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
        Advisor-assisted submission workflow
      </Typography>
    </Box>
  );
}

export default WizardSidebar;
