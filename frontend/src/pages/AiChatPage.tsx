import Box from '@mui/material/Box';
import AiChat from '../features/ai-chat/AiChat';

export default function AiChatPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <AiChat />
    </Box>
  );
}
