import rawApplicationDefinition from '../../../midland-national-eapp.json';

export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'radio'
  | 'phone'
  | 'email'
  | 'ssn'
  | 'signature'
  | 'repeatable_group'
  | 'allocation_table';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface QuestionDefinition {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: QuestionOption[];
  min?: number;
  max?: number;
  groupConfig?: {
    minItems: number;
    maxItems: number;
    addLabel?: string;
    fields: QuestionDefinition[];
  };
}

export interface PageDefinition {
  id: string;
  title: string;
  description: string | null;
  questions: QuestionDefinition[];
}

export interface ApplicationDefinition {
  id: string;
  version: string;
  carrier: string;
  productName: string;
  productId: string;
  description: string;
  pages: PageDefinition[];
}

interface RawOption {
  value: string;
  label: string;
}

interface RawQuestion {
  id: string;
  type: string;
  label: string;
  hint?: string | null;
  placeholder?: string | null;
  required?: boolean;
  options?: RawOption[] | null;
  order?: number;
  groupConfig?: {
    minItems: number;
    maxItems: number;
    addLabel?: string;
    fields: RawQuestion[];
  } | null;
}

interface RawPage {
  id: string;
  title: string;
  description?: string | null;
  order?: number;
  pageType?: 'standard' | 'disclosure';
  questions?: RawQuestion[] | null;
}

interface RawApplicationDefinition {
  id: string;
  version: string;
  carrier: string;
  productName: string;
  productId: string;
  description: string;
  pages: RawPage[];
}

function normalizeQuestionType(type: string): QuestionType {
  const known: QuestionType[] = [
    'short_text',
    'long_text',
    'number',
    'currency',
    'date',
    'boolean',
    'select',
    'multi_select',
    'radio',
    'phone',
    'email',
    'ssn',
    'signature',
    'repeatable_group',
    'allocation_table',
  ];

  if (known.includes(type as QuestionType)) {
    return type as QuestionType;
  }

  return 'short_text';
}

function normalizeQuestion(question: RawQuestion): QuestionDefinition {
  return {
    id: question.id,
    label: question.label,
    type: normalizeQuestionType(question.type),
    required: question.required,
    placeholder: question.placeholder ?? undefined,
    hint: question.hint ?? undefined,
    options: question.options ?? undefined,
    groupConfig: question.groupConfig
      ? {
          minItems: question.groupConfig.minItems,
          maxItems: question.groupConfig.maxItems,
          addLabel: question.groupConfig.addLabel,
          fields: [...question.groupConfig.fields]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((field) => normalizeQuestion(field)),
        }
      : undefined,
  };
}

function normalizeApplicationDefinition(raw: RawApplicationDefinition): ApplicationDefinition {
  const pages = [...raw.pages]
    .filter((page) => page.pageType !== 'disclosure')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map<PageDefinition>((page) => ({
      id: page.id,
      title: page.title,
      description: page.description ?? null,
      questions: [...(page.questions ?? [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((question) => normalizeQuestion(question)),
    }));

  return {
    id: raw.id,
    version: raw.version,
    carrier: raw.carrier,
    productName: raw.productName,
    productId: raw.productId,
    description: raw.description,
    pages,
  };
}

export const APPLICATION_DEFINITION: ApplicationDefinition = normalizeApplicationDefinition(
  rawApplicationDefinition as RawApplicationDefinition,
);
