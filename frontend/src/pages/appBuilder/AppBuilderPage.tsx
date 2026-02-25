import { useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import AppBuilderTabs from './AppBuilder/AppBuilderTabs';

function AppBuilderPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Stack spacing={2} sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, nextTab: number) => setActiveTab(nextTab)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTabs-indicator': {
              backgroundColor: '#3a9df7',
            },
          }}
        >
          <Tab
            label="App Builder"
            sx={{
              '&.Mui-selected': {
                color: '#3a9df7',
                fontWeight: 700,
              },
            }}
          />
        </Tabs>
      </Box>

      <Box sx={{ pt: 2 }}>
        {activeTab === 0 && (
          <AppBuilderTabs />
        )}
      </Box>
    </Stack>
  );
}

export default AppBuilderPage;
