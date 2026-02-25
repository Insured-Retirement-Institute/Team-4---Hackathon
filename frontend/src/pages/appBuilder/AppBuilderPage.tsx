import { useState } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import AppBuilderTabs from './AppBuilder/AppBuilderTabs';

function AppBuilderPage() {
  const [progress, setProgress] = useState(33);

  return (
    <Stack spacing={0}>
      <Box
        sx={{
          position: 'sticky',
          top: 48,
          zIndex: 10,
          p: 0,
          m: 0,
          px: 0,
          bgcolor: '#ffffff',
        }}
      >
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            bgcolor: '#e5e7eb',
            '& .MuiLinearProgress-bar': { bgcolor: '#3a9df7', borderRadius: 0 },
          }}
        />
      </Box>

      <Box sx={{ px: { xs: 2, md: 4 }, pt: 2, pb: { xs: 2, md: 4 } }}>
        <AppBuilderTabs onProgressChange={setProgress} />
      </Box>
    </Stack>
  );
}

export default AppBuilderPage;
