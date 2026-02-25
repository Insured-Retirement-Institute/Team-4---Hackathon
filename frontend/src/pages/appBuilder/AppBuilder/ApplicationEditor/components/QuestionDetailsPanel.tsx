import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  QUESTION_TYPES,
  VALIDATION_RULE_TYPES,
  type BuilderPage,
  type BuilderQuestion,
  type BuilderSection,
  type BuilderPalette,
  type BuilderValidationRule,
  type BuilderValidationType,
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
  onUpdateQuestionId: (value: string) => void;
  onUpdateQuestionLabel: (value: string) => void;
  onUpdateQuestionType: (value: QuestionType) => void;
  onUpdateQuestionHint: (value: string) => void;
  onUpdateQuestionPlaceholder: (value: string) => void;
  onUpdateQuestionOptions: (value: string) => void;
  onUpdateQuestionRequired: (value: boolean) => void;
  onAddValidationRule: () => void;
  onRemoveValidationRule: (validationUid: string) => void;
  onUpdateValidationRule: (validationUid: string, field: keyof Omit<BuilderValidationRule, 'uid'>, value: string) => void;
};

function QuestionDetailsPanel({
  activePage,
  activeSection,
  activeQuestion,
  palette,
  detailFieldSx,
  previewQuestion,
  onUpdatePageTitle,
  onUpdateQuestionId,
  onUpdateQuestionLabel,
  onUpdateQuestionType,
  onUpdateQuestionHint,
  onUpdateQuestionPlaceholder,
  onUpdateQuestionOptions,
  onUpdateQuestionRequired,
  onAddValidationRule,
  onRemoveValidationRule,
  onUpdateValidationRule,
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
              control={
                <Switch
                  checked={activeQuestion.required}
                  onChange={(_, checked) => onUpdateQuestionRequired(checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: palette.accent,
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: palette.accent,
                    },
                  }}
                />
              }
              label="Required"
            />
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Validation Rules
                </Typography>
                <Button size="small" variant="outlined" onClick={onAddValidationRule}>
                  Add Rule
                </Button>
              </Stack>
              {activeQuestion.validations.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No additional validation rules.
                </Typography>
              ) : (
                activeQuestion.validations.map((rule) => {
                  const ruleTypeMeta = VALIDATION_RULE_TYPES.find((item) => item.value === rule.type);
                  return (
                    <Box key={rule.uid} sx={{ border: '1px solid', borderColor: palette.border, p: 1 }}>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1}>
                          <TextField
                            size="small"
                            select
                            label="Type"
                            value={rule.type}
                            sx={{ ...detailFieldSx, flex: 1 }}
                            onChange={(event) =>
                              onUpdateValidationRule(rule.uid, 'type', event.target.value as BuilderValidationType)
                            }
                          >
                            {VALIDATION_RULE_TYPES.map((typeOption) => (
                              <MenuItem key={typeOption.value} value={typeOption.value}>
                                {typeOption.label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <Button color="inherit" onClick={() => onRemoveValidationRule(rule.uid)}>
                            Remove
                          </Button>
                        </Stack>
                        {ruleTypeMeta?.needsValue ? (
                          <TextField
                            size="small"
                            label="Value"
                            value={rule.value}
                            sx={detailFieldSx}
                            onChange={(event) => onUpdateValidationRule(rule.uid, 'value', event.target.value)}
                          />
                        ) : null}
                        {ruleTypeMeta?.needsServiceKey ? (
                          <TextField
                            size="small"
                            label="Service Key"
                            value={rule.serviceKey}
                            sx={detailFieldSx}
                            onChange={(event) => onUpdateValidationRule(rule.uid, 'serviceKey', event.target.value)}
                          />
                        ) : null}
                        <TextField
                          size="small"
                          label="Error Message"
                          value={rule.description}
                          sx={detailFieldSx}
                          onChange={(event) => onUpdateValidationRule(rule.uid, 'description', event.target.value)}
                        />
                      </Stack>
                    </Box>
                  );
                })
              )}
            </Stack>
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
