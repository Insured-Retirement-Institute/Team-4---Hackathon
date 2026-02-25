import type { DragEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type Product } from '../../../../services/apiService';
import PagesColumn from './components/PagesColumn';
import QuestionDetailsPanel from './components/QuestionDetailsPanel';
import QuestionsColumn from './components/QuestionsColumn';
import SectionsColumn from './components/SectionsColumn';
import type { BuilderForm, BuilderPage, BuilderQuestion, BuilderSection, BuilderPalette, DragState } from './types';

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

function titleFromId(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function mapQuestionType(type: string): BuilderQuestion['type'] {
  switch (type) {
    case 'long_text':
      return 'long_text';
    case 'date':
      return 'date';
    case 'number':
    case 'currency':
      return 'number';
    case 'radio':
      return 'radio';
    case 'select':
    case 'multi_select':
      return 'select';
    case 'boolean':
      return 'switch';
    default:
      return 'short_text';
  }
}

function toOptionsInput(options: Array<{ value: string; label: string }> | undefined) {
  if (!options?.length) return '';
  return options.map((option) => `${option.value}|${option.label}`).join('\n');
}

function sectionIdFromQuestionId(questionId: string, fallbackIndex: number) {
  if (questionId.includes('__')) {
    const [prefix] = questionId.split('__');
    if (prefix) return prefix;
  }
  return `section_${fallbackIndex + 1}`;
}

function createFormFromProduct(product: Product): BuilderForm {
  const mappedPages: BuilderPage[] = (product.pages ?? []).map((page, pageIndex) => {
    const sectionMap = new Map<string, BuilderSection>();
    const sectionOrder: string[] = [];

    (page.questions ?? []).forEach((question, questionIndex) => {
      const sectionId = sectionIdFromQuestionId(question.id, 0);
      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, {
          uid: makeUid(),
          id: sectionId,
          title: titleFromId(sectionId),
          description: '',
          questions: [],
        });
        sectionOrder.push(sectionId);
      }

      const section = sectionMap.get(sectionId)!;
      const localQuestionId = question.id.includes('__') ? question.id.split('__').slice(1).join('__') : question.id;
      section.questions.push({
        uid: makeUid(),
        id: localQuestionId || `question_${questionIndex + 1}`,
        type: mapQuestionType(question.type),
        label: question.label ?? '',
        hint: question.hint ?? '',
        placeholder: question.placeholder ?? '',
        required: Boolean(question.required),
        optionsInput: toOptionsInput(question.options ?? undefined),
      });
    });

    const mappedSections = sectionOrder.map((sectionId, sectionIndex) => {
      const section = sectionMap.get(sectionId)!;
      if (!section.questions.length) {
        section.questions = [createEmptyQuestion(sectionIndex + 1)];
      }
      return section;
    });

    return {
      uid: makeUid(),
      id: page.id || `page_${pageIndex + 1}`,
      title: page.title || `Page ${pageIndex + 1}`,
      description: page.description ?? '',
      pageType: 'standard',
      sections: mappedSections.length ? mappedSections : [createEmptySection(1)],
    };
  });

  return {
    id: product.id || 'new-eapp',
    version: product.version || '1.0.0',
    carrier: product.carrier || '',
    productName: product.productName || '',
    productId: product.productId || '',
    effectiveDate: product.effectiveDate || new Date().toISOString().slice(0, 10),
    locale: product.locale || 'en-US',
    description: product.description || '',
    pages: mappedPages.length ? mappedPages : [createEmptyPage(1)],
  };
}

type ApplicationEditorPanelProps = {
  selectedProduct: Product | null;
};

