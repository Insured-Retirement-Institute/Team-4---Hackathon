import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChatIcon from '@mui/icons-material/Chat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import MicIcon from '@mui/icons-material/Mic';
import PeopleIcon from '@mui/icons-material/People';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PhoneIcon from '@mui/icons-material/Phone';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PolicyIcon from '@mui/icons-material/Policy';
import ReplayIcon from '@mui/icons-material/Replay';
import SummarizeIcon from '@mui/icons-material/Summarize';
import TuneIcon from '@mui/icons-material/Tune';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useApplication } from '../context/ApplicationContext';
import { openWidget } from '../hooks/useWidgetSync';
import { createSession } from '../services/aiService';
import { getProducts, getApplication, type Product } from '../services/apiService';
import ChatPanel from '../components/ChatPanel';
import VoicePanel from '../components/VoicePanel';
import RetellCallPanel from '../components/RetellCallPanel';
import type { ApplicationDefinition } from '../types/application';
import {
  type Client,
  type StreamEvent,
  fetchClients,
  runPrefillStream,
} from '../services/prefillService';

// ── Types ────────────────────────────────────────────────────────────────────

type Stage = 'setup' | 'voice_active' | 'gap_review' | 'client_call' | 'results';

interface ToolLogEntry {
  name: string;
  description: string;
  iteration: number;
  status: 'running' | 'done';
  startTime: number;
  durationMs?: number;
  fieldsExtracted: Record<string, string>;
}

interface MatchedField {
  id: string;
  label: string;
  pageTitle: string;
  value: string | null;
  filled: boolean;
}

// ── Tool metadata ────────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: React.ReactNode }> = {
  lookup_crm_client: { label: 'CRM Client Lookup', icon: <PersonSearchIcon fontSize="small" /> },
  lookup_family_members: { label: 'Family & Spouse Lookup', icon: <PeopleIcon fontSize="small" /> },
  lookup_crm_notes: { label: 'CRM Notes Analysis', icon: <DescriptionIcon fontSize="small" /> },
  lookup_prior_policies: { label: 'Prior Policy Lookup', icon: <PolicyIcon fontSize="small" /> },
  lookup_annual_statements: { label: 'Annual Statement Retrieval', icon: <PictureAsPdfIcon fontSize="small" /> },
  extract_document_fields: { label: 'Document Field Extraction', icon: <DescriptionIcon fontSize="small" /> },
  get_advisor_preferences: { label: 'Advisor Preferences', icon: <TuneIcon fontSize="small" /> },
  get_carrier_suitability: { label: 'Carrier Suitability Check', icon: <VerifiedUserIcon fontSize="small" /> },
  report_prefill_results: { label: 'Compiling Results', icon: <SummarizeIcon fontSize="small" /> },
};

const ADVISOR_ID = 'advisor_002';
const ADVISOR_NAME = 'Andrew Barnett';

const CLIENT_PHONE = '+17042076820';

// ── Elapsed timer hook ───────────────────────────────────────────────────────

function useElapsed(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    setElapsed(0);
    const interval = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(interval);
  }, [running]);

  return elapsed;
}

// ── Tool log entry component ─────────────────────────────────────────────────

