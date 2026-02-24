import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { openWidget } from '../hooks/useWidgetSync';
import { getApplication } from '../services/applicationService';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ApiIcon from '@mui/icons-material/Api';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import MicIcon from '@mui/icons-material/Mic';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import catAnimation from '../animations/cat.json';

const FEATURES = [
  {
    icon: <ApiIcon sx={{ fontSize: 32 }} />,
    label: 'Universal Application API',
    story: 'US-01',
    description:
      'A single normalized schema that decouples the input experience from carrier-specific form logic. Any frontend, any carrier — no rebuilding.',
    status: 'built',
  },
  {
    icon: <FormatListBulletedIcon sx={{ fontSize: 32 }} />,
    label: 'Guided Wizard',
    story: 'US-02',
    description:
      'A step-by-step, data-driven application wizard with conditional logic, progress tracking, and pre-fill support. Embeddable anywhere.',
    status: 'built',
  },
  {
    icon: <SmartToyIcon sx={{ fontSize: 32 }} />,
    label: 'AI Chat Interface',
    story: 'US-03',
    description:
      'Complete an entire annuity application through natural conversation. The AI guides, confirms, and clarifies — no forms, no friction.',
    status: 'built',
  },
  {
    icon: <MicIcon sx={{ fontSize: 32 }} />,
    label: 'Voice Input',
    story: 'US-04',
    description:
      'Speak your answers — live or via uploaded call recording. AI transcribes, maps to schema fields, and flags low-confidence extractions.',
    status: 'coming',
  },
  {
    icon: <UploadFileIcon sx={{ fontSize: 32 }} />,
    label: 'Contract Auto-Population',
    story: 'US-05',
    description:
      "Upload a prior carrier's PDF contract. AI extracts key fields and maps them to the new application — replacing manual re-entry.",
    status: 'coming',
  },
  {
    icon: <PrecisionManufacturingIcon sx={{ fontSize: 32 }} />,
    label: 'Agentic Orchestration',
    story: 'US-08',
    description:
      'Initiate 8 applications in the time it takes to start 1. An AI agent pulls from CRM, call transcripts, and public records — surfacing only gaps.',
    status: 'coming',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Load the Application Schema',
    body: 'The backend API returns a normalized question set for the carrier, state, and distribution channel. One schema, any frontend.',
  },
  {
    step: '02',
    title: 'Complete via Wizard or AI Chat',
    body: 'Advisors choose their path: a structured step-by-step wizard or a natural language conversation with the AI assistant.',
  },
  {
    step: '03',
    title: 'Validate & Submit',
    body: 'The engine enforces all carrier rules, flags NIGO issues before submission, and produces a structured payload ready for the carrier API or PDF fill.',
  },
];

function CatAnimation() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isUnmounted = false;
    let animation: { destroy: () => void } | null = null;

    import('lottie-web')
      .then((module) => {
        const lottie = module.default;
        if (isUnmounted || !containerRef.current) return;

        animation = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: catAnimation,
        });
      })
      .catch((error) => {
        console.error('Failed to load cat animation:', error);
      });

    return () => {
      isUnmounted = true;
      animation?.destroy();
    };
  }, []);

  return <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />;
}

