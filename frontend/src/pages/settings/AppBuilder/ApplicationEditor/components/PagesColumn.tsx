import type { DragEvent } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { BuilderPage, BuilderPalette, DragState } from '../types';

type PagesColumnProps = {
  pages: BuilderPage[];
  activePageUid: string | null;
  palette: BuilderPalette;
  dropTargetUid: string;
  dragState: DragState | null;
  canRemovePage: boolean;
  onSelectPage: (pageUid: string) => void;
  onPageDragOver: (event: DragEvent, pageUid: string) => void;
  onPageDrop: (event: DragEvent, pageUid: string) => void;
  onDragEnd: () => void;
  onDragStart: (dragState: DragState) => void;
  onMovePage: (pageUid: string, direction: 'up' | 'down') => void;
  onAddPage: () => void;
  onRemoveActivePage: () => void;
};

function PagesColumn({
  pages,
  activePageUid,
  palette,
  dropTargetUid,
  dragState,
  canRemovePage,
  onSelectPage,
  onPageDragOver,
  onPageDrop,
  onDragEnd,
  onDragStart,
  onMovePage,
  onAddPage,
  onRemoveActivePage,
}: PagesColumnProps) {
  return (
    <Box sx={{ width: { xs: '100%', lg: 320 }, p: 2 }}>
      <Stack spacing={1.25}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Pages
        </Typography>
        {pages.map((page, pageIndex) => {
          const active = page.uid === activePageUid;
          return (
            <Box
              key={page.uid}
              onClick={() => onSelectPage(page.uid)}
              onDragOver={(event) => onPageDragOver(event, page.uid)}
              onDrop={(event) => onPageDrop(event, page.uid)}
              onDragEnd={onDragEnd}
              sx={{
                cursor: 'pointer',
                border: '1px solid',
                borderColor: active ? palette.accent : palette.border,
                outline: dragState?.kind === 'page' && dropTargetUid === page.uid ? `2px dashed ${palette.accent}` : 'none',
                bgcolor: active ? palette.selectedDark : palette.card,
                color: active ? '#ffffff' : palette.text,
                px: 1.25,
                py: 1,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    draggable
                    onDragStart={() => onDragStart({ kind: 'page', uid: page.uid })}
                    sx={{ display: 'inline-flex', cursor: 'grab', color: 'inherit' }}
                    aria-label="Drag to reorder page"
                  >
                    <DragIndicatorIcon fontSize="small" sx={{ opacity: 0.8 }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {page.title.trim() || `Page ${pageIndex + 1}`}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.25}>
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      onMovePage(page.uid, 'up');
                    }}
                    disabled={pageIndex === 0}
                    sx={{ color: active ? '#ffffff' : palette.mutedText }}
                  >
                    <KeyboardArrowUpIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      onMovePage(page.uid, 'down');
                    }}
                    disabled={pageIndex === pages.length - 1}
                    sx={{ color: active ? '#ffffff' : palette.mutedText }}
                  >
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Box>
          );
        })}
        <Stack direction="row" spacing={1}>
          <Button variant="text" startIcon={<AddIcon />} onClick={onAddPage} sx={{ color: palette.text }}>
            New Page
          </Button>
          <Button
            variant="text"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={onRemoveActivePage}
            disabled={!canRemovePage}
          >
            Remove
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default PagesColumn;