function ToolLogItem({ entry, now }: { entry: ToolLogEntry; now: number }) {
  const meta = TOOL_META[entry.name] ?? { label: entry.name, icon: <AutoAwesomeIcon fontSize="small" /> };
  const elapsed = entry.status === 'done' ? entry.durationMs! : now - entry.startTime;

  return (
    <Box sx={{ py: 1, px: 2, '&:not(:last-child)': { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ color: entry.status === 'done' ? 'success.main' : 'warning.main', display: 'flex' }}>
          {entry.status === 'done' ? <CheckCircleIcon fontSize="small" /> : meta.icon}
        </Box>
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', color: 'grey.200', flex: 1 }}
        >
          {meta.label}
          <Typography component="span" variant="caption" sx={{ ml: 1, color: 'grey.500' }}>
            {entry.description}
          </Typography>
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: entry.status === 'done' ? 'success.light' : 'warning.light', minWidth: 56, textAlign: 'right' }}>
          {(elapsed / 1000).toFixed(1)}s
        </Typography>
      </Stack>
      {entry.status === 'done' && Object.keys(entry.fieldsExtracted).length > 0 && entry.name !== 'report_prefill_results' && (
        <Box sx={{ mt: 0.75, ml: 4.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {Object.entries(entry.fieldsExtracted).slice(0, 8).map(([k, v]) => (
            <Chip
              key={k}
              label={`${k}: ${String(v).slice(0, 30)}`}
              size="small"
              sx={{ fontSize: 10, height: 20, bgcolor: 'rgba(102,187,106,0.15)', color: 'success.light', fontFamily: 'monospace' }}
            />
          ))}
          {Object.keys(entry.fieldsExtracted).length > 8 && (
            <Chip label={`+${Object.keys(entry.fieldsExtracted).length - 8} more`} size="small" sx={{ fontSize: 10, height: 20, bgcolor: 'rgba(255,255,255,0.08)', color: 'grey.400' }} />
          )}
        </Box>
      )}
    </Box>
  );
}

// ── Field matching table ─────────────────────────────────────────────────────

function FieldMatchingTable({ matchedFields, products, productId }: {
  matchedFields: MatchedField[];
  products: Product[];
  productId: string;
}) {
  const filledCount = matchedFields.filter((f) => f.filled).length;
  const totalCount = matchedFields.length;
  const filledPct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  const fieldsByPage: Record<string, MatchedField[]> = {};
  for (const f of matchedFields) {
    (fieldsByPage[f.pageTitle] ??= []).push(f);
  }

  if (matchedFields.length === 0) return null;

  return (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="subtitle1" fontWeight={700}>
          Field Matching — {products.find((p) => p.productId === productId)?.productName ?? productId}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {filledCount} of {totalCount} fields pre-filled ({filledPct}%)
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={filledPct}
        color="secondary"
        sx={{ height: 8, borderRadius: 4, mb: 3 }}
      />

      {Object.entries(fieldsByPage).map(([pageTitle, fields]) => {
        const pageFilled = fields.filter((f) => f.filled).length;
        return (
          <Box key={pageTitle} sx={{ mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" fontWeight={700}>{pageTitle}</Typography>
              <Typography variant="caption" color="text.secondary">
                {pageFilled}/{fields.length}
              </Typography>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
              {fields.map((f) => (
                <Box
                  key={f.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    bgcolor: f.filled ? 'rgba(102,187,106,0.06)' : 'rgba(255,152,0,0.04)',
                    border: '1px solid',
                    borderColor: f.filled ? 'rgba(102,187,106,0.2)' : 'rgba(255,152,0,0.15)',
                  }}
                >
                  {f.filled ? (
                    <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', flexShrink: 0 }} />
                  ) : (
                    <ErrorOutlineIcon sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0 }} />
                  )}
                  <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary' }}>{f.label}</Typography>
                  {f.filled ? (
                    <Typography variant="caption" fontWeight={600} sx={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.value}
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'warning.main', fontStyle: 'italic' }}>Missing</Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AIExperiencePage() {
  const navigate = useNavigate();
  const { setSessionId, setPhase, mergeFields } = useApplication();

  // Setup state
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [productId, setProductId] = useState('midland-fixed-annuity-001');

  // Stage state
  const [stage, setStage] = useState<Stage>('setup');
  const [toolLog, setToolLog] = useState<ToolLogEntry[]>([]);
  const [gatheredFields, setGatheredFields] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sseStartedRef = useRef(false);
  const elapsed = useElapsed(stage === 'voice_active');

  // Interaction mode: voice or chat
  const [interactionMode, setInteractionMode] = useState<'voice' | 'chat'>('voice');

  // Voice session
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  const [chatGreeting, setChatGreeting] = useState<string>('');

  // Results state
  const [finalResult, setFinalResult] = useState<StreamEvent | null>(null);
  const [definition, setDefinition] = useState<ApplicationDefinition | null>(null);
  const [matchedFields, setMatchedFields] = useState<MatchedField[]>([]);
  const [startingSession, setStartingSession] = useState(false);

  // Load clients and products on mount
  useEffect(() => {
    fetchClients().then(setClients).catch(console.error);
    getProducts().then(setProducts).catch(console.error);
  }, []);

  // Tick timer for running tool entries
  useEffect(() => {
    if (stage !== 'voice_active') return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [stage]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [toolLog]);

  // Compute matched fields whenever we have results + definition
  const computeMatchedFields = useCallback((knownData: Record<string, string>, def: ApplicationDefinition) => {
    // Build a lookup that maps both camelCase and snake_case keys to values
    const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const lookup: Record<string, string> = {};
    for (const [k, v] of Object.entries(knownData)) {
      lookup[k] = v;
      lookup[snakeToCamel(k)] = v;
      lookup[camelToSnake(k)] = v;
    }

    const allQuestions = def.pages.flatMap((p) =>
      p.questions.map((q) => ({ ...q, pageTitle: p.title })),
    );
    const matched = allQuestions.map((q) => ({
      id: q.id,
      label: q.label,
      pageTitle: q.pageTitle,
      value: lookup[q.id] ?? null,
      filled: q.id in lookup,
    }));
    setMatchedFields(matched);
  }, []);

  // Load product definition on gap_review or results
  useEffect(() => {
    if (stage !== 'gap_review' && stage !== 'results') return;
    if (!finalResult?.known_data) return;
    getApplication(productId).then((def) => {
      setDefinition(def);
      computeMatchedFields(finalResult.known_data as Record<string, string>, def);
    }).catch(console.error);
  }, [stage, finalResult, productId, computeMatchedFields]);

  const handleEvent = useCallback((event: StreamEvent) => {
    if (event.type === 'tool_start') {
      setToolLog((prev) => [
        ...prev,
        {
          name: event.name!,
          description: event.description ?? '',
          iteration: event.iteration ?? 0,
          status: 'running',
          startTime: Date.now(),
          fieldsExtracted: {},
        },
      ]);
    } else if (event.type === 'tool_result') {
      setToolLog((prev) =>
        prev.map((entry) =>
          entry.name === event.name && entry.status === 'running'
            ? { ...entry, status: 'done' as const, durationMs: event.duration_ms ?? 0, fieldsExtracted: event.fields_extracted ?? {} }
            : entry,
        ),
      );
      if (event.fields_extracted && event.name !== 'report_prefill_results') {
        setGatheredFields((prev) => ({ ...prev, ...event.fields_extracted }));
      }
    } else if (event.type === 'agent_complete') {
      setFinalResult(event);
      setStage('gap_review');
    }
  }, []);

  // Start SSE prefill when client is selected during voice_active stage
  const startSSEIfReady = useCallback((client: Client) => {
    if (sseStartedRef.current) return;
    sseStartedRef.current = true;
    abortRef.current = runPrefillStream(client.client_id, ADVISOR_ID, handleEvent);
  }, [handleEvent]);

  // When client selection changes during voice_active, kick off SSE
  useEffect(() => {
    if (stage === 'voice_active' && selectedClient && !sseStartedRef.current) {
      startSSEIfReady(selectedClient);
    }
  }, [stage, selectedClient, startSSEIfReady]);

  const handleStartVoice = useCallback(async () => {
    // Reset state
    setToolLog([]);
    setGatheredFields({});
    setFinalResult(null);
    setMatchedFields([]);
    setDefinition(null);
    sseStartedRef.current = false;

    // Create a session (used for both voice and chat)
    try {
      const session = await createSession(productId, undefined, ADVISOR_NAME);
      setVoiceSessionId(session.session_id);
      setChatGreeting(session.greeting || '');
    } catch (err) {
      console.error('Failed to create session:', err);
    }

    // Transition to voice_active
    setStage('voice_active');

    // If client already selected, start SSE immediately
    if (selectedClient) {
      sseStartedRef.current = true;
      abortRef.current = runPrefillStream(selectedClient.client_id, ADVISOR_ID, handleEvent);
    }
  }, [selectedClient, productId, handleEvent]);

  const handleStartApplication = useCallback(async () => {
    if (!finalResult?.known_data) return;
    setStartingSession(true);
    try {
      // Normalize snake_case keys to camelCase so they match application definition question IDs
      const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(finalResult.known_data as Record<string, string>)) {
        normalized[snakeToCamel(k)] = v;
      }
      const session = await createSession(productId, normalized, ADVISOR_NAME);
      setSessionId(session.session_id);
      setPhase('SPOT_CHECK');
      mergeFields(normalized);
      navigate('/');
      setTimeout(() => openWidget(), 300);
    } catch (err) {
      console.error('Failed to start session:', err);
    } finally {
      setStartingSession(false);
    }
  }, [finalResult, productId, navigate, setSessionId, setPhase, mergeFields]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setStage('setup');
    setToolLog([]);
    setGatheredFields({});
    setFinalResult(null);
    setMatchedFields([]);
    setDefinition(null);
    setVoiceSessionId(null);
    setChatGreeting('');
    setInteractionMode('voice');
    sseStartedRef.current = false;
  }, []);

  const handleChatToolCalls = useCallback((tools: Array<{ name: string }>) => {
    for (const tool of tools) {
      setToolLog((prev) => [
        ...prev,
        {
          name: tool.name,
          description: 'via chat',
          iteration: 0,
          status: 'done' as const,
          startTime: Date.now(),
          durationMs: 0,
          fieldsExtracted: {},
        },
      ]);
    }
  }, []);

  const handleCallFieldsExtracted = useCallback((fields: Record<string, string>) => {
    setGatheredFields((prev) => ({ ...prev, ...fields }));
    setFinalResult((prev) => {
      if (!prev?.known_data) return prev;
      return {
        ...prev,
        known_data: { ...prev.known_data, ...fields },
        fields_found: (prev.fields_found ?? 0) + Object.keys(fields).length,
      };
    });
  }, []);

  const handleCallComplete = useCallback(() => {
    if (finalResult?.known_data && definition) {
      const merged = { ...finalResult.known_data, ...gatheredFields };
      computeMatchedFields(merged, definition);
    }
    setStage('results');
  }, [finalResult, definition, gatheredFields, computeMatchedFields]);

  const missingFields = matchedFields.filter((f) => !f.filled).map((f) => ({ id: f.id, label: f.label }));
  const advisorLabel = ADVISOR_NAME;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: 'grey.900', color: 'white', py: 4, px: 3 }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
            <AutoAwesomeIcon color="secondary" />
            <Typography variant="h5" fontWeight={700}>AI Experience</Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: 'grey.400' }}>
            Voice-first advisor experience: pick your advisor, start talking, and watch the AI gather client data in real-time.
          </Typography>
        </Container>
      </Box>

      <Box sx={{ flex: 1, py: 4, px: 3, bgcolor: 'background.default' }}>
        <Container maxWidth="lg">

          {/* ── SETUP STAGE ─────────────────────────────────────────────── */}
          {stage === 'setup' && (
            <Box>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Typography variant="h6" fontWeight={600} color="text.secondary">
                  Welcome, {ADVISOR_NAME}
                </Typography>
              </Box>

              {/* Client and product selection */}
              <Paper sx={{ p: 3, mb: 4, borderRadius: 2, maxWidth: 600, mx: 'auto' }}>
                <Stack spacing={2.5}>
                  <Autocomplete
                    options={clients}
                    getOptionLabel={(o) => o.display_name}
                    value={selectedClient}
                    onChange={(_, v) => setSelectedClient(v)}
                    renderInput={(params) => <TextField {...params} label="Select CRM Client" />}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Product</InputLabel>
                    <Select value={productId} label="Product" onChange={(e) => setProductId(e.target.value)}>
                      {products.map((p) => (
                        <MenuItem key={p.productId} value={p.productId}>{p.productName}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Paper>

              <Box sx={{ textAlign: 'center' }}>
                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button
                    variant="contained"
                    size="large"
                    color="secondary"
                    disableElevation
                    disabled={!selectedClient}
                    startIcon={<MicIcon />}
                    onClick={() => { setInteractionMode('voice'); handleStartVoice(); }}
                    sx={{ fontWeight: 700, px: 5, py: 2, fontSize: '1.1rem', borderRadius: 3 }}
                  >
                    Start with Voice
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    color="secondary"
                    disabled={!selectedClient}
                    startIcon={<ChatIcon />}
                    onClick={() => { setInteractionMode('chat'); handleStartVoice(); }}
                    sx={{ fontWeight: 700, px: 5, py: 2, fontSize: '1.1rem', borderRadius: 3 }}
                  >
                    Start with Chat
                  </Button>
                </Stack>
                {!selectedClient && (
                  <Typography variant="body2" color="text.secondary" mt={2}>
                    Select a client above to get started
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* ── VOICE ACTIVE STAGE ──────────────────────────────────────── */}
          {stage === 'voice_active' && (
            <Box>
              {/* Mode toggle */}
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <ToggleButtonGroup
                  value={interactionMode}
                  exclusive
                  onChange={(_, v) => { if (v) setInteractionMode(v); }}
                  size="small"
                >
                  <ToggleButton value="voice"><MicIcon sx={{ mr: 0.5, fontSize: 18 }} /> Voice</ToggleButton>
                  <ToggleButton value="chat"><ChatIcon sx={{ mr: 0.5, fontSize: 18 }} /> Chat</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Voice or Chat Panel */}
              <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden', height: interactionMode === 'chat' ? 400 : 300 }}>
                <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {interactionMode === 'voice' ? 'Voice' : 'Chat'} Session — {advisorLabel}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Client: {selectedClient?.display_name}
                  </Typography>
                </Box>
                {interactionMode === 'voice' ? (
                  <VoicePanel sessionId={voiceSessionId} />
                ) : (
                  <ChatPanel sessionId={voiceSessionId} greeting={chatGreeting} onToolCalls={handleChatToolCalls} />
                )}
              </Paper>

              {/* Agent Log + Field Accumulator */}
              {(
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <Paper sx={{ bgcolor: 'grey.900', borderRadius: 2, overflow: 'hidden', height: 400, display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ color: 'grey.300', fontFamily: 'monospace' }}>
                          Agent Log — {selectedClient?.display_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'secondary.main', fontFamily: 'monospace', fontWeight: 700 }}>
                          {(elapsed / 1000).toFixed(1)}s elapsed
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
                        {toolLog.map((entry, i) => (
                          <ToolLogItem key={`${entry.name}-${i}`} entry={entry} now={now} />
                        ))}
                        <div ref={logEndRef} />
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 5 }}>
                    <Paper sx={{ bgcolor: 'grey.50', borderRadius: 2, height: 400, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2" fontWeight={700}>Fields Gathered</Typography>
                        <Chip label={Object.keys(gatheredFields).length} size="small" color="secondary" sx={{ fontWeight: 700 }} />
                      </Box>
                      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                        {Object.keys(gatheredFields).length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                            Waiting for agent to extract fields...
                          </Typography>
                        ) : (
                          <Stack spacing={0.75}>
                            {Object.entries(gatheredFields).map(([k, v]) => (
                              <Box key={k} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 160, flexShrink: 0 }}>
                                  {k}
                                </Typography>
                                <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                                  {String(v).slice(0, 60)}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}

          {/* ── GAP REVIEW STAGE ────────────────────────────────────────── */}
          {stage === 'gap_review' && finalResult && (
            <Box>
              {/* Compact voice/chat panel */}
              {voiceSessionId && (
                <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden', height: interactionMode === 'chat' ? 300 : 160 }}>
                  <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {interactionMode === 'voice' ? 'Voice' : 'Chat'} Session (active)
                    </Typography>
                    <ToggleButtonGroup
                      value={interactionMode}
                      exclusive
                      onChange={(_, v) => { if (v) setInteractionMode(v); }}
                      size="small"
                    >
                      <ToggleButton value="voice" sx={{ py: 0.25, px: 1 }}><MicIcon sx={{ fontSize: 16 }} /></ToggleButton>
                      <ToggleButton value="chat" sx={{ py: 0.25, px: 1 }}><ChatIcon sx={{ fontSize: 16 }} /></ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  {interactionMode === 'voice' ? (
                    <VoicePanel sessionId={voiceSessionId} compact />
                  ) : (
                    <ChatPanel sessionId={voiceSessionId} greeting={chatGreeting} onToolCalls={handleChatToolCalls} />
                  )}
                </Paper>
              )}

              {/* Summary bar */}
              <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="overline" color="text.secondary">Fields Found</Typography>
                    <Typography variant="h4" fontWeight={800} color="secondary">{finalResult.fields_found}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="overline" color="text.secondary">Total Time</Typography>
                    <Typography variant="h4" fontWeight={800}>
                      {((finalResult.total_duration_ms ?? 0) / 1000).toFixed(1)}s
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="overline" color="text.secondary">Sources</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {(finalResult.sources_used ?? []).map((s) => (
                        <Chip key={s} label={s} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="overline" color="text.secondary">Suitability</Typography>
                    <Typography variant="h5" fontWeight={700} color={
                      finalResult.known_data?.suitability_rating === 'Excellent' ? 'success.main' :
                      finalResult.known_data?.suitability_rating === 'Good' ? 'info.main' : 'text.primary'
                    }>
                      {finalResult.known_data?.suitability_rating ?? 'N/A'}
                      {finalResult.known_data?.suitability_score && (
                        <Typography component="span" variant="body2" color="text.secondary" ml={1}>
                          ({finalResult.known_data.suitability_score})
                        </Typography>
                      )}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              <FieldMatchingTable matchedFields={matchedFields} products={products} productId={productId} />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                {missingFields.length > 0 && (
                  <Button
                    variant="contained"
                    size="large"
                    color="success"
                    disableElevation
                    startIcon={<PhoneIcon />}
                    onClick={() => setStage('client_call')}
                    sx={{ fontWeight: 700, px: 4 }}
                  >
                    Call Client to Fill Gaps ({missingFields.length} fields)
                  </Button>
                )}
                <Button
                  variant="contained"
                  size="large"
                  color="secondary"
                  disableElevation
                  startIcon={<AutoAwesomeIcon />}
                  onClick={handleStartApplication}
                  disabled={startingSession}
                  sx={{ fontWeight: 700, px: 4 }}
                >
                  {startingSession ? 'Starting...' : 'Start Application'}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate(`/wizard-v2/${encodeURIComponent(productId)}`)}
                  sx={{ fontWeight: 600, px: 4 }}
                >
                  Open in Wizard
                </Button>
              </Stack>
            </Box>
          )}

          {/* ── CLIENT CALL STAGE ───────────────────────────────────────── */}
          {stage === 'client_call' && finalResult && (
            <Box>
              <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Client Phone Call
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Calling {selectedClient?.display_name ?? 'client'} to collect missing information
                  </Typography>
                </Box>
                <RetellCallPanel
                  missingFields={missingFields}
                  clientPhone={CLIENT_PHONE}
                  clientName={selectedClient?.display_name ?? 'the client'}
                  advisorName={ADVISOR_NAME}
                  onFieldsExtracted={handleCallFieldsExtracted}
                  onCallComplete={handleCallComplete}
                />
              </Paper>

              <FieldMatchingTable matchedFields={matchedFields} products={products} productId={productId} />

              {voiceSessionId && (
                <Paper sx={{ borderRadius: 2, overflow: 'hidden', height: 120 }}>
                  <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">Voice (available)</Typography>
                  </Box>
                  <VoicePanel sessionId={voiceSessionId} compact />
                </Paper>
              )}
            </Box>
          )}

          {/* ── RESULTS STAGE ───────────────────────────────────────────── */}
          {stage === 'results' && finalResult && (
            <Box>
              <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="overline" color="text.secondary">Fields Found</Typography>
                    <Typography variant="h4" fontWeight={800} color="secondary">{finalResult.fields_found}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="overline" color="text.secondary">Total Time</Typography>
                    <Typography variant="h4" fontWeight={800}>
                      {((finalResult.total_duration_ms ?? 0) / 1000).toFixed(1)}s
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="overline" color="text.secondary">Sources</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {(finalResult.sources_used ?? []).map((s) => (
                        <Chip key={s} label={s} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Typography variant="overline" color="text.secondary">Suitability</Typography>
                    <Typography variant="h5" fontWeight={700} color={
                      finalResult.known_data?.suitability_rating === 'Excellent' ? 'success.main' :
                      finalResult.known_data?.suitability_rating === 'Good' ? 'info.main' : 'text.primary'
                    }>
                      {finalResult.known_data?.suitability_rating ?? 'N/A'}
                      {finalResult.known_data?.suitability_score && (
                        <Typography component="span" variant="body2" color="text.secondary" ml={1}>
                          ({finalResult.known_data.suitability_score})
                        </Typography>
                      )}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              <FieldMatchingTable matchedFields={matchedFields} products={products} productId={productId} />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                <Button
                  variant="contained"
                  size="large"
                  color="secondary"
                  disableElevation
                  startIcon={<AutoAwesomeIcon />}
                  onClick={handleStartApplication}
                  disabled={startingSession}
                  sx={{ fontWeight: 700, px: 4 }}
                >
                  {startingSession ? 'Starting...' : 'Start Application'}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate(`/wizard-v2/${encodeURIComponent(productId)}`)}
                  sx={{ fontWeight: 600, px: 4 }}
                >
                  Open in Wizard
                </Button>
                {missingFields.length > 0 && (
                  <Button
                    variant="outlined"
                    size="large"
                    color="success"
                    startIcon={<PhoneIcon />}
                    onClick={() => setStage('client_call')}
                    sx={{ fontWeight: 600, px: 4 }}
                  >
                    Call Client Again
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<ReplayIcon />}
                  onClick={handleReset}
                  sx={{ fontWeight: 600, px: 4 }}
                >
                  Run Again
                </Button>
              </Stack>
            </Box>
          )}

        </Container>
      </Box>
    </Box>
  );
}
