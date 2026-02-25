export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'date'
  | 'number'
  | 'radio'
  | 'select'
  | 'switch';

export type BuilderQuestion = {
  uid: string;
  id: string;
  type: QuestionType;
  label: string;
  hint: string;
  placeholder: string;
  required: boolean;
  optionsInput: string;
};

export type BuilderSection = {
  uid: string;
  id: string;
  title: string;
  description: string;
  questions: BuilderQuestion[];
};

export type BuilderPage = {
  uid: string;
  id: string;
  title: string;
  description: string;
  pageType: 'standard' | 'disclosure';
  sections: BuilderSection[];
};

export type BuilderForm = {
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

export type DragState =
  | { kind: 'page'; uid: string }
  | { kind: 'section'; pageUid: string; uid: string }
  | { kind: 'question'; pageUid: string; sectionUid: string; uid: string };

export type BuilderPalette = {
  canvas: string;
  panel: string;
  card: string;
  border: string;
  text: string;
  mutedText: string;
  accent: string;
  accentSoft: string;
  selectedDark: string;
};

export const QUESTION_TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'radio', label: 'Radio' },
  { value: 'select', label: 'Dropdown' },
  { value: 'switch', label: 'Switch' },
];
