import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { openWidget } from '../hooks/useWidgetSync';
import { listSaves } from '../services/applicationStorageService';
import type { SavedApplicationEntry } from '../services/applicationStorageService';
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
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import catAnimation from '../animations/cat.json';

const FEATURES: {
  icon: React.ReactNode;
  label: string;
  description: string;
  accent: string;
  status: 'built' | 'coming';
  cta?: { label: string; route?: string; action?: () => void };
}[] = [
  {
    icon: <img src="/builder.svg" alt="" style={{ width: 60, height: 60 }} />,
    label: 'Application Builder',
    description:
      'Drag, drop, and configure. Build application templates with custom sections and questions, set field visibility rules, and control which distributors have access to each product — all without touching code.',
    accent: '#7C3AED',
    status: 'built',
    cta: { label: 'Open Builder', route: '/app-builder' },
  },
  {
    icon: <img src="/wizard.svg" alt="" style={{ width: 60, height: 60 }} />,
    label: 'E-App Wizard',
    description:
      'A clean, guided application experience advisors actually want to use. Step-by-step navigation, real-time validation, conditional logic, and one-click submission — all driven by your configured templates.',
    accent: '#0EA5E9',
    status: 'built',
    cta: { label: 'Start Application', route: '/wizard-v2' },
  },
  {
    icon: <img src="/crm.svg" alt="" style={{ width: 60, height: 60 }} />,
    label: 'E-App from CRM',
    description:
      'Connect directly to Redtail, Salesforce, and other major CRMs. An AI agent pulls client data, cross-references meeting notes and prior policies, and pre-populates fields in seconds — no copy-paste required.',
    accent: '#059669',
    status: 'built',
    cta: { label: 'Pre-fill from CRM', route: '/prefill' },
  },
  {
    icon: <img src="/chat.svg" alt="" style={{ width: 60, height: 60 }} />,
    label: 'AI Chat',
    description:
      'Skip the form altogether. Advisors have a natural conversation with an AI assistant that asks the right questions, captures responses, and fills the application in real time — bidirectionally synced with the wizard.',
    accent: '#D97706',
    status: 'built',
    cta: { label: 'Open Chat', action: () => openWidget() },
  },
  {
    icon: <img src="/history.svg" alt="" style={{ width: 60, height: 60 }} />,
    label: 'Application History',
    description:
      "Every application in one place. Pick up where you left off on in-progress apps, review and resubmit completed ones, or audit the full submission history — all accessible from a single dashboard.",
    accent: '#64748B',
    status: 'built',
    cta: { label: 'View Applications', route: '/applications' },
  },
  {
    icon: <img src="/agentic.svg" alt="" style={{ width: 60, height: 60 }} />,
    label: 'Agentic AI',
    description:
      'The full-power experience. Have a live voice-to-voice conversation with an AI that listens, understands, and fills your application. Upload checks, statements, or prior contracts and watch the agent extract and map every field automatically.',
    accent: '#DB2777',
    status: 'built',
    cta: { label: 'Try Voice AI', route: '/ai-experience' },
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Build Your Template',
    body: 'Use the Application Builder to define sections, questions, and visibility rules. Assign products to specific distributors — no code, no carrier calls, no waiting.',
  },
  {
    step: '02',
    title: 'Collect Data Your Way',
    body: "Advisors pick their path: step-by-step wizard, AI chat, voice conversation, or a CRM sync that pre-fills everything they've already captured. All inputs flow into the same normalized schema.",
  },
  {
    step: '03',
    title: 'Validate, Submit & Track',
    body: 'The engine enforces carrier rules in real time, catches NIGO issues before they reach the carrier, and keeps a full audit trail in Application History — from first draft to final submission.',
  },
];