function ApplicationEditorPanel({ selectedProduct }: ApplicationEditorPanelProps) {
  const [form, setForm] = useState<BuilderForm>(createInitialBuilderForm);
  const [savedJson, setSavedJson] = useState<string>('');
  const [activePageUid, setActivePageUid] = useState<string>(form.pages[0]?.uid ?? '');
  const [activeSectionUid, setActiveSectionUid] = useState<string>(form.pages[0]?.sections[0]?.uid ?? '');
  const [activeQuestionUid, setActiveQuestionUid] = useState<string>(
    form.pages[0]?.sections[0]?.questions[0]?.uid ?? '',
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetUid, setDropTargetUid] = useState<string>('');

  const palette: BuilderPalette = {
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
    if (!selectedProduct) return;
    const nextForm = createFormFromProduct(selectedProduct);
    const firstPage = nextForm.pages[0] ?? null;
    const firstSection = firstPage?.sections[0] ?? null;
    const firstQuestion = firstSection?.questions[0] ?? null;

    setForm(nextForm);
    setActivePageUid(firstPage?.uid ?? '');
    setActiveSectionUid(firstSection?.uid ?? '');
    setActiveQuestionUid(firstQuestion?.uid ?? '');
  }, [selectedProduct]);

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

  const handlePageDragOver = (event: DragEvent, pageUid: string) => {
    if (dragState?.kind !== 'page') return;
    event.preventDefault();
    setDropTargetUid(pageUid);
  };

  const handlePageDrop = (event: DragEvent, pageUid: string) => {
    if (dragState?.kind !== 'page') return;
    event.preventDefault();
    movePageTo(dragState.uid, pageUid);
    onDropEnd();
  };

  const handleSectionDragOver = (event: DragEvent, sectionUid: string) => {
    if (dragState?.kind !== 'section' || dragState.pageUid !== activePage?.uid) return;
    event.preventDefault();
    setDropTargetUid(sectionUid);
  };

  const handleSectionDrop = (event: DragEvent, sectionUid: string) => {
    if (dragState?.kind !== 'section' || dragState.pageUid !== activePage?.uid || !activePage) return;
    event.preventDefault();
    moveSectionTo(activePage.uid, dragState.uid, sectionUid);
    onDropEnd();
  };

  const handleQuestionDragOver = (event: DragEvent, questionUid: string) => {
    if (
      dragState?.kind !== 'question' ||
      dragState.pageUid !== activePage?.uid ||
      dragState.sectionUid !== activeSection?.uid
    ) {
      return;
    }
    event.preventDefault();
    setDropTargetUid(questionUid);
  };

  const handleQuestionDrop = (event: DragEvent, questionUid: string) => {
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
    moveQuestionTo(activePage.uid, activeSection.uid, dragState.uid, questionUid);
    onDropEnd();
  };

  const previewQuestion = (question: BuilderQuestion) => {
    if (question.type === 'switch') {
      return <FormControlLabel control={<Switch checked={false} />} label={question.label || 'Switch label'} sx={{ m: 0 }} />;
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
        <Button variant="contained" onClick={handleSave} sx={{ bgcolor: palette.accent, '&:hover': { bgcolor: '#258ff0' } }}>
          Save JSON
        </Button>
      </Stack>

      <Box sx={{ p: 2, border: '1px solid', borderColor: palette.border, bgcolor: palette.canvas }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ xs: 'stretch', lg: 'center' }}>
          <TextField size="small" label="Schema ID" value={form.id} onChange={(event) => handleMetaChange('id', event.target.value)} />
          <TextField size="small" label="Carrier" value={form.carrier} onChange={(event) => handleMetaChange('carrier', event.target.value)} />
          <TextField size="small" label="Product Name" value={form.productName} onChange={(event) => handleMetaChange('productName', event.target.value)} />
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
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0}>
          <PagesColumn
            pages={form.pages}
            activePageUid={activePage?.uid ?? null}
            palette={palette}
            dropTargetUid={dropTargetUid}
            dragState={dragState}
            canRemovePage={Boolean(activePage && form.pages.length > 1)}
            onSelectPage={setActivePageUid}
            onPageDragOver={handlePageDragOver}
            onPageDrop={handlePageDrop}
            onDragEnd={onDropEnd}
            onDragStart={onDragStart}
            onMovePage={movePage}
            onAddPage={addPage}
            onRemoveActivePage={() => activePage && removePage(activePage.uid)}
          />

          <Box sx={{ flex: 1, minHeight: 620, p: 2 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
              <SectionsColumn
                activePage={activePage}
                activeSectionUid={activeSection?.uid ?? null}
                palette={palette}
                dropTargetUid={dropTargetUid}
                dragState={dragState}
                canRemoveSection={Boolean(activePage && activeSection && (activePage.sections.length ?? 0) > 1)}
                onSelectSection={setActiveSectionUid}
                onSectionDragOver={handleSectionDragOver}
                onSectionDrop={handleSectionDrop}
                onDragEnd={onDropEnd}
                onDragStart={onDragStart}
                onAddSection={() => activePage && addSection(activePage.uid)}
                onRemoveSection={() => activePage && activeSection && removeSection(activePage.uid, activeSection.uid)}
              />

              <QuestionsColumn
                activePage={activePage}
                activeSection={activeSection}
                activeQuestionUid={activeQuestion?.uid ?? null}
                palette={palette}
                dropTargetUid={dropTargetUid}
                dragState={dragState}
                canRemoveQuestion={Boolean(activeSection && activeQuestion && (activeSection.questions.length ?? 0) > 1)}
                onSelectQuestion={setActiveQuestionUid}
                onQuestionDragOver={handleQuestionDragOver}
                onQuestionDrop={handleQuestionDrop}
                onDragEnd={onDropEnd}
                onDragStart={onDragStart}
                onAddQuestion={() => activePage && activeSection && addQuestion(activePage.uid, activeSection.uid)}
                onRemoveQuestion={() =>
                  activePage &&
                  activeSection &&
                  activeQuestion &&
                  removeQuestion(activePage.uid, activeSection.uid, activeQuestion.uid)
                }
              />

              <QuestionDetailsPanel
                activePage={activePage}
                activeSection={activeSection}
                activeQuestion={activeQuestion}
                palette={palette}
                detailFieldSx={detailFieldSx}
                previewQuestion={previewQuestion}
                onUpdatePageTitle={(value) => activePage && updatePage(activePage.uid, (current) => ({ ...current, title: value }))}
                onUpdateSectionTitle={(value) =>
                  activePage &&
                  activeSection &&
                  updateSection(activePage.uid, activeSection.uid, (current) => ({ ...current, title: value }))
                }
                onUpdateQuestionId={(value) =>
                  activePage &&
                  activeSection &&
                  activeQuestion &&
                  updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                    ...current,
                    id: value,
                  }))
                }
                onUpdateQuestionLabel={(value) =>
                  activePage &&
                  activeSection &&
                  activeQuestion &&
                  updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                    ...current,
                    label: value,
                  }))
                }
                onUpdateQuestionType={(value) =>
                  activePage &&
                  activeSection &&
                  activeQuestion &&
                  updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                    ...current,
                    type: value,
                  }))
                }
                onUpdateQuestionHint={(value) =>
                  activePage &&
                  activeSection &&
                  activeQuestion &&
                  updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                    ...current,
                    hint: value,
                  }))
                }
                onUpdateQuestionPlaceholder={(value) =>
                  activePage &&
                  activeSection &&
                  activeQuestion &&
                  updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                    ...current,
                    placeholder: value,
                  }))
                }
                onUpdateQuestionOptions={(value) =>
                  activePage &&
                  activeSection &&
                  activeQuestion &&
                  updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                    ...current,
                    optionsInput: value,
                  }))
                }
                onUpdateQuestionRequired={(value) =>
                  activePage &&
                  activeSection &&
                  activeQuestion &&
                  updateQuestion(activePage.uid, activeSection.uid, activeQuestion.uid, (current) => ({
                    ...current,
                    required: value,
                  }))
                }
              />
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

export default ApplicationEditorPanel;
