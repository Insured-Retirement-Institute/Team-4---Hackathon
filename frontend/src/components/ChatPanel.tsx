import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendIcon from '@mui/icons-material/Send';
import { sendMessage, type MessageResponse, type ToolCallInfo } from '../services/aiService';

/** Lightweight markdown → HTML for chat bubbles */
function mdToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#e0e0e0;padding:0 4px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/\n/g, '<br/>');
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  text: string;
  toolNames?: string[];
  toolDetails?: ToolCallInfo[];
}

interface ChatPanelProps {
  sessionId: string | null;
  /** Called when the AI response includes updated fields */
  onFieldUpdate?: (fields: Array<{ field_id: string; value: string | boolean; status: string }>) => void;
  /** Called when tool calls are made (for agent log integration) */
  onToolCalls?: (tools: ToolCallInfo[]) => void;
  /** Optional greeting to show at the start */
  greeting?: string;
}

const TOOL_LABELS: Record<string, string> = {
  lookup_crm_client: 'CRM Client Lookup',
  lookup_family_members: 'Family & Spouse Lookup',
  lookup_crm_notes: 'CRM Notes Analysis',
  lookup_prior_policies: 'Prior Policy Lookup',
  lookup_annual_statements: 'Annual Statement Retrieval',
  extract_document_fields: 'Document Field Extraction',
  get_advisor_preferences: 'Advisor Preferences',
  get_carrier_suitability: 'Carrier Suitability Check',
  call_client: 'Client Phone Call',
  select_product: 'Product Selected',
  extract_application_fields: 'Field Extraction',
  confirm_known_fields: 'Field Confirmation',
};

const TOOL_DESCRIPTIONS: Record<string, string> = {
  lookup_crm_client: 'Redtail CRM API  /contacts/{id}',
  lookup_family_members: 'Redtail CRM API  /contacts/{id}/family',
  lookup_crm_notes: 'Redtail CRM API  /contacts/{id}/notes',
  lookup_prior_policies: 'Policy System  /suitability/{id}',
  lookup_annual_statements: 'S3  iri-hackathon-statements/statements/{id}/',
  extract_document_fields: 'Claude Vision  document analysis',
  get_advisor_preferences: 'S3  iri-hackathon-statements/advisors/{id}/',
  get_carrier_suitability: 'Suitability Engine  weighted scoring',
  call_client: 'Retell AI  outbound call',
  select_product: 'Internal  product selection',
};

function ToolCallRow({ tool }: { tool: ToolCallInfo }) {
  const [open, setOpen] = useState(false);
  const data = tool.result_data;
  const fieldCount = data ? Object.keys(data).length : 0;

  return (
    <Box sx={{ width: '100%' }}>
      <Chip
        label={
          <Stack direction="row" spacing={0.5} alignItems="center">
            <span>{TOOL_LABELS[tool.name] || tool.name}</span>
            {fieldCount > 0 && (
              <Box component="span" sx={{ opacity: 0.7, fontSize: 10 }}>
                ({fieldCount} fields)
              </Box>
            )}
            <ExpandMoreIcon sx={{
              fontSize: 14,
              transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }} />
          </Stack>
        }
        size="small"
        color="secondary"
        variant={open ? 'filled' : 'outlined'}
        onClick={() => setOpen((v) => !v)}
        sx={{ fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
      />
      <Collapse in={open}>
        <Box sx={{
          mt: 0.5,
          p: 1.5,
          bgcolor: 'grey.900',
          color: 'grey.100',
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: 11,
          lineHeight: 1.6,
          maxHeight: 200,
          overflowY: 'auto',
        }}>
          <Typography sx={{ color: 'grey.500', fontSize: 10, mb: 0.5, fontFamily: 'monospace' }}>
            {TOOL_DESCRIPTIONS[tool.name] || tool.name}
          </Typography>
          {tool.source_label && (
            <Typography sx={{ color: 'info.light', fontSize: 10, mb: 0.5, fontFamily: 'monospace' }}>
              Source: {tool.source_label}
            </Typography>
          )}
          {data ? (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <Typography sx={{ color: 'grey.500', fontSize: 11, fontStyle: 'italic', fontFamily: 'monospace' }}>
              No response data
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function ChatPanel({ sessionId, onFieldUpdate, onToolCalls, greeting }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add greeting as first assistant message
  useEffect(() => {
    if (greeting) {
      setMessages([{ role: 'assistant', text: greeting }]);
    }
  }, [greeting]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!sessionId || !input.trim() || sending) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setSending(true);

    try {
      const response: MessageResponse = await sendMessage(sessionId, userMsg);

      // Show tool call chips before the response if any tools were used
      if (response.tool_calls?.length) {
        const toolNames = response.tool_calls.map((tc) => tc.name);
        setMessages((prev) => [
          ...prev,
          { role: 'tool', text: '', toolNames, toolDetails: response.tool_calls },
          { role: 'assistant', text: response.reply },
        ]);
        onToolCalls?.(response.tool_calls);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', text: response.reply }]);
      }

      if (response.updated_fields?.length && onFieldUpdate) {
        onFieldUpdate(response.updated_fields);
      }
    } catch (err) {
      console.error('Chat send error:', err);
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setSending(false);
    }
  }, [sessionId, input, sending, onFieldUpdate, onToolCalls]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages area */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {messages.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            {sessionId ? 'Type a message to start chatting with the AI assistant.' : 'Start a session first to begin chatting.'}
          </Typography>
        )}
        <Stack spacing={1.5}>
          {messages.map((msg, i) => {
            if (msg.role === 'tool' && msg.toolDetails) {
              return (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  {msg.toolDetails.map((tool) => (
                    <ToolCallRow key={tool.name} tool={tool} />
                  ))}
                </Box>
              );
            }
            if (msg.role === 'tool' && msg.toolNames) {
              return (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  {msg.toolNames.map((name) => (
                    <Chip
                      key={name}
                      label={TOOL_LABELS[name] || name}
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ fontSize: 11, fontWeight: 600 }}
                    />
                  ))}
                </Box>
              );
            }
            return (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <Box
                  sx={{
                    maxWidth: '80%',
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: msg.role === 'user' ? 'primary.main' : 'grey.100',
                    color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ '& strong': { fontWeight: 700 }, '& code': { fontSize: 12 } }}
                    dangerouslySetInnerHTML={{ __html: mdToHtml(msg.text) }}
                  />
                </Box>
              </Box>
            );
          })}
          {sending && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1 }}>
              <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: 'grey.100' }}>
                <CircularProgress size={16} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Processing...
              </Typography>
            </Box>
          )}
        </Stack>
        <div ref={scrollRef} />
      </Box>

      {/* Input area */}
      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth
            size="small"
            placeholder={sessionId ? 'Type a message...' : 'Session not started'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!sessionId || sending}
            multiline
            maxRows={3}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!sessionId || !input.trim() || sending}
          >
            <SendIcon />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}
