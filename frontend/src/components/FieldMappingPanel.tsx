import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LaunchIcon from '@mui/icons-material/Launch';
import PhoneIcon from '@mui/icons-material/Phone';
import type { Product } from '../services/apiService';
import type { ApplicationDefinition } from '../types/application';

export interface MatchedField {
  id: string;
  label: string;
  pageTitle: string;
  value: string | null;
  filled: boolean;
  source?: string;
}

interface FieldMappingPanelProps {
  gatheredFields: Map<string, { value: string; source: string }>;
  products: Product[];
  selectedProductId: string | null;
  onProductSelect: (productId: string) => void;
  definition: ApplicationDefinition | null;
  matchedFields: MatchedField[];
  onCallClient: () => void;
  onLaunchWizard: () => void;
  callInProgress: boolean;
}

const SOURCE_COLORS: Record<string, string> = {
  'Redtail CRM': '#1976d2',
  'CRM Notes': '#7b1fa2',
  'Prior Policies': '#e65100',
  'Document Store': '#2e7d32',
  'Advisor Preferences': '#00838f',
  'Suitability Check': '#4527a0',
  'Client Call': '#c62828',
};

export default function FieldMappingPanel({
  gatheredFields,
  products,
  selectedProductId,
  onProductSelect,
  definition,
  matchedFields,
  onCallClient,
  onLaunchWizard,
  callInProgress,
}: FieldMappingPanelProps) {
  // Source summary
  const sourceCounts: Record<string, number> = {};
  for (const [, entry] of gatheredFields) {
    sourceCounts[entry.source] = (sourceCounts[entry.source] ?? 0) + 1;
  }

  const filledCount = matchedFields.filter((f) => f.filled).length;
  const totalCount = matchedFields.length;
  const filledPct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  // Group by page
  const fieldsByPage: Record<string, MatchedField[]> = {};
  for (const f of matchedFields) {
    (fieldsByPage[f.pageTitle] ??= []).push(f);
  }

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Field Mapping
        </Typography>

        {/* Product dropdown */}
        <FormControl fullWidth size="small">
          <InputLabel>Product</InputLabel>
          <Select
            value={selectedProductId ?? ''}
            label="Product"
            onChange={(e) => onProductSelect(e.target.value)}
          >
            {products.map((p) => (
              <MenuItem key={p.productId} value={p.productId}>{p.productName}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Source summary chips */}
      {Object.keys(sourceCounts).length > 0 && (
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {Object.entries(sourceCounts).map(([source, count]) => (
              <Chip
                key={source}
                label={`${source}: ${count}`}
                size="small"
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  bgcolor: `${SOURCE_COLORS[source] ?? '#616161'}18`,
                  color: SOURCE_COLORS[source] ?? '#616161',
                  border: `1px solid ${SOURCE_COLORS[source] ?? '#616161'}40`,
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {/* Field matching table (when product selected + definition loaded) */}
        {selectedProductId && definition && matchedFields.length > 0 ? (
          <>
            {/* Progress bar */}
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="caption" fontWeight={600}>
                  {filledCount} of {totalCount} fields mapped
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {filledPct}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={filledPct}
                color="secondary"
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>

            {/* Grouped field list */}
            {Object.entries(fieldsByPage).map(([pageTitle, fields]) => {
              const pageFilled = fields.filter((f) => f.filled).length;
              return (
                <Box key={pageTitle} sx={{ mb: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {pageTitle}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pageFilled}/{fields.length}
                    </Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    {fields.map((f) => (
                      <Box
                        key={f.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                          bgcolor: f.filled ? 'rgba(102,187,106,0.06)' : 'rgba(255,152,0,0.04)',
                          border: '1px solid',
                          borderColor: f.filled ? 'rgba(102,187,106,0.2)' : 'rgba(255,152,0,0.15)',
                        }}
                      >
                        {f.filled ? (
                          <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
                        ) : (
                          <ErrorOutlineIcon sx={{ fontSize: 14, color: 'warning.main', flexShrink: 0 }} />
                        )}
                        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary', fontSize: 11 }}>
                          {f.label}
                        </Typography>
                        {f.filled ? (
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                            <Typography variant="caption" fontWeight={600} sx={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                              {f.value}
                            </Typography>
                            {f.source && (
                              <Chip
                                label={f.source}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: 9,
                                  fontWeight: 600,
                                  bgcolor: `${SOURCE_COLORS[f.source] ?? '#616161'}18`,
                                  color: SOURCE_COLORS[f.source] ?? '#616161',
                                }}
                              />
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="caption" sx={{ color: 'warning.main', fontStyle: 'italic', fontSize: 11 }}>
                            Missing
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </>
        ) : (
          /* Raw fields list (before product selected) */
          gatheredFields.size > 0 ? (
            <Stack spacing={0.5}>
              {Array.from(gatheredFields.entries()).map(([key, entry]) => (
                <Box key={key} sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline' }}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 140, flexShrink: 0, fontSize: 11 }}>
                    {key}
                  </Typography>
                  <Typography variant="caption" fontWeight={600} sx={{ flex: 1, wordBreak: 'break-word', fontSize: 11 }}>
                    {String(entry.value).slice(0, 50)}
                  </Typography>
                  <Chip
                    label={entry.source}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: 9,
                      fontWeight: 600,
                      flexShrink: 0,
                      bgcolor: `${SOURCE_COLORS[entry.source] ?? '#616161'}18`,
                      color: SOURCE_COLORS[entry.source] ?? '#616161',
                    }}
                  />
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 6 }}>
              Chat with the AI to start gathering client data. Fields will appear here as they are collected from different sources.
            </Typography>
          )
        )}
      </Box>

      {/* Action buttons */}
      <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={1.5}>
          <Button
            variant="contained"
            color="success"
            fullWidth
            startIcon={<PhoneIcon />}
            onClick={onCallClient}
            disabled={!selectedProductId || callInProgress || gatheredFields.size === 0}
            sx={{ fontWeight: 700 }}
          >
            {callInProgress ? 'Call in Progress...' : 'Call Client'}
          </Button>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<LaunchIcon />}
            onClick={onLaunchWizard}
            disabled={!selectedProductId || gatheredFields.size === 0}
            sx={{ fontWeight: 600 }}
          >
            Open in Wizard
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
