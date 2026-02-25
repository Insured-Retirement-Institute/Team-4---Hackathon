import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { useVoiceConnection, type VoiceStatus } from '../hooks/useVoiceConnection';

interface VoicePanelProps {
  sessionId: string | null;
  compact?: boolean;
}

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: 'Click to start voice',
  connecting: 'Connecting...',
  connected: 'Listening...',
  speaking: 'AI speaking...',
  error: 'Connection error',
};

export default function VoicePanel({ sessionId, compact = false }: VoicePanelProps) {
  const { status, transcripts, connect, disconnect } = useVoiceConnection();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const isActive = status === 'connected' || status === 'speaking' || status === 'connecting';

  const handleToggle = () => {
    if (isActive) {
      disconnect();
    } else if (sessionId) {
      connect(sessionId);
    }
  };

  const micSize = compact ? 56 : 80;
  const pulseSize = compact ? 90 : 120;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Mic button area */}
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: compact ? 1.5 : 3, position: 'relative' }}>
        {/* Pulse ring */}
        {isActive && (
          <Box
            sx={{
              position: 'absolute',
              width: pulseSize,
              height: pulseSize,
              borderRadius: '50%',
              bgcolor: 'secondary.main',
              opacity: 0.15,
              animation: 'voicePulse 2s ease-in-out infinite',
              '@keyframes voicePulse': {
                '0%': { transform: 'scale(0.85)', opacity: 0.15 },
                '50%': { transform: 'scale(1.15)', opacity: 0.05 },
                '100%': { transform: 'scale(0.85)', opacity: 0.15 },
              },
            }}
          />
        )}
        <IconButton
          onClick={handleToggle}
          disabled={!sessionId}
          sx={{
            width: micSize,
            height: micSize,
            bgcolor: isActive ? 'error.main' : 'secondary.main',
            color: 'white',
            '&:hover': { bgcolor: isActive ? 'error.dark' : 'secondary.dark' },
            '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' },
            zIndex: 1,
            transition: 'background-color 0.2s',
          }}
        >
          {isActive ? <MicOffIcon sx={{ fontSize: compact ? 24 : 32 }} /> : <MicIcon sx={{ fontSize: compact ? 24 : 32 }} />}
        </IconButton>
      </Box>

      {/* Status text */}
      <Typography
        variant="caption"
        sx={{ textAlign: 'center', color: status === 'error' ? 'error.main' : 'text.secondary', mb: 1 }}
      >
        {STATUS_LABEL[status]}
      </Typography>

      {/* Transcript */}
      {!compact && transcripts.length > 0 && (
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 1 }}>
          <Stack spacing={1}>
            {transcripts.map((t, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <Box
                  sx={{
                    maxWidth: '80%',
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: t.role === 'user' ? 'grey.200' : 'primary.50',
                    border: '1px solid',
                    borderColor: t.role === 'user' ? 'grey.300' : 'primary.100',
                  }}
                >
                  <Typography variant="body2" sx={{ fontSize: 13 }}>
                    {t.text}
                  </Typography>
                </Box>
              </Box>
            ))}
            <div ref={scrollRef} />
          </Stack>
        </Box>
      )}
    </Box>
  );
}
