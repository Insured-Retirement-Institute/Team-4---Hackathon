import type { DragEvent } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { BuilderPage, BuilderSection, BuilderPalette, DragState } from '../types';

type QuestionsColumnProps = {
  activePage: BuilderPage | null;
  activeSection: BuilderSection | null;
  activeQuestionUid: string | null;
  palette: BuilderPalette;
  dropTargetUid: string;
  dragState: DragState | null;
  canRemoveQuestion: boolean;
  onSelectQuestion: (questionUid: string) => void;
  onQuestionDragOver: (event: DragEvent, questionUid: string) => void;
  onQuestionDrop: (event: DragEvent, questionUid: string) => void;
  onDragEnd: () => void;
  onDragStart: (dragState: DragState) => void;
  onAddQuestion: () => void;
  onRemoveQuestion: () => void;
};

function QuestionsColumn({
  activePage,
  activeSection,
  activeQuestionUid,
  palette,
  dropTargetUid,
  dragState,
  canRemoveQuestion,
  onSelectQuestion,
  onQuestionDragOver,
  onQuestionDrop,
  onDragEnd,
  onDragStart,
  onAddQuestion,
  onRemoveQuestion,
}: QuestionsColumnProps) {
  return (
    <Box sx={{ width: { xs: '100%', lg: '33%' } }}>
      <Stack spacing={1.25}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Questions
        </Typography>
        {activeSection?.questions.map((question, questionIndex) => {
          const active = question.uid === activeQuestionUid;
          return (
            <Box
              key={question.uid}
              onClick={() => onSelectQuestion(question.uid)}
              onDragOver={(event) => onQuestionDragOver(event, question.uid)}
              onDrop={(event) => onQuestionDrop(event, question.uid)}
              onDragEnd={onDragEnd}
              sx={{
                cursor: 'pointer',
                border: '1px solid',
                borderColor: active ? palette.accent : palette.border,
                outline:
                  dragState?.kind === 'question' && dropTargetUid === question.uid
                    ? `2px dashed ${palette.accent}`
                    : 'none',
                bgcolor: '#ffffff',
                color: palette.text,
                px: 1.25,
                py: 1,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    draggable
                    onDragStart={() =>
                      activePage &&
                      activeSection &&
                      onDragStart({
                        kind: 'question',
                        pageUid: activePage.uid,
                        sectionUid: activeSection.uid,
                        uid: question.uid,
                      })
                    }
                    sx={{ display: 'inline-flex', cursor: 'grab', color: palette.mutedText }}
                    aria-label="Drag to reorder question"
                  >
                    <DragIndicatorIcon fontSize="small" sx={{ color: 'inherit' }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: active ? 700 : 600 }}>
                    {question.label.trim() || `Question ${questionIndex + 1}`}
                  </Typography>
                </Stack>
                <VisibilityOutlinedIcon fontSize="small" sx={{ color: active ? palette.accent : palette.mutedText }} />
              </Stack>
            </Box>
          );
        })}
        <Stack direction="row" spacing={1}>
          <Button variant="text" startIcon={<AddIcon />} onClick={onAddQuestion} sx={{ color: palette.text }}>
            New Question
          </Button>
          <Button
            variant="text"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={onRemoveQuestion}
            disabled={!canRemoveQuestion}
          >
            Remove
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default QuestionsColumn;