export default function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    getApplication('midland-national-fixed-annuity-v1')
      .then((app) => console.log('Application definition:', app))
      .catch((err) => console.error('Failed to load application:', err));
  }, []);

  return (
    <Box>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          background: 'radial-gradient(ellipse at 50% 50%, #1a2a4a 0%, #212121 65%)',
          color: 'white',
          py: { xs: 10, md: 14 },
          px: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Lottie background — fills hero, sits behind content */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.25,
            '& > div, & canvas': { width: '100% !important', height: '100% !important', display: 'block' },
          }}
        >
          <DotLottieReact
            src="https://lottie.host/db642e06-8aa1-4693-b9c5-d2c658ca0af8/tjcbncDBx1.lottie"
            loop
            autoplay
          />
        </Box>

        <Container maxWidth="md" sx={{ position: 'relative', textAlign: 'center' }}>
          <Chip
            icon={<AutoAwesomeIcon sx={{ fontSize: '14px !important' }} />}
            label="Hackathon Demo — Annuity Application Modernization"
            size="small"
            sx={{
              mb: 3,
              bgcolor: 'transparent',
              color: 'secondary.main',
              border: '1px solid',
              borderColor: 'secondary.dark',
              fontWeight: 500,
              '& .MuiChip-icon': {
                color: 'secondary.main',
              },
            }}
          />
          <Typography
            variant="h2"
            fontWeight={800}
            sx={{ mb: 2, lineHeight: 1.1, letterSpacing: '-0.5px' }}
          >
            Annuity Applications.
            <br />
            Reimagined.
          </Typography>
          <Typography
            variant="h6"
            sx={{ mb: 5, color: 'rgba(255,255,255,0.7)', fontWeight: 400, maxWidth: 560, mx: 'auto' }}
          >
            What today takes 4 hours of data entry should take 4 minutes of conversation.
            We built the tech to make that real.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => openWidget()}
              color="secondary"
              disableElevation
              sx={{
                fontWeight: 700,
                px: 4,
              }}
            >
              Try AI Assistant
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/wizard-v2')}
              color="secondary"
              sx={{
                borderColor: 'secondary.main',
                fontWeight: 600,
                px: 4,
                '&:hover': {
                  borderColor: 'secondary.main',
                  bgcolor: 'rgba(25,118,210,0.08)',
                },
              }}
            >
              Open Wizard
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ── Problem strip ────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: 'grey.900', color: 'white', py: 4, px: 3 }}>
        <Container maxWidth="md">
          <Typography
            variant="body1"
            sx={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontStyle: 'italic' }}
          >
            "For an advisor who meets 12 clients a week, completing 8 annuity applications is a
            multi-day administrative burden — often outsourced to dedicated data entry staff just to
            keep pace."
          </Typography>
        </Container>
      </Box>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <Box sx={{ py: { xs: 8, md: 12 }, px: 3, bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Typography variant="overline" color="primary" fontWeight={700} display="block" mb={1}>
            What We Built
          </Typography>
          <Typography variant="h4" fontWeight={700} mb={1}>
            End-to-end application modernization
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={6} maxWidth={520}>
            Three user stories delivered at the hackathon, with a clear roadmap for what comes next.
          </Typography>

          <Grid container spacing={3}>
            {FEATURES.map((f) => {
              const built = f.status === 'built';
              return (
                <Grid key={f.label} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%',
                      border: '1px solid',
                      borderColor: built ? 'primary.light' : 'divider',
                      opacity: built ? 1 : 0.6,
                      transition: 'box-shadow 0.2s, transform 0.2s',
                      '&:hover': built
                        ? { boxShadow: 4, transform: 'translateY(-2px)' }
                        : {},
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                        <Box sx={{ color: built ? 'primary.main' : 'text.disabled' }}>{f.icon}</Box>
                        <Stack direction="row" spacing={0.75}>
                          <Chip
                            label={f.story}
                            size="small"
                            sx={{ fontSize: 10, height: 20, bgcolor: 'grey.100' }}
                          />
                          {built ? (
                            <Chip
                              icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
                              label="Built"
                              size="small"
                              color="success"
                              sx={{ fontSize: 10, height: 20 }}
                            />
                          ) : (
                            <Chip
                              label="Coming Soon"
                              size="small"
                              sx={{ fontSize: 10, height: 20, bgcolor: 'grey.200' }}
                            />
                          )}
                        </Stack>
                      </Stack>
                      <Typography variant="subtitle1" fontWeight={700} mb={0.75}>
                        {f.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                        {f.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Divider />

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <Box sx={{ py: { xs: 8, md: 12 }, px: 3, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Typography variant="overline" color="primary" fontWeight={700} display="block" mb={1}>
            How It Works
          </Typography>
          <Typography variant="h4" fontWeight={700} mb={6}>
            One schema. Any input. Any carrier.
          </Typography>

          <Grid container spacing={4}>
            {HOW_IT_WORKS.map((step) => (
              <Grid key={step.step} size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={3} alignItems="flex-start">
                  <Typography
                    variant="h3"
                    fontWeight={800}
                    sx={{ color: 'secondary.main', lineHeight: 1, minWidth: 56 }}
                  >
                    {step.step}
                  </Typography>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} mb={0.75}>
                      {step.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                      {step.body}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Divider />

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <Box sx={{ py: { xs: 8, md: 10 }, px: 3, bgcolor: 'background.default', textAlign: 'center' }}>
        <Container maxWidth="sm">
          <Typography variant="h4" fontWeight={700} mb={1.5}>
            See it in action
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            Start with the AI assistant for a conversational demo, or jump straight into the wizard
            to see the data-driven application engine.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              endIcon={<SmartToyIcon />}
              onClick={() => openWidget()}
              color="secondary"
              disableElevation
              sx={{ fontWeight: 700, px: 4 }}
            >
              AI Assistant
            </Button>
            <Button
              variant="outlined"
              size="large"
              endIcon={<FormatListBulletedIcon />}
              onClick={() => navigate('/wizard-v2')}
              color="secondary"
              sx={{
                fontWeight: 600,
                px: 4,
                borderColor: 'secondary.main',
                '&:hover': {
                  borderColor: 'secondary.main',
                  bgcolor: 'rgba(25,118,210,0.08)',
                },
              }}
            >
              Guided Wizard
            </Button>
          </Stack>

          <Box
            sx={{
              mt: 4,
              mx: 'auto',
              width: { xs: 96, md: 128 },
              pointerEvents: 'none',
            }}
          >
            <CatAnimation />
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
