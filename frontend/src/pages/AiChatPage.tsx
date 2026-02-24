import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AiChat, { type ChatMessage } from '../features/ai-chat/AiChat';
import { useApplication } from '../context/ApplicationContext';
import { createSession, sendMessage } from '../services/aiService';

export default function AiChatPage() {
  const { mergeFields, sessionId, setSessionId, setPhase, setStepProgress, currentStepIndex, totalSteps, collectedFields } =
    useApplication();
  const [initialMessages, setInitialMessages] = useState<ChatMessage[] | undefined>();
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // If we already have a session (user navigated away and back), keep it
    if (sessionId) return;

    // Build known_data from any fields already collected (e.g. from the wizard)
    const knownData: Record<string, string> = {};
    for (const [key, val] of Object.entries(collectedFields)) {
      if (typeof val === 'string' && val.trim()) {
        knownData[key] = val;
      } else if (typeof val === 'boolean') {
        knownData[key] = val ? 'true' : 'false';
      }
    }

    createSession('midland-fixed-annuity-001', Object.keys(knownData).length > 0 ? knownData : undefined)
      .then((session) => {
        setSessionId(session.session_id);
        setPhase(session.phase);
        setStepProgress(session.current_step_index, session.total_steps);
        setInitialMessages([
          {
            id: 'greeting',
            role: 'assistant',
            content: session.greeting,
            timestamp: new Date(),
          },
        ]);
      })
      .catch((err) => {
        setError(err.message);
        setInitialMessages([
          {
            id: 'error',
            role: 'assistant',
            content: 'Sorry, I could not connect to the AI service. Please try refreshing the page.',
            timestamp: new Date(),
          },
        ]);
      });
  }, [setSessionId, setPhase, setStepProgress, sessionId, collectedFields]);

  const handleSendMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!sessionId) return 'Session not initialized yet. Please wait a moment.';

      try {
        const response = await sendMessage(sessionId, message);

        setPhase(response.phase);
        setStepProgress(response.current_step_index, response.total_steps);

        if (response.updated_fields?.length) {
          const fieldMap: Record<string, string | boolean> = {};
          for (const field of response.updated_fields) {
            fieldMap[field.field_id] = field.value;
          }
          mergeFields(fieldMap);
        }

        return response.reply;
      } catch (err) {
        return `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    },
    [sessionId, mergeFields, setPhase, setStepProgress],
  );

  const fieldCount = Object.keys(collectedFields).length;
  const stepProgress = totalSteps && currentStepIndex !== null ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Progress header */}
      {totalSteps !== null && currentStepIndex !== null && (
        <Box sx={{ px: 3, pt: 1.5, pb: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
              Step {currentStepIndex + 1} of {totalSteps}
            </Typography>
            <LinearProgress variant="determinate" value={stepProgress} sx={{ flex: 1, borderRadius: 1, height: 6 }} />
            {fieldCount > 0 && (
              <Chip label={`${fieldCount} fields collected`} size="small" color="success" variant="outlined" />
            )}
          </Stack>
        </Box>
      )}

      {error && (
        <Typography variant="body2" sx={{ color: 'error.main', px: 3, py: 1 }}>
          {error}
        </Typography>
      )}

      {initialMessages ? (
        <AiChat initialMessages={initialMessages} onSendMessage={handleSendMessage} height="100%" />
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Connecting to AI assistant...
          </Typography>
        </Box>
      )}
    </Box>
  );
}
