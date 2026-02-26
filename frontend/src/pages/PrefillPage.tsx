import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useApplication } from '../context/ApplicationContext';
import { openWidget } from '../hooks/useWidgetSync';
import { createSession } from '../services/aiService';
import {
  type Client,
  type PrefillResult,
  fetchClients,
  runPrefill,
  runPrefillWithDocument,
} from '../services/prefillService';

type Stage = 'input' | 'loading' | 'results';

export default function PrefillPage() {
  const navigate = useNavigate();
  const { setSessionId, setPhase, mergeFields, setPendingSync } = useApplication();

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('input');
  const [result, setResult] = useState<PrefillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load client list on mount
  useEffect(() => {
    fetchClients()
      .then(setClients)
      .catch((err) => console.error('Failed to load clients:', err));
  }, []);

  const handleGatherData = useCallback(async () => {
    if (!selectedClient && !uploadedFile) return;

    setStage('loading');
    setError(null);

    try {
      let prefillResult: PrefillResult;

      if (uploadedFile) {
        prefillResult = await runPrefillWithDocument(uploadedFile, selectedClient?.client_id);
      } else {
        prefillResult = await runPrefill(selectedClient!.client_id);
      }

      setResult(prefillResult);
      setStage('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pre-fill failed');
      setStage('input');
    }
  }, [selectedClient, uploadedFile]);

  const handleStartApplication = useCallback(async () => {
    if (!result) return;

    setStartingSession(true);
    try {
      const session = await createSession('midland-fixed-annuity-001', result.known_data);
      setSessionId(session.session_id);
      setPhase(session.phase);
      mergeFields(result.known_data);
      setPendingSync(true);
      navigate('/');
      // Open widget after navigation so user sees the AI chat with pre-filled data
      setTimeout(() => openWidget(), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setStartingSession(false);
    }
  }, [result, navigate, setSessionId, setPhase, mergeFields, setPendingSync]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0] ?? null;
    setUploadedFile(file);
  };

  return (
    <Box sx={{ py: { xs: 4, md: 6 }, px: 3, minHeight: '80vh' }}>
      <Container maxWidth="sm">
        <Typography variant="h4" fontWeight={700} mb={1}>
          Pre-Fill Application Data
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Select a client from your CRM or upload a document to automatically gather application data before starting.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* ── Input Stage ──────────────────────────────────────────────── */}
        {stage === 'input' && (
          <Stack spacing={3}>
            {/* Client Selector */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} mb={2}>
                  Select Client from CRM
                </Typography>
                <Autocomplete
                  options={clients}
                  getOptionLabel={(option) => option.display_name}
                  value={selectedClient}
                  onChange={(_, value) => setSelectedClient(value)}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Search clients..." size="small" />
                  )}
                  isOptionEqualToValue={(option, value) => option.client_id === value.client_id}
                />
              </CardContent>
            </Card>

            <Divider>
              <Typography variant="caption" color="text.secondary">
                OR
              </Typography>
            </Divider>

            {/* Document Upload */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} mb={2}>
                  Upload Document
                </Typography>
                <Box
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    border: '2px dashed',
                    borderColor: uploadedFile ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: uploadedFile ? 'primary.50' : 'transparent',
                    transition: 'border-color 0.2s, background-color 0.2s',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {uploadedFile ? uploadedFile.name : 'Drag & drop or click to upload (PDF, PNG, JPG)'}
                  </Typography>
                </Box>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  hidden
                  onChange={handleFileChange}
                />
              </CardContent>
            </Card>

            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={handleGatherData}
              disabled={!selectedClient && !uploadedFile}
              disableElevation
              sx={{ fontWeight: 700 }}
            >
              Gather Data
            </Button>
          </Stack>
        )}

        {/* ── Loading Stage ────────────────────────────────────────────── */}
        {stage === 'loading' && (
          <Card variant="outlined">
            <CardContent sx={{ py: 6, textAlign: 'center' }}>
              <CircularProgress size={48} sx={{ mb: 3 }} />
              <Typography variant="h6" fontWeight={600} mb={1}>
                Gathering application data...
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                The AI agent is pulling data from CRM, prior policies, and any uploaded documents.
              </Typography>
              <LinearProgress sx={{ maxWidth: 300, mx: 'auto' }} />
            </CardContent>
          </Card>
        )}

        {/* ── Results Stage ────────────────────────────────────────────── */}
        {stage === 'results' && result && (
          <Stack spacing={3}>
            <Card variant="outlined" sx={{ borderColor: 'success.light' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} mb={2}>
                  Data Gathered Successfully
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {result.summary}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                  <Chip
                    label={`${result.fields_found} fields`}
                    color="primary"
                    size="small"
                  />
                  {result.sources_used.map((src) => (
                    <Chip key={src} label={src} variant="outlined" size="small" />
                  ))}
                </Stack>

                {/* Field preview */}
                <Box
                  sx={{
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    p: 2,
                    maxHeight: 240,
                    overflow: 'auto',
                  }}
                >
                  {Object.entries(result.known_data).map(([key, value]) => (
                    <Stack key={key} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {key}
                      </Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {String(value)}
                      </Typography>
                    </Stack>
                  ))}
                </Box>
              </CardContent>
            </Card>

            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={() => {
                  setStage('input');
                  setResult(null);
                }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={startingSession ? <CircularProgress size={18} color="inherit" /> : <SmartToyIcon />}
                onClick={handleStartApplication}
                disabled={startingSession}
                disableElevation
                sx={{ fontWeight: 700, flex: 1 }}
              >
                {startingSession ? 'Starting...' : 'Start Application'}
              </Button>
            </Stack>
          </Stack>
        )}
      </Container>
    </Box>
  );
}
