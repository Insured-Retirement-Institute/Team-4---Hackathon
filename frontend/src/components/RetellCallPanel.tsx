import { useCallback, useEffect, useRef, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CallIcon from '@mui/icons-material/Call';
import CallEndIcon from '@mui/icons-material/CallEnd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import { initiateCall, getCallStatus, type CallStatus } from '../services/retellService';

interface RetellCallPanelProps {
  missingFields: Array<{ id: string; label: string }>;
  clientPhone: string;
  clientName: string;
  advisorName: string;
  onFieldsExtracted: (fields: Record<string, string>) => void;
  onCallComplete: () => void;
}

type CallStage = 'idle' | 'ringing' | 'in-progress' | 'ended' | 'error';

export default function RetellCallPanel({
  missingFields,
  clientPhone,
  clientName,
  advisorName,
  onFieldsExtracted,
  onCallComplete,
}: RetellCallPanelProps) {
  const [callStage, setCallStage] = useState<CallStage>('idle');
  const [, setCallId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<Array<{ role: string; content: string }>>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const endedAtRef = useRef(0); // track when call ended, to keep polling for analysis

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleCall = async () => {
    setCallStage('ringing');
    setError(null);
    setTranscript(null);
    setExtractedFields({});
    setLiveTranscript([]);
    setDuration(0);

    try {
      const result = await initiateCall({
        to_number: clientPhone,
        missing_fields: missingFields,
        client_name: clientName,
        advisor_name: advisorName,
      });

      setCallId(result.call_id);

      // Start duration timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const status: CallStatus = await getCallStatus(result.call_id);

          // Update live transcript
          if (status.live_transcript && status.live_transcript.length > 0) {
            setLiveTranscript(status.live_transcript);
          }

          if (status.status === 'in-progress') {
            setCallStage('in-progress');
          } else if (status.status === 'ended') {
            setCallStage('ended');

            if (status.transcript) setTranscript(status.transcript);
            if (status.duration_seconds) setDuration(Math.round(status.duration_seconds));

            const fields = status.extracted_fields ?? {};
            setExtractedFields(fields);

            if (Object.keys(fields).length > 0) {
              // Got fields — stop polling and notify parent
              stopPolling();
              onFieldsExtracted(fields);
              onCallComplete();
            } else if (!endedAtRef.current) {
              // First time seeing "ended" — keep polling for analysis (up to 20s)
              endedAtRef.current = Date.now();
              console.log('[RetellCall] Call ended, waiting for analysis...');
            } else if (Date.now() - endedAtRef.current > 20000) {
              // Timed out waiting for analysis
              console.log('[RetellCall] Analysis timeout — completing without fields');
              stopPolling();
              onCallComplete();
            }
          } else if (status.status === 'error') {
            setCallStage('error');
            setError('Call failed');
            stopPolling();
          }
        } catch {
          // polling error, continue
        }
      }, 3000);
    } catch (err) {
      setCallStage('error');
      setError(err instanceof Error ? err.message : 'Failed to initiate call');
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Call button and status */}
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        {callStage === 'idle' && (
          <Button
            variant="contained"
            size="large"
            color="success"
            startIcon={<CallIcon />}
            onClick={handleCall}
            disabled={missingFields.length === 0}
            sx={{ fontWeight: 700, px: 4 }}
          >
            Call Client
          </Button>
        )}

        {callStage === 'ringing' && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={24} color="warning" />
            <Typography variant="body1" fontWeight={600} color="warning.main">
              Ringing {clientPhone}...
            </Typography>
          </Stack>
        )}

        {callStage === 'in-progress' && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <PhoneInTalkIcon color="success" sx={{ animation: 'pulse 1.5s infinite' }} />
            <Typography variant="body1" fontWeight={600} color="success.main">
              In Progress
            </Typography>
            <Chip
              label={formatDuration(duration)}
              size="small"
              sx={{ fontFamily: 'monospace', fontWeight: 700 }}
            />
          </Stack>
        )}

        {callStage === 'ended' && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CheckCircleIcon color="success" />
            <Typography variant="body1" fontWeight={600}>
              Call Complete
            </Typography>
            <Chip
              label={formatDuration(duration)}
              size="small"
              variant="outlined"
              sx={{ fontFamily: 'monospace' }}
            />
            {Object.keys(extractedFields).length > 0 && (
              <Chip
                label={`${Object.keys(extractedFields).length} fields collected`}
                size="small"
                color="success"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Stack>
        )}

        {callStage === 'error' && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CallEndIcon color="error" />
            <Typography variant="body1" color="error.main">
              {error ?? 'Call failed'}
            </Typography>
            <Button variant="outlined" size="small" onClick={() => setCallStage('idle')}>
              Retry
            </Button>
          </Stack>
        )}
      </Stack>

      {/* Missing fields being collected */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          Fields to collect ({missingFields.length}):
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {missingFields.slice(0, 12).map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              size="small"
              variant={extractedFields[f.id] ? 'filled' : 'outlined'}
              color={extractedFields[f.id] ? 'success' : 'default'}
              sx={{ fontSize: 11 }}
            />
          ))}
          {missingFields.length > 12 && (
            <Chip label={`+${missingFields.length - 12} more`} size="small" sx={{ fontSize: 11 }} />
          )}
        </Box>
      </Box>

      {/* Live transcript during call */}
      {(callStage === 'in-progress' || callStage === 'ringing') && liveTranscript.length > 0 && (
        <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 2, maxHeight: 200, overflowY: 'auto', mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Live Transcript
          </Typography>
          {liveTranscript.map((entry, i) => (
            <Typography key={i} variant="body2" sx={{ mb: 0.5, fontSize: 12 }}>
              <strong>{entry.role}:</strong> {entry.content}
            </Typography>
          ))}
        </Box>
      )}

      {/* Completed: transcript accordion + extracted fields */}
      {callStage === 'ended' && transcript && (
        <Accordion sx={{ mt: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Call Transcript</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, maxHeight: 300, overflowY: 'auto' }}
            >
              {transcript}
            </Typography>
          </AccordionDetails>
        </Accordion>
      )}

      {callStage === 'ended' && Object.keys(extractedFields).length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Extracted Values:
          </Typography>
          <Stack spacing={0.5}>
            {Object.entries(extractedFields).map(([k, v]) => (
              <Box key={k} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 160 }}>
                  {k}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {String(v).slice(0, 60)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
