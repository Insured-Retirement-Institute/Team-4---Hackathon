import { useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function SettingsPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Stack spacing={2} sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, nextTab: number) => setActiveTab(nextTab)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Carriers & Vendors" />
          <Tab label="App Builder" />
          <Tab label="AI Agent Guidelilnes" />
        </Tabs>
      </Box>

      <Box sx={{ pt: 2 }}>
        {activeTab === 0 && (
          <Typography variant="body1" color="text.secondary">
            Manage carrier and vendor configuration settings.
          </Typography>
        )}
        {activeTab === 1 && (
          <Typography variant="body1" color="text.secondary">
            Configure product and application-level settings.
          </Typography>
        )}
        {activeTab === 2 && (
          <Typography variant="body1" color="text.secondary">
            Define AI agent behavior, guardrails, and prompt guidelines.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

export default SettingsPage;
