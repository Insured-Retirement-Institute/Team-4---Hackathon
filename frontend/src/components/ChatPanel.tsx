import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import { sendMessage, type MessageResponse } from '../services/aiService';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface ChatPanelProps {
  sessionId: string | null;
  /** Called when the AI response includes updated fields */
  onFieldUpdate?: (fields: Array<{ field_id: string; value: string | boolean; status: string }>) => void;
  /** Optional greeting to show at the start */
  greeting?: string;
}

export default function ChatPanel({ sessionId, onFieldUpdate, greeting }: ChatPanelProps) {
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
      setMessages((prev) => [...prev, { role: 'assistant', text: response.reply }]);

      if (response.updated_fields?.length && onFieldUpdate) {
        onFieldUpdate(response.updated_fields);
      }
    } catch (err) {
      console.error('Chat send error:', err);
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setSending(false);
    }
  }, [sessionId, input, sending, onFieldUpdate]);

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
          {messages.map((msg, i) => (
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
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {msg.text}
                </Typography>
              </Box>
            </Box>
          ))}
          {sending && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: 'grey.100' }}>
                <CircularProgress size={16} />
              </Box>
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
