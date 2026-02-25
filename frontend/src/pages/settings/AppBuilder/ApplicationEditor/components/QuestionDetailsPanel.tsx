import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  QUESTION_TYPES,
  type BuilderPage,
  type BuilderQuestion,
  type BuilderSection,
  type BuilderPalette,
  type QuestionType,
} from '../types';

type QuestionDetailsPanelProps = {
  activePage: BuilderPage | null;
  activeSection: BuilderSection | null;
  activeQuestion: BuilderQuestion | null;
  palette: BuilderPalette;
  detailFieldSx: object;
  previewQuestion: (question: BuilderQuestion) => ReactNode;
  onUpdatePageTitle: (value: string) => void;
  onUpdateSectionTitle: (value: string) => void;
  onUpdateQuestionId: (value: string) => void;
  onUpdateQuestionLabel: (value: string) => void;
  onUpdateQuestionType: (value: QuestionType) => void;
  onUpdateQuestionHint: (value: string) => void;
  onUpdateQuestionPlaceholder: (value: string) => void;
  onUpdateQuestionOptions: (value: string) => void;
  onUpdateQuestionRequired: (value: boolean) => void;
};

function QuestionDetailsPanel({
  activePage,
  activeSection,
  activeQuestion,
  palette,
  detailFieldSx,
  previewQuestion,
  onUpdatePageTitle,
  onUpdateSectionTitle,
  onUpdateQuestionId,
  onUpdateQuestionLabel,
  onUpdateQuestionType,
  onUpdateQuestionHint,
  onUpdateQuestionPlaceholder,
  onUpdateQuestionOptions,
  onUpdateQuestionRequired,
}: QuestionDetailsPanelProps) {
  return (
    <Box sx={{ flex: 1 }}>
      <Stack spacing={1.25}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Question Details
        </Typography>
        {activePage && activeSection && activeQuestion ? (
          <Stack spacing={1.25}>
            <TextField size="small" label="Page Title" value={activePage.title} sx={detailFieldSx} onChange={(event) => onUpdatePageTitle(event.target.value)} />
            <TextField size="small" label="Section Title" value={activeSection.title} sx={detailFieldSx} onChange={(event) => onUpdateSectionTitle(event.target.value)} />
            <TextField size="small" label="Question ID" value={activeQuestion.id} sx={detailFieldSx} onChange={(event) => onUpdateQuestionId(event.target.value)} />
            <TextField size="small" label="Label" value={activeQuestion.label} sx={detailFieldSx} onChange={(event) => onUpdateQuestionLabel(event.target.value)} />
            <TextField
              size="small"
              select
              label="Type"
              value={activeQuestion.type}
              sx={detailFieldSx}
              onChange={(event) => onUpdateQuestionType(event.target.value as QuestionType)}
            >
              {QUESTION_TYPES.map((typeOption) => (
                <MenuItem key={typeOption.value} value={typeOption.value}>
                  {typeOption.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField size="small" label="Hint" value={activeQuestion.hint} sx={detailFieldSx} onChange={(event) => onUpdateQuestionHint(event.target.value)} />
            <TextField
              size="small"
              label="Placeholder"
              value={activeQuestion.placeholder}
              sx={detailFieldSx}
              onChange={(event) => onUpdateQuestionPlaceholder(event.target.value)}
            />
            {(activeQuestion.type === 'radio' || activeQuestion.type === 'select') && (
              <TextField
                size="small"
                multiline
                minRows={3}
                label="Options (value|label)"
                placeholder={`yes|Yes\nno|No`}
                value={activeQuestion.optionsInput}
                sx={detailFieldSx}
                onChange={(event) => onUpdateQuestionOptions(event.target.value)}
              />
            )}
            <FormControlLabel
              control={<Switch checked={activeQuestion.required} onChange={(_, checked) => onUpdateQuestionRequired(checked)} />}
              label="Required"
            />
            <Divider />
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Preview
              </Typography>
              <Box sx={{ border: '1px solid', borderColor: palette.border, bgcolor: '#ffffff', p: 1.5 }}>
                {previewQuestion(activeQuestion)}
              </Box>
            </Stack>
          </Stack>
        ) : (
          <Alert severity="info">Select a question to edit details.</Alert>
        )}
      </Stack>
    </Box>
  );
}

export default QuestionDetailsPanel;
