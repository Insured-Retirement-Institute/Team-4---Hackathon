import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HistoryIcon from '@mui/icons-material/History';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  deleteApplication,
  listSaves,
  type SavedApplicationEntry,
} from '../services/applicationStorageService';

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ApplicationHistoryPage() {
  const navigate = useNavigate();
  const [saves, setSaves] = useState<SavedApplicationEntry[]>(() => listSaves());

  const handleContinue = (save: SavedApplicationEntry) => {
    navigate(`/wizard-v2/${encodeURIComponent(save.productId)}?resume=${save.id}`);
  };

  const handleDelete = (id: string) => {
    deleteApplication(id);
    setSaves(listSaves());
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <LinearProgress variant="determinate" value={100} color="primary" sx={{ height: 4 }} />

      <Box sx={{ p: { xs: 2, md: 6 }, maxWidth: 860, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <HistoryIcon color="primary" />
          <Typography variant="h4" fontWeight={800} letterSpacing="-0.5px">
            Application History
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary" mb={5}>
          Pick up where you left off or review submitted applications.
        </Typography>

        {saves.length === 0 ? (
          <Card
            elevation={0}
            sx={{ border: '1px dashed', borderColor: 'divider', textAlign: 'center', p: { xs: 4, md: 8 } }}
          >
            <DescriptionOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No saved applications yet
            </Typography>
            <Typography variant="body2" color="text.disabled" mb={3}>
              Applications you start will appear here so you can pick up where you left off.
            </Typography>
            <Button variant="contained" color="primary" onClick={() => navigate('/wizard-v2')}>
              Start an Application
            </Button>
          </Card>
        ) : (
          <Stack spacing={2}>
            {saves.map((save) => (
              <Card
                key={save.id}
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: save.status === 'submitted' ? 'success.light' : 'divider',
                  bgcolor: 'background.paper',
                  transition: 'box-shadow 0.15s',
                  '&:hover': { boxShadow: 2 },
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ sm: 'center' }}
                    justifyContent="space-between"
                  >
                    {/* Left: icon + details */}
                    <Stack direction="row" spacing={2} alignItems="center" flex={1} minWidth={0}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2,
                          bgcolor: save.status === 'submitted' ? 'success.50' : 'grey.100',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: save.status === 'submitted' ? 'success.main' : 'text.secondary',
                          flexShrink: 0,
                        }}
                      >
                        <DescriptionOutlinedIcon fontSize="small" />
                      </Box>

                      <Box minWidth={0}>
                        <Typography
                          variant="overline"
                          color="text.secondary"
                          sx={{ fontSize: 10, letterSpacing: 1, lineHeight: 1.2, display: 'block' }}
                        >
                          {save.carrier}
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          fontWeight={700}
                          lineHeight={1.2}
                          noWrap
                        >
                          {save.productName}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap">
                          <Chip
                            label={save.status === 'submitted' ? 'Submitted' : 'In Progress'}
                            size="small"
                            color={save.status === 'submitted' ? 'success' : 'warning'}
                            sx={{ height: 20, fontSize: 10 }}
                          />
                          <Typography variant="caption" color="text.disabled">
                            Saved {relativeTime(save.lastSavedAt)}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            · v{save.version}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>

                    {/* Right: actions */}
                    <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                      {save.status === 'in_progress' && (
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          endIcon={<ArrowForwardIcon />}
                          onClick={() => handleContinue(save)}
                        >
                          Continue
                        </Button>
                      )}
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(save.id)}
                          aria-label="Delete application"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
