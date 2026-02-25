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

type SectionsColumnProps = {
  activePage: BuilderPage | null;
  activeSectionUid: string | null;
  palette: BuilderPalette;
  dropTargetUid: string;
  dragState: DragState | null;
  canRemoveSection: boolean;
  onSelectSection: (sectionUid: string) => void;
  onSectionDragOver: (event: DragEvent, sectionUid: string) => void;
  onSectionDrop: (event: DragEvent, sectionUid: string) => void;
  onDragEnd: () => void;
  onDragStart: (dragState: DragState) => void;
  onAddSection: () => void;
  onRemoveSection: () => void;
};

function SectionsColumn({
  activePage,
  activeSectionUid,
  palette,
  dropTargetUid,
  dragState,
  canRemoveSection,
  onSelectSection,
  onSectionDragOver,
  onSectionDrop,
  onDragEnd,
  onDragStart,
  onAddSection,
  onRemoveSection,
}: SectionsColumnProps) {
  return (
    <Box sx={{ width: { xs: '100%', lg: '34%' } }}>
      <Stack spacing={1.25}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Sections
        </Typography>
        {activePage?.sections.map((section: BuilderSection, sectionIndex) => {
          const active = section.uid === activeSectionUid;
          return (
            <Box
              key={section.uid}
              onClick={() => onSelectSection(section.uid)}
              onDragOver={(event) => onSectionDragOver(event, section.uid)}
              onDrop={(event) => onSectionDrop(event, section.uid)}
              onDragEnd={onDragEnd}
              sx={{
                cursor: 'pointer',
                border: '1px solid',
                borderColor: active ? palette.accent : palette.border,
                outline:
                  dragState?.kind === 'section' && dropTargetUid === section.uid
                    ? `2px dashed ${palette.accent}`
                    : 'none',
                bgcolor: active ? palette.accentSoft : palette.card,
                color: active ? palette.accent : palette.text,
                px: 1.25,
                py: 1,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    draggable
                    onDragStart={() =>
                      activePage && onDragStart({ kind: 'section', pageUid: activePage.uid, uid: section.uid })
                    }
                    sx={{ display: 'inline-flex', cursor: 'grab', color: active ? palette.accent : palette.mutedText }}
                    aria-label="Drag to reorder section"
                  >
                    <DragIndicatorIcon fontSize="small" sx={{ color: 'inherit' }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {section.title.trim() || `Section ${sectionIndex + 1}`}
                  </Typography>
                </Stack>
                <VisibilityOutlinedIcon fontSize="small" sx={{ color: active ? palette.accent : palette.mutedText }} />
              </Stack>
            </Box>
          );
        })}
        <Stack direction="row" spacing={1}>
          <Button variant="text" startIcon={<AddIcon />} onClick={onAddSection} sx={{ color: palette.text }}>
            New Section
          </Button>
          <Button
            variant="text"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={onRemoveSection}
            disabled={!canRemoveSection}
          >
            Remove
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default SectionsColumn;
