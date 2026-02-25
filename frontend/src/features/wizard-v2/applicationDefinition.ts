import rawApplicationDefinition from '../../../midland-national-eapp.json';
import type {
  QuestionType,
  QuestionDefinition,
  PageDefinition,
  ApplicationDefinition,
  VisibilityCondition,
  MultiVisibilityCondition,
  ValidationRule,
} from '../../types/application';

export type { QuestionType, QuestionDefinition, PageDefinition, ApplicationDefinition };

interface RawOption {
  value: string;
  label: string;
}

type RawVisibility =
  | null
  | { field: string; op: string; value: unknown }
  | { operator: string; conditions: Array<{ field: string; op: string; value: unknown }> };

interface RawValidationRule {
  type: string;
  value?: string | number;
  description?: string;
  serviceKey?: string;
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
  visibility?: RawVisibility;
  validation?: RawValidationRule[] | null;
  groupConfig?: {
    minItems: number;
    maxItems: number;
    addLabel?: string;
    fields: RawQuestion[];
  } | null;
  allocationConfig?: {
    totalRequired?: number;
    minPerFund?: number;
    maxPerFund?: number;
    funds?: Array<{
      id: string;
      name: string;
      description?: string | null;
      creditingMethod?: string | null;
      index?: string | null;
      termYears?: number | null;
      hasStrategyFee?: boolean;
      strategyFeeAnnualPct?: number | null;
    }> | null;
  } | null;
}

interface RawPage {
  id: string;
  title: string;
  description?: string | null;
  order?: number;
  pageType?: 'standard' | 'disclosure';
  visibility?: RawVisibility;
  questions?: RawQuestion[] | null;
  disclosures?: Array<{
    id: string;
    acknowledgment?: {
      questionId: string;
      type: 'boolean' | 'signature' | 'initials';
      label: string;
      hint?: string | null;
      required?: boolean;
    } | null;
  }> | null;
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

const KNOWN_VALIDATION_TYPES = new Set([
  'required', 'max_length', 'min_length', 'pattern', 'min', 'max',
  'min_date', 'max_date', 'equals', 'async',
]);

function normalizeVisibility(raw: RawVisibility): null | VisibilityCondition | MultiVisibilityCondition {
  if (!raw) return null;
  return raw as VisibilityCondition | MultiVisibilityCondition;
}

function normalizeValidation(raw: RawValidationRule[] | null | undefined): ValidationRule[] | undefined {
  if (!raw || raw.length === 0) return undefined;
  const rules = raw
    .filter((r) => KNOWN_VALIDATION_TYPES.has(r.type))
    .map((r) => ({ ...r }) as ValidationRule);
  return rules.length > 0 ? rules : undefined;
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
    visibility: normalizeVisibility(question.visibility ?? null),
    validation: normalizeValidation(question.validation),
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
    allocationConfig: question.allocationConfig
      ? {
          totalRequired: question.allocationConfig.totalRequired,
          minPerFund: question.allocationConfig.minPerFund,
          maxPerFund: question.allocationConfig.maxPerFund,
          funds: question.allocationConfig.funds?.map((fund) => ({
            id: fund.id,
            name: fund.name,
            description: fund.description ?? undefined,
            creditingMethod: fund.creditingMethod ?? undefined,
            index: fund.index ?? undefined,
            termYears: fund.termYears ?? undefined,
            hasStrategyFee: fund.hasStrategyFee ?? undefined,
            strategyFeeAnnualPct: fund.strategyFeeAnnualPct ?? undefined,
          })) ?? [],
        }
      : undefined,
  };
}

function normalizeApplicationDefinition(raw: RawApplicationDefinition): ApplicationDefinition {
  const toQuestionFromDisclosureAck = (
    disclosure: NonNullable<RawPage['disclosures']>[number],
  ): QuestionDefinition | null => {
    const ack = disclosure.acknowledgment;
    if (!ack?.questionId || !ack.label) return null;

    const questionType: QuestionType = ack.type === 'boolean' ? 'boolean' : 'signature';

    return {
      id: ack.questionId,
      label: ack.label,
      type: questionType,
      required: ack.required ?? true,
      hint: ack.hint ?? undefined,
      visibility: null,
    };
  };

  const pages = [...raw.pages]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map<PageDefinition>((page) => ({
      id: page.id,
      title: page.title,
      description: page.description ?? null,
      visibility: normalizeVisibility(page.visibility ?? null),
      questions:
        page.pageType === 'disclosure'
          ? (page.disclosures ?? [])
              .map((disclosure) => toQuestionFromDisclosureAck(disclosure))
              .filter((question): question is QuestionDefinition => Boolean(question))
          : [...(page.questions ?? [])]
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
