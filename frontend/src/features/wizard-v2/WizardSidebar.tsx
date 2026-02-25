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

const NAV_ITEM_SX = { fontSize: 13 };

function WizardSidebar({ pages, currentStep, productName, carrier, isPageComplete, onIntroClick, onPageClick }: WizardSidebarProps) {
  const reviewStepIndex = pages.length;
  const isIntroActive = currentStep === -1;
  const isIntroComplete = currentStep > -1;

  return (
    <Box
      sx={{
        width: 260,
        height: '100%',
        flexShrink: 0,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        bgcolor: 'primary.dark',
        color: 'primary.contrastText',
        p: 2.5,
        overflowY: 'auto',
      }}
    >
      <Typography variant="h6" component="h2" fontWeight="bold" color="inherit">
        {carrier}
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 1 }}>
        {productName}
      </Typography>

      <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.2)' }} />

      {/* Scrollable nav items */}
      <Stack spacing={0.5} sx={{ mx: -0.5, px: 0.5 }}>
        {/* Intro step */}
        <Box
          onClick={onIntroClick}
          sx={{
            borderRadius: 1.5,
            p: 0.75,
            bgcolor: isIntroActive ? 'rgba(255,255,255,0.15)' : 'transparent',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {isIntroComplete ? (
              <CheckCircleIcon sx={{ fontSize: 16, color: 'secondary.light', flexShrink: 0 }} />
            ) : (
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: isIntroActive ? 'secondary.light' : 'rgba(255,255,255,0.6)',
                  flexShrink: 0,
                }}
              />
            )}
            <Typography
              variant="body2"
              fontWeight={isIntroActive ? 700 : 400}
              sx={{ ...NAV_ITEM_SX, color: isIntroActive || isIntroComplete ? 'common.white' : 'rgba(255,255,255,0.8)' }}
            >
              {carrier}
            </Typography>
          </Stack>
        </Box>

        {/* Page steps */}
        {pages.map((page, index) => {
          const isActive = currentStep === index;
          const isComplete = isPageComplete(index);

          return (
            <Box
              key={page.id}
              onClick={() => onPageClick(index)}
              sx={{
                borderRadius: 1.5,
                p: 0.75,
                bgcolor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                {isComplete ? (
                  <CheckCircleIcon sx={{ fontSize: 16, color: 'secondary.light', flexShrink: 0 }} />
                ) : (
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: isActive ? 'secondary.light' : 'rgba(255,255,255,0.6)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <Typography
                  variant="body2"
                  fontWeight={isActive ? 700 : 400}
                  sx={{ ...NAV_ITEM_SX, color: isActive || isComplete ? 'common.white' : 'rgba(255,255,255,0.8)' }}
                >
                  {page.title}
                </Typography>
              </Stack>
            </Box>
          );
        })}

        {/* Review & Submit */}
        <Box
          sx={{
            borderRadius: 1.5,
            p: 0.75,
            bgcolor: currentStep === reviewStepIndex ? 'rgba(255,255,255,0.15)' : 'transparent',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {currentStep > reviewStepIndex ? (
              <CheckCircleIcon sx={{ fontSize: 16, color: 'secondary.light', flexShrink: 0 }} />
            ) : (
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: currentStep === reviewStepIndex ? 'secondary.light' : 'rgba(255,255,255,0.6)',
                  flexShrink: 0,
                }}
              />
            )}
            <Typography
              variant="body2"
              fontWeight={currentStep === reviewStepIndex ? 700 : 400}
              sx={{
                ...NAV_ITEM_SX,
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

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mt: 2 }}>
        Advisor-assisted submission workflow
      </Typography>
    </Box>
  );
}

export default WizardSidebar;