function FeatureCard({ feature, navigate }: { feature: (typeof FEATURES)[0]; navigate: ReturnType<typeof useNavigate> }) {
  const built = feature.status === 'built';

  const handleCta = () => {
    if (feature.cta?.action) feature.cta.action();
    else if (feature.cta?.route) navigate(feature.cta.route);
  };

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s, transform 0.2s',
        '&:hover': built ? { boxShadow: 6, transform: 'translateY(-3px)' } : {},
      }}
    >
      {/* Colored graphic band */}
      <Box
        sx={{
          height: 88,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${feature.accent}22 0%, ${feature.accent}44 100%)`,
          borderBottom: `3px solid ${feature.accent}`,
          color: feature.accent,
        }}
      >
        {feature.icon}
      </Box>

      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.25}>
          <Typography variant="subtitle1" fontWeight={700}>{feature.label}</Typography>
          {built ? (
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
              label="Built"
              size="small"
              color="secondary"
              sx={{ fontSize: 10, height: 20 }}
            />
          ) : (
            <Chip label="Coming Soon" size="small" sx={{ fontSize: 10, height: 20, bgcolor: 'grey.200' }} />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" lineHeight={1.7} sx={{ flexGrow: 1 }}>
          {feature.description}
        </Typography>
        {feature.cta && (
          <Button
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardIcon />}
            onClick={handleCta}
            sx={{
              mt: 2.5,
              alignSelf: 'flex-start',
              borderColor: feature.accent,
              color: feature.accent,
              '&:hover': { borderColor: feature.accent, bgcolor: `${feature.accent}11` },
            }}
          >
            {feature.cta.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function RecentApplications({ saves }: { saves: SavedApplicationEntry[] }) {
  const navigate = useNavigate();
  if (saves.length === 0) return null;

  return (
    <Box sx={{ py: { xs: 6, md: 8 }, px: 3, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
          <Box>
            <Typography variant="overline" color="primary" fontWeight={700} display="block" mb={0.5}>
              In Progress
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              Continue where you left off
            </Typography>
          </Box>
          <Button variant="text" size="small" onClick={() => navigate('/applications')} endIcon={<ArrowForwardIcon />}>
            View all
          </Button>
        </Stack>

        <Grid container spacing={2}>
          {saves.map((save) => (
            <Grid key={save.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'primary.light',
                  height: '100%',
                  transition: 'box-shadow 0.15s',
                  '&:hover': { boxShadow: 3 },
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ fontSize: 9, letterSpacing: 0.8, lineHeight: 1.2, display: 'block' }}
                  >
                    {save.carrier}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={700} lineHeight={1.3} mb={0.5} noWrap>
                    {save.productName}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" display="block" mb={1.5}>
                    Saved {relativeTime(save.lastSavedAt)}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    color="primary"
                    endIcon={<ArrowForwardIcon />}
                    fullWidth
                    onClick={() =>
                      navigate(`/wizard-v2/${encodeURIComponent(save.productId)}?resume=${save.id}`)
                    }
                  >
                    Continue
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

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
  const inProgressSaves = listSaves().filter((s) => s.status === 'in_progress').slice(0, 3);

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

        <Container maxWidth="lg" sx={{ position: 'relative', textAlign: 'center' }}>
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
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon sx={{ transform: 'rotate(90deg)' }} />}
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            disableElevation
            sx={{
              mt: 2,
              fontWeight: 800,
              px: 5,
              py: 1.5,
              fontSize: '1rem',
              bgcolor: 'white',
              color: 'grey.900',
              '&:hover': { bgcolor: 'grey.100' },
            }}
          >
            Get Started
          </Button>
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
      <Box
        id="features"
        sx={{
          py: { xs: 8, md: 12 },
          px: 3,
          position: 'relative',
          backgroundImage: 'url(/bg.svg)',
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Parallax overlay — keeps cards legible */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'background.default',
            opacity: 0.9,
            pointerEvents: 'none',
          }}
        />
        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Typography variant="overline" color="primary" fontWeight={700} display="block" mb={1}>
            What We Built
          </Typography>
          <Typography variant="h4" fontWeight={700} mb={1}>
            Every piece of the application lifecycle — covered.
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={6} maxWidth={560}>
            From building and distributing application templates to collecting data via wizard, CRM sync, AI chat, or voice — all six features are live and demo-ready.
          </Typography>

          <Grid container spacing={3}>
            {FEATURES.map((f) => (
              <Grid key={f.label} size={{ xs: 12, sm: 6, md: 4 }}>
                <FeatureCard feature={f} navigate={navigate} />
              </Grid>
            ))}
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

      {/* ── Recent Applications ───────────────────────────────────────────── */}
      <RecentApplications saves={inProgressSaves} />

      {inProgressSaves.length > 0 && <Divider />}

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          py: { xs: 8, md: 10 },
          px: 3,
          textAlign: 'center',
          position: 'relative',
          backgroundImage: 'url(/bg.svg)',
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'background.default',
            opacity: 0.9,
            pointerEvents: 'none',
          }}
        />
        <Container maxWidth="md" sx={{ position: 'relative' }}>
          <Typography variant="h4" fontWeight={700} mb={1.5}>
            See it in action
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            Start a conversation with the AI assistant, walk through the guided wizard, or kick off
            a CRM pre-fill to see the full data pipeline end-to-end.
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
              endIcon={<ArrowForwardIcon />}
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
            <Button
              variant="outlined"
              size="large"
              endIcon={<PrecisionManufacturingIcon />}
              onClick={() => navigate('/prefill')}
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
              Pre-Fill from CRM
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
