import { useEffect, useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'date'
  | 'number'
  | 'radio'
  | 'select'
  | 'switch';

type BuilderQuestion = {
  uid: string;
  id: string;
  type: QuestionType;
  label: string;
  hint: string;
  placeholder: string;
  required: boolean;
  optionsInput: string;
};

type BuilderSection = {
  uid: string;
  id: string;
  title: string;
  description: string;
  questions: BuilderQuestion[];
};

type BuilderPage = {
  uid: string;
  id: string;
  title: string;
  description: string;
  pageType: 'standard' | 'disclosure';
  sections: BuilderSection[];
};

type BuilderForm = {
  id: string;
  version: string;
  carrier: string;
  productName: string;
  productId: string;
  effectiveDate: string;
  locale: string;
  description: string;
  pages: BuilderPage[];
};

type DragState =
  | { kind: 'page'; uid: string }
  | { kind: 'section'; pageUid: string; uid: string }
  | { kind: 'question'; pageUid: string; sectionUid: string; uid: string };

const QUESTION_TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'radio', label: 'Radio' },
  { value: 'select', label: 'Dropdown' },
  { value: 'switch', label: 'Switch' },
];

function safeId(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function makeUid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `uid_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function parseOptions(optionsInput: string) {
  const lines = optionsInput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  return lines.map((line) => {
    const [rawValue, rawLabel] = line.split('|').map((part) => part.trim());
    const value = safeId(rawValue || rawLabel || line);
    const label = rawLabel || rawValue || line;
    return { value, label };
  });
}

function createEmptyQuestion(index: number): BuilderQuestion {
  return {
    uid: makeUid(),
    id: `question_${index}`,
    type: 'short_text',
    label: '',
    hint: '',
    placeholder: '',
    required: false,
    optionsInput: '',
  };
}

function createEmptySection(index: number): BuilderSection {
  return {
    uid: makeUid(),
    id: `section_${index}`,
    title: '',
    description: '',
    questions: [createEmptyQuestion(1)],
  };
}

function createEmptyPage(index: number): BuilderPage {
  return {
    uid: makeUid(),
    id: `page_${index}`,
    title: '',
    description: '',
    pageType: 'standard',
    sections: [createEmptySection(1)],
  };
}

function createInitialBuilderForm(): BuilderForm {
  return {
    id: 'new-eapp',
    version: '1.0.0',
    carrier: '',
    productName: '',
    productId: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    locale: 'en-US',
    description: '',
    pages: [createEmptyPage(1)],
  };
}

function AppBuilderPanel() {
  const [form, setForm] = useState<BuilderForm>(createInitialBuilderForm);
  const [savedJson, setSavedJson] = useState<string>('');
  const [activePageUid, setActivePageUid] = useState<string>(form.pages[0]?.uid ?? '');
  const [activeSectionUid, setActiveSectionUid] = useState<string>(form.pages[0]?.sections[0]?.uid ?? '');
  const [activeQuestionUid, setActiveQuestionUid] = useState<string>(
    form.pages[0]?.sections[0]?.questions[0]?.uid ?? '',
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetUid, setDropTargetUid] = useState<string>('');

  const palette = {
    canvas: 'transparent',
    panel: 'transparent',
    card: '#ffffff',
    border: '#d4d4d4',
    text: '#1f1f1f',
    mutedText: '#7e7e7e',
    accent: '#3a9df7',
    accentSoft: '#d7e8f9',
    selectedDark: '#111111',
  };

  const pageCount = form.pages.length;
  const questionCount = useMemo(
    () =>
      form.pages.reduce(
        (pageTotal, page) =>
          pageTotal + page.sections.reduce((sectionTotal, section) => sectionTotal + section.questions.length, 0),
        0,
      ),
    [form.pages],
  );

  const handleMetaChange = (field: keyof Omit<BuilderForm, 'pages'>, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updatePage = (pageUid: string, updater: (page: BuilderPage) => BuilderPage) => {
    setForm((prev) => ({
      ...prev,
      pages: prev.pages.map((page) => (page.uid === pageUid ? updater(page) : page)),
    }));
  };

  const addPage = () => {
    const nextPage = createEmptyPage(form.pages.length + 1);
    setForm((prev) => ({
      ...prev,
      pages: [...prev.pages, nextPage],
    }));
    setActivePageUid(nextPage.uid);
  };

  const removePage = (pageUid: string) => {
    setForm((prev) => {
      const removedIndex = prev.pages.findIndex((page) => page.uid === pageUid);
      const nextPages = prev.pages.filter((page) => page.uid !== pageUid);

      if (!nextPages.length) return prev;

      if (activePageUid === pageUid) {
        const nextIndex = Math.max(0, Math.min(removedIndex, nextPages.length - 1));
        setActivePageUid(nextPages[nextIndex].uid);
      }

      return {
        ...prev,
        pages: nextPages,
      };
    });
  };

  const movePage = (pageUid: string, direction: 'up' | 'down') => {
    setForm((prev) => {
      const currentIndex = prev.pages.findIndex((page) => page.uid === pageUid);
      if (currentIndex < 0) return prev;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.pages.length) return prev;

      const nextPages = [...prev.pages];
      const [movedPage] = nextPages.splice(currentIndex, 1);
      nextPages.splice(targetIndex, 0, movedPage);

      return { ...prev, pages: nextPages };
    });
  };

  const reorderWithinList = <T extends { uid: string }>(items: T[], draggedUid: string, targetUid: string): T[] => {
    const fromIndex = items.findIndex((item) => item.uid === draggedUid);
    const toIndex = items.findIndex((item) => item.uid === targetUid);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    return reordered;
  };

  const movePageTo = (draggedUid: string, targetUid: string) => {
    setForm((prev) => ({ ...prev, pages: reorderWithinList(prev.pages, draggedUid, targetUid) }));
  };

  const moveSectionTo = (pageUid: string, draggedUid: string, targetUid: string) => {
    updatePage(pageUid, (page) => ({
      ...page,
      sections: reorderWithinList(page.sections, draggedUid, targetUid),
    }));
  };

  const moveQuestionTo = (pageUid: string, sectionUid: string, draggedUid: string, targetUid: string) => {
    updateSection(pageUid, sectionUid, (section) => ({
      ...section,
      questions: reorderWithinList(section.questions, draggedUid, targetUid),
    }));
  };

  const onDragStart = (nextDragState: DragState) => {
    setDragState(nextDragState);
    setDropTargetUid('');
  };

  const onDropEnd = () => {
    setDragState(null);
    setDropTargetUid('');
  };

  const addSection = (pageUid: string) => {
    const nextSection = createEmptySection((form.pages.find((page) => page.uid === pageUid)?.sections.length ?? 0) + 1);
    updatePage(pageUid, (page) => ({ ...page, sections: [...page.sections, nextSection] }));
    setActiveSectionUid(nextSection.uid);
    setActiveQuestionUid(nextSection.questions[0]?.uid ?? '');
  };

  const removeSection = (pageUid: string, sectionUid: string) => {
    updatePage(pageUid, (page) => ({
      ...page,
      sections: page.sections.filter((section) => section.uid !== sectionUid),
    }));
  };

  const updateSection = (
    pageUid: string,
    sectionUid: string,
    updater: (section: BuilderSection) => BuilderSection,
  ) => {
    updatePage(pageUid, (page) => ({
      ...page,
      sections: page.sections.map((section) => (section.uid === sectionUid ? updater(section) : section)),
    }));
  };

  const addQuestion = (pageUid: string, sectionUid: string) => {
    const section = form.pages
      .find((page) => page.uid === pageUid)
      ?.sections.find((item) => item.uid === sectionUid);
    const nextQuestion = createEmptyQuestion((section?.questions.length ?? 0) + 1);
    updateSection(pageUid, sectionUid, (current) => ({ ...current, questions: [...current.questions, nextQuestion] }));
    setActiveQuestionUid(nextQuestion.uid);
  };

  const removeQuestion = (pageUid: string, sectionUid: string, questionUid: string) => {
    updateSection(pageUid, sectionUid, (section) => ({
      ...section,
      questions: section.questions.filter((question) => question.uid !== questionUid),
    }));
  };

  const updateQuestion = (
    pageUid: string,
    sectionUid: string,
    questionUid: string,
    updater: (question: BuilderQuestion) => BuilderQuestion,
  ) => {
    updateSection(pageUid, sectionUid, (section) => ({
      ...section,
      questions: section.questions.map((question) => (question.uid === questionUid ? updater(question) : question)),
    }));
  };

  const handleSave = () => {
    const output = {
      id: safeId(form.id) || 'new_eapp',
      version: form.version || '1.0.0',
      carrier: form.carrier.trim(),
      productName: form.productName.trim(),
      productId: safeId(form.productId) || 'new_product',
      effectiveDate: form.effectiveDate,
      locale: form.locale.trim() || 'en-US',
      description: form.description.trim(),
      pages: form.pages.map((page, pageIndex) => {
        let runningOrder = 0;
        const questions = page.sections.flatMap((section) =>
          section.questions.map((question) => {
            runningOrder += 1;
            const sectionId = safeId(section.id) || 'section';
            const rawQuestionId = safeId(question.id) || `question_${runningOrder}`;
            const questionId = `${sectionId}__${rawQuestionId}`;
            const options = question.type === 'radio' || question.type === 'select' ? parseOptions(question.optionsInput) : null;

            return {
              id: questionId,
              type: question.type,
              label: question.label.trim() || questionId,
              hint: question.hint.trim() || null,
              placeholder: question.placeholder.trim() || null,
              order: runningOrder,
              required: question.required,
              visibility: null,
              options,
              validation: question.required ? [{ type: 'required' }] : [],
              groupConfig: null,
              allocationConfig: null,
            };
          }),
        );

        return {
          id: safeId(page.id) || `page_${pageIndex + 1}`,
          title: page.title.trim() || `Page ${pageIndex + 1}`,
          description: page.description.trim() || null,
          order: pageIndex + 1,
          pageType: page.pageType,
          visibility: null,
          pageRepeat: null,
          questions,
          groupValidations: [],
        };
      }),
    };

    setSavedJson(JSON.stringify(output, null, 2));
  };

  const activePage = form.pages.find((page) => page.uid === activePageUid) ?? form.pages[0] ?? null;
  const activeSection = activePage?.sections.find((section) => section.uid === activeSectionUid) ?? activePage?.sections[0] ?? null;
  const activeQuestion =
    activeSection?.questions.find((question) => question.uid === activeQuestionUid) ?? activeSection?.questions[0] ?? null;

  useEffect(() => {
    if (!activePage && form.pages[0]) {
      setActivePageUid(form.pages[0].uid);
    }
  }, [activePage, form.pages]);

  useEffect(() => {
    if (!activePage) return;
    if (!activeSection) {
      const fallback = activePage.sections[0];
      if (fallback) setActiveSectionUid(fallback.uid);
      return;
    }
    if (!activeQuestion) {
      const fallback = activeSection.questions[0];
      if (fallback) setActiveQuestionUid(fallback.uid);
    }
  }, [activePage, activeSection, activeQuestion]);

  const previewQuestion = (question: BuilderQuestion) => {
    if (question.type === 'switch') {
      return (
        <FormControlLabel
          control={<Switch checked={false} />}
          label={question.label || 'Switch label'}
          sx={{ m: 0 }}
        />
      );
    }

    if (question.type === 'radio') {
      const options = parseOptions(question.optionsInput) ?? [];
      return (
        <Stack spacing={0.5}>
          <Typography variant="body2" sx={{ color: palette.text }}>
            {question.label || 'Select an option'}
          </Typography>
          <RadioGroup value="">
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={<Radio size="small" />}
                label={option.label}
                sx={{ m: 0 }}
              />
            ))}
          </RadioGroup>
        </Stack>
      );
    }

    if (question.type === 'select') {
      const options = parseOptions(question.optionsInput) ?? [];
      return (
        <TextField
          select
          fullWidth
          size="small"
          label={question.label || 'Select an option'}
          value=""
          slotProps={{ inputLabel: { shrink: true } }}
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    return (
      <TextField
        fullWidth
        size="small"
        multiline={question.type === 'long_text'}
        minRows={question.type === 'long_text' ? 3 : undefined}
        type={question.type === 'date' || question.type === 'number' ? question.type : 'text'}
        label={question.label || 'Field label'}
        placeholder={question.placeholder || 'Value'}
      />
    );
  };

  const detailFieldSx = {
    '& .MuiOutlinedInput-root.Mui-focused fieldset': {
      borderColor: palette.accent,
      borderWidth: 2,
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: palette.accent,
    },
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: palette.text }}>
            Editing {form.productName.trim() || 'Annuity Application'}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip
              label={`${pageCount} page${pageCount === 1 ? '' : 's'}`}
              size="small"
              sx={{ bgcolor: palette.accentSoft, color: palette.accent, fontWeight: 700 }}
            />
            <Chip
              label={`${questionCount} question${questionCount === 1 ? '' : 's'}`}
              size="small"
              sx={{ bgcolor: palette.accentSoft, color: palette.accent, fontWeight: 700 }}
            />
          </Stack>
        </Stack>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{ bgcolor: palette.accent, '&:hover': { bgcolor: '#258ff0' } }}
        >
          Save JSON
        </Button>
      </Stack>

      <Box
        sx={{
          p: 2,
          border: '1px solid',
          borderColor: palette.border,
          bgcolor: palette.canvas,
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ xs: 'stretch', lg: 'center' }}>
          <TextField size="small" label="Schema ID" value={form.id} onChange={(event) => handleMetaChange('id', event.target.value)} />
          <TextField size="small" label="Carrier" value={form.carrier} onChange={(event) => handleMetaChange('carrier', event.target.value)} />
          <TextField
            size="small"
            label="Product Name"
            value={form.productName}
            onChange={(event) => handleMetaChange('productName', event.target.value)}
          />
          <TextField size="small" label="Product ID" value={form.productId} onChange={(event) => handleMetaChange('productId', event.target.value)} />
          <TextField
            size="small"
            type="date"
            label="Effective Date"
            value={form.effectiveDate}
            onChange={(event) => handleMetaChange('effectiveDate', event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </Box>

      <Box sx={{ border: '1px solid', borderColor: palette.border, bgcolor: palette.canvas }}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={0}
        >
          <Box sx={{ width: { xs: '100%', lg: 320 }, p: 2 }}>
            <Stack spacing={1.25}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Pages
              </Typography>
              {form.pages.map((page, pageIndex) => {
                const active = page.uid === activePage?.uid;
                return (
                  <Box
                    key={page.uid}
                    onClick={() => setActivePageUid(page.uid)}
                    onDragOver={(event) => {
                      if (dragState?.kind !== 'page') return;
                      event.preventDefault();
                      setDropTargetUid(page.uid);
                    }}
                    onDrop={(event) => {
                      if (dragState?.kind !== 'page') return;
                      event.preventDefault();
                      movePageTo(dragState.uid, page.uid);
                      onDropEnd();
                    }}
                    onDragEnd={onDropEnd}
                    sx={{
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: active ? palette.accent : palette.border,
                      outline: dropTargetUid === page.uid ? `2px dashed ${palette.accent}` : 'none',
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
                            movePage(page.uid, 'up');
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
                            movePage(page.uid, 'down');
                          }}
                          disabled={pageIndex === form.pages.length - 1}
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
                <Button variant="text" startIcon={<AddIcon />} onClick={addPage} sx={{ color: palette.text }}>
                  New Page
                </Button>
                <Button
                  variant="text"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => activePage && removePage(activePage.uid)}
                  disabled={!activePage || form.pages.length === 1}
                >
                  Remove
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, minHeight: 620, p: 2 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
              <Box sx={{ width: { xs: '100%', lg: '34%' } }}>
                <Stack spacing={1.25}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Sections
                  </Typography>
                  {activePage?.sections.map((section, sectionIndex) => {
                    const active = section.uid === activeSection?.uid;
                    return (
                      <Box
                        key={section.uid}
                        onClick={() => setActiveSectionUid(section.uid)}
                        onDragOver={(event) => {
                          if (dragState?.kind !== 'section' || dragState.pageUid !== activePage?.uid) return;
                          event.preventDefault();
                          setDropTargetUid(section.uid);
                        }}
                        onDrop={(event) => {
                          if (dragState?.kind !== 'section' || dragState.pageUid !== activePage?.uid || !activePage) return;
                          event.preventDefault();
                          moveSectionTo(activePage.uid, dragState.uid, section.uid);
                          onDropEnd();
                        }}
                        onDragEnd={onDropEnd}
                        sx={{
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: active ? palette.accent : palette.border,
                          outline: dropTargetUid === section.uid ? `2px dashed ${palette.accent}` : 'none',
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
                    <Button variant="text" startIcon={<AddIcon />} onClick={() => activePage && addSection(activePage.uid)} sx={{ color: palette.text }}>
                      New Section
                    </Button>
                    <Button
                      variant="text"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() => activePage && activeSection && removeSection(activePage.uid, activeSection.uid)}
                      disabled={!activePage || !activeSection || (activePage?.sections.length ?? 0) <= 1}
                    >
                      Remove
                    </Button>
                  </Stack>
                </Stack>
              </Box>

              <Box sx={{ width: { xs: '100%', lg: '33%' } }}>
                <Stack spacing={1.25}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Questions
                  </Typography>
                  {activeSection?.questions.map((question, questionIndex) => {
                    const active = question.uid === activeQuestion?.uid;
                    return (
                      <Box
                        key={question.uid}
                        onClick={() => setActiveQuestionUid(question.uid)}
                        onDragOver={(event) => {
                          if (
                            dragState?.kind !== 'question' ||
                            dragState.pageUid !== activePage?.uid ||
                            dragState.sectionUid !== activeSection?.uid
                          ) {
                            return;
                          }
                          event.preventDefault();
                          setDropTargetUid(question.uid);
                        }}
                        onDrop={(event) => {
                          if (
                            dragState?.kind !== 'question' ||
                            dragState.pageUid !== activePage?.uid ||
                            dragState.sectionUid !== activeSection?.uid ||
                            !activePage ||
                            !activeSection
                          ) {
                            return;
                          }
                          event.preventDefault();
                          moveQuestionTo(activePage.uid, activeSection.uid, dragState.uid, question.uid);
                          onDropEnd();
                        }}
                        onDragEnd={onDropEnd}
                        sx={{
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: active ? palette.accent : palette.border,
                          outline: dropTargetUid === question.uid ? `2px dashed ${palette.accent}` : 'none',
                          bgcolor: '#ffffff',
                          color: active ? palette.text : palette.text,
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
                    <Button
                      variant="text"
                      startIcon={<AddIcon />}
                      onClick={() => activePage && activeSection && addQuestion(activePage.uid, activeSection.uid)}
                      sx={{ color: palette.text }}
                    >
                      New Question
                    </Button>
                    <Button
                      variant="text"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() =>
                        activePage &&
                        activeSection &&
                        activeQuestion &&
                        removeQuestion(activePage.uid, activeSection.uid, activeQuestion.uid)
                      }
                      disabled={!activeSection || !activeQuestion || (activeSection?.questions.length ?? 0) <= 1}
                    >
                      Remove
                    </Button>
                  </Stack>
                </Stack>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Stack spacing={1.25}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Question Details
                  </Typography>
                  {activePage && activeSection && activeQuestion ? (
                    <Stack spacing={1.25}>
                      <TextField
                        size="small"
                        label="Page Title"
                        value={activePage.title}
                        sx={detailFieldSx}
                        onChange={(event) => updatePage(activePage.uid, (current) => ({ ...current, title: event.target.value }))}
                      />
                      <TextField
                        size="small"
                        label="Section Title"
                        value={activeSection.title}
                        sx={detailFieldSx}
                        onChange={(event) =>
                          updateSection(activePage.uid, activeSection.uid, (current) => ({ ...current, title: event.target.value }))
                        }
                      />
                      <TextField
                        size="small"
                        label="Question ID"
                        value={activeQuestion.id}
                        sx={detailFieldSx}
                        onChange={(event) =>
                          updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                            ...current,
                            id: event.target.value,
                          }))
                        }
                      />
                      <TextField
                        size="small"
                        label="Label"
                        value={activeQuestion.label}
                        sx={detailFieldSx}
                        onChange={(event) =>
                          updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                            ...current,
                            label: event.target.value,
                          }))
                        }
                      />
                      <TextField
                        size="small"
                        select
                        label="Type"
                        value={activeQuestion.type}
                        sx={detailFieldSx}
                        onChange={(event) =>
                          updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                            ...current,
                            type: event.target.value as QuestionType,
                          }))
                        }
                      >
                        {QUESTION_TYPES.map((typeOption) => (
                          <MenuItem key={typeOption.value} value={typeOption.value}>
                            {typeOption.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        label="Hint"
                        value={activeQuestion.hint}
                        sx={detailFieldSx}
                        onChange={(event) =>
                          updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                            ...current,
                            hint: event.target.value,
                          }))
                        }
                      />
                      <TextField
                        size="small"
                        label="Placeholder"
                        value={activeQuestion.placeholder}
                        sx={detailFieldSx}
                        onChange={(event) =>
                          updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                            ...current,
                            placeholder: event.target.value,
                          }))
                        }
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
                          onChange={(event) =>
                            updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                              ...current,
                              optionsInput: event.target.value,
                            }))
                          }
                        />
                      )}
                      <FormControlLabel
                        control={
                          <Switch
                            checked={activeQuestion.required}
                            onChange={(_, checked) =>
                              updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                                ...current,
                                required: checked,
                              }))
                            }
                          />
                        }
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
            </Stack>
          </Box>
        </Stack>
      </Box>

      {savedJson ? (
        <Stack spacing={1}>
          <Alert severity="success">Generated JSON</Alert>
          <TextField fullWidth multiline minRows={14} value={savedJson} slotProps={{ input: { readOnly: true } }} />
        </Stack>
      ) : null}
    </Stack>
  );
}

export default AppBuilderPanel;
