import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import SendIcon from '@mui/icons-material/Send';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AiChatProps {
  /** Initial messages to pre-populate (e.g. a system greeting) */
  initialMessages?: ChatMessage[];
  /** Called whenever the user sends a message. Return the assistant reply. */
  onSendMessage?: (message: string, history: ChatMessage[]) => Promise<string>;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Height of the message scroll area. Defaults to '100%' (fills container). */
  height?: string | number;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={{ flexDirection: isUser ? 'row-reverse' : 'row' }}
    >
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: isUser ? 'primary.main' : 'primary.dark',
          flexShrink: 0,
        }}
      >
        {isUser ? (
          <PersonOutlineIcon sx={{ fontSize: 18 }} />
        ) : (
          <SmartToyOutlinedIcon sx={{ fontSize: 18 }} />
        )}
      </Avatar>

      <Box sx={{ maxWidth: '75%' }}>
        <Paper
          elevation={0}
          sx={{
            px: 2,
            py: 1.25,
            bgcolor: isUser ? 'primary.main' : 'background.paper',
            color: isUser ? 'primary.contrastText' : 'text.primary',
            border: isUser ? 'none' : '1px solid',
            borderColor: 'divider',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          }}
        >
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {message.content}
          </Typography>
        </Paper>
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            mt: 0.5,
            display: 'block',
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </Box>
    </Stack>
  );
}

function TypingIndicator() {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.dark', flexShrink: 0 }}>
        <SmartToyOutlinedIcon sx={{ fontSize: 18 }} />
      </Avatar>
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '18px 18px 18px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: 'text.disabled',
              animation: 'bounce 1.2s infinite',
              animationDelay: `${i * 0.2}s`,
              '@keyframes bounce': {
                '0%, 80%, 100%': { transform: 'translateY(0)' },
                '40%': { transform: 'translateY(-6px)' },
              },
            }}
          />
        ))}
      </Paper>
    </Stack>
  );
}

const DEFAULT_GREETING: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  content: "Hi! I'm your annuity application assistant. I can help you fill out your application, explain any terms, or answer questions about the process. How can I help you today?",
  timestamp: new Date(),
};

export default function AiChat({
  initialMessages,
  onSendMessage,
  placeholder = 'Ask me anything about your application…',
  height = '100%',
}: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages ?? [DEFAULT_GREETING]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let reply = "I'm not connected to a backend yet — but I'm ready when you are!";
      if (onSendMessage) {
        reply = await onSendMessage(text, [...messages, userMessage]);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height,
        bgcolor: 'background.default',
      }}
    >
      {/* Message list */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 3,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {loading && <TypingIndicator />}
      </Box>

      <Divider />

      {/* Input bar */}
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'background.paper' }}>
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
              },
            }}
          />
          <IconButton
            onClick={handleSend}
            disabled={!input.trim() || loading}
            color="primary"
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
              mb: 0.25,
            }}
          >
            {loading ? (
              <CircularProgress size={20} sx={{ color: 'inherit' }} />
            ) : (
              <SendIcon fontSize="small" />
            )}
          </IconButton>
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.75, display: 'block' }}>
          Press Enter to send · Shift+Enter for a new line
        </Typography>
      </Box>
    </Box>
  );
}
