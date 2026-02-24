import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { WIZARD_STEPS } from './types';

interface WizardSidebarProps {
  currentStep: number;
}

function WizardSidebar({ currentStep }: WizardSidebarProps) {
  return (
    <Box
      sx={{
        width: 260,
        flexShrink: 0,
        bgcolor: '#1a4fa0',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        p: 3,
      }}
    >
      {/* Branding */}
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight="bold" sx={{ color: '#ff6b35' }}>
          ✦ ANNUITY
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
          Let's start building your application
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <AccessTimeIcon sx={{ fontSize: 14 }} />
          <Typography variant="caption">This will take about 20 minutes</Typography>
        </Stack>
      </Stack>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', mb: 2 }} />

      {/* Steps list */}
      <Stack spacing={1} sx={{ flex: 1 }}>
        {WIZARD_STEPS.map((step) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <Box
              key={step.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1,
                borderRadius: 1,
                bgcolor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                transition: 'background-color 0.2s',
              }}
            >
              {/* Step number bubble */}
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  bgcolor: isActive
                    ? 'white'
                    : isCompleted
                    ? 'rgba(255,255,255,0.5)'
                    : 'rgba(255,255,255,0.15)',
                  mt: 0.1,
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight="bold"
                  sx={{
                    color: isActive ? '#1a4fa0' : isCompleted ? '#1a4fa0' : 'rgba(255,255,255,0.6)',
                    fontSize: 11,
                  }}
                >
                  {step.id}
                </Typography>
              </Box>

              {/* Labels */}
              <Box>
                <Typography
                  variant="body2"
                  fontWeight={isActive ? 'bold' : 'normal'}
                  sx={{
                    color: isActive || isCompleted ? 'white' : 'rgba(255,255,255,0.5)',
                    fontSize: 13,
                  }}
                >
                  {step.label}
                </Typography>
                {isActive && step.sublabel && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                    {step.sublabel}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>

      {/* Help footer */}
      <Box sx={{ mt: 2 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', mb: 2 }} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 1 }}>
          Need help?
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton size="small" aria-label="tips" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <LightbulbOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" aria-label="help center" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" aria-label="live chat" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <ChatBubbleOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', '&:hover': { color: 'rgba(255,255,255,0.8)' } }}>
            Privacy Policy
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', cursor: 'pointer', '&:hover': { color: 'rgba(255,255,255,0.8)' } }}>
            Terms of Service
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

export default WizardSidebar;
