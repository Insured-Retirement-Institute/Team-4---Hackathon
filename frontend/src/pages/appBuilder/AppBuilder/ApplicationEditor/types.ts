export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'date'
  | 'number'
  | 'ssn'
  | 'radio'
  | 'select'
  | 'switch';

export type BuilderValidationType =
  | 'min'
  | 'max'
  | 'min_length'
  | 'max_length'
  | 'pattern'
  | 'min_date'
  | 'max_date'
  | 'equals'
  | 'equals_today'
  | 'allocation_sum'
  | 'async';

export type BuilderValidationRule = {
  uid: string;
  type: BuilderValidationType;
  value: string;
  description: string;
  serviceKey: string;
};

export type BuilderQuestion = {
  uid: string;
  id: string;
  type: QuestionType;
  label: string;
  hint: string;
  placeholder: string;
  required: boolean;
  optionsInput: string;
  validations: BuilderValidationRule[];
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
  { value: 'ssn', label: 'SSN' },
  { value: 'radio', label: 'Radio' },
  { value: 'select', label: 'Dropdown' },
  { value: 'switch', label: 'Switch' },
];

export const VALIDATION_RULE_TYPES: Array<{ value: BuilderValidationType; label: string; needsValue?: boolean; needsServiceKey?: boolean }> = [
  { value: 'min', label: 'Min (Numeric Value)', needsValue: true },
  { value: 'max', label: 'Max (Numeric Value)', needsValue: true },
  { value: 'min_length', label: 'Min (Text Length)', needsValue: true },
  { value: 'max_length', label: 'Max (Text Length)', needsValue: true },
  { value: 'pattern', label: 'Pattern (Regex)', needsValue: true },
  { value: 'min_date', label: 'Min Date', needsValue: true },
  { value: 'max_date', label: 'Max Date', needsValue: true },
  { value: 'equals', label: 'Equals', needsValue: true },
  { value: 'equals_today', label: 'Equals Today' },
];
