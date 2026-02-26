import type {
  QuestionType,
  QuestionDefinition,
  PageDefinition,
  ApplicationDefinition,
  VisibilityCondition,
  MultiVisibilityCondition,
  ValidationRule,
  GroupValidationRule,
  PageRepeatConfig,
  Disclosure,
  DisclosureContent,
  DisclosureAcknowledgment,
  FieldSyncGroup,
} from '../../types/application';

export type { QuestionType, QuestionDefinition, PageDefinition, ApplicationDefinition };

// ── Raw types (permissive — accept any carrier's JSON shape) ──────────────────

interface RawOption {
  value: string;
  label: string;
}

// Leaf condition formats:
//   Standard (Midland / Aspida): { field, op, value, ref_field? }
//   EquiTrust:                   { field, operator: "equals"|"is_not_empty"|"contains", value? }
type RawLeafCondition =
  | { field: string; op: string; value?: unknown; ref_field?: string | null }
  | { field: string; operator: string; value?: unknown };

// Compound condition (both schemas use uppercase AND/OR with a conditions array):
//   { operator: "AND"|"OR"|"NOT", conditions: RawLeafCondition[] }
type RawVisibility =
  | null
  | RawLeafCondition
  | { operator: string; conditions: RawLeafCondition[] };

// Midland/Aspida style: { type, value?, description?, ... }
// EquiTrust style:      { rule, params: { max?, min?, pattern?, ... } }
interface RawValidationRuleStandard {
  type: string;
  value?: string | number | boolean;
  description?: string | null;
  serviceKey?: string;
  field?: string;
  op?: string;
  ref_field?: string;
}
interface RawValidationRuleAlt {
  rule: string;
  params?: Record<string, string | number | boolean>;
  description?: string | null;
}
type RawValidationRule = RawValidationRuleStandard | RawValidationRuleAlt;

interface RawGroupValidationRule {
  type: string;
  questionId: string;
  field: string;
  filterField?: string | null;
  filterValue?: string | number | boolean | null;
  operator: string;
  value: number;
  condition?: RawVisibility;
  description?: string | null;
}

interface RawDisclosureAcknowledgment {
  questionId: string;
  type: string;
  label: string;
  hint?: string | null;
  required?: boolean;
}

interface RawDisclosureContent {
  type: string;
  body: string;
}

interface RawDisclosure {
  id: string;
  title: string;
  description?: string | null;
  content?: RawDisclosureContent | null;
  viewRequired?: boolean;
  visibility?: RawVisibility;
  acknowledgment?: RawDisclosureAcknowledgment | null;
}

interface RawPageRepeatConfig {
  sourceField: string;
  minRepeat: number;
  maxRepeat: number;
  titleTemplate: string;
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
    allowPartialAllocation?: boolean;
    funds?: Array<{
      id: string;
      name: string;
      description?: string | null;
      category?: string | null;
      riskLevel?: string | null;
      creditingMethod?: string | null;
      index?: string | null;
      termYears?: number | null;
      hasStrategyFee?: boolean | null;
      strategyFeeAnnualPct?: number | null;
    }> | null;
  } | null;
}

interface RawPage {
  id: string;
  title: string;
  description?: string | null;
  order?: number;
  // "standard" and "form" are treated as standard; "disclosure" is disclosure
  pageType?: string;
  visibility?: RawVisibility;
  pageRepeat?: RawPageRepeatConfig | null;
  questions?: RawQuestion[] | null;
  disclosures?: RawDisclosure[] | null;
  groupValidations?: RawGroupValidationRule[] | null;
}

// Top-level JSON shape — handles both Midland/Aspida and EquiTrust conventions
interface RawApplicationDefinition {
  // Midland/Aspida: "carrier"; EquiTrust: "carrierId"/"carrierName"
  id?: string;
  version?: string;
  carrier?: string;
  carrierId?: string;
  carrierName?: string;
  productName?: string;
  productId?: string;
  productType?: string;
  effectiveDate?: string;
  locale?: string;
  description?: string;
  distributors?: string[];
  pages: RawPage[];
  fieldSyncs?: Array<{
    id: string;
    description?: string | null;
    fields: string[];
    behavior?: string;
    overrideWarning?: string | null;
    condition?: RawVisibility;
  }> | null;
}

// ── Normalization helpers ─────────────────────────────────────────────────────

const KNOWN_QUESTION_TYPES = new Set<QuestionType>([
  'short_text', 'long_text', 'number', 'currency', 'date', 'boolean',
  'select', 'multi_select', 'radio', 'phone', 'email', 'ssn',
  'signature', 'initials', 'file_upload', 'repeatable_group', 'allocation_table',
]);

const KNOWN_VALIDATION_TYPES = new Set([
  'required', 'min', 'max', 'min_length', 'max_length', 'pattern',
  'min_date', 'max_date', 'equals', 'equals_today', 'cross_field',
  'allocation_sum', 'async',
]);

function normalizeVisibility(raw: RawVisibility): null | VisibilityCondition | MultiVisibilityCondition {
  if (!raw) return null;
  return raw as VisibilityCondition | MultiVisibilityCondition;
}

/** Normalize both the standard { type, value } and the alternate { rule, params } formats. */
function normalizeValidationRule(r: RawValidationRule): ValidationRule | null {
  // Alternate format (e.g. EquiTrust): { rule: "max_length", params: { max: 50 } }
  if ('rule' in r && typeof r.rule === 'string') {
    const type = r.rule;
    if (!KNOWN_VALIDATION_TYPES.has(type)) return null;
    const params = r.params ?? {};
    // Map common param keys to the canonical `value` field
    const value = params.value ?? params.max ?? params.min ?? params.length ?? params.pattern ?? undefined;
    return {
      type: type as ValidationRule['type'],
      ...(value !== undefined ? { value: value as string | number | boolean } : {}),
      ...(r.description != null ? { description: r.description } : {}),
    };
  }

  // Standard format: { type, value?, ... }
  const sr = r as RawValidationRuleStandard;
  if (!KNOWN_VALIDATION_TYPES.has(sr.type)) return null;
  const rule: ValidationRule = { type: sr.type as ValidationRule['type'] };
  if (sr.value !== undefined) rule.value = sr.value;
  if (sr.description != null) rule.description = sr.description;
  if (sr.serviceKey !== undefined) rule.serviceKey = sr.serviceKey;
  if (sr.field !== undefined) rule.field = sr.field;
  if (sr.op !== undefined) rule.op = sr.op as ValidationRule['op'];
  if (sr.ref_field !== undefined) rule.ref_field = sr.ref_field;
  return rule;
}

function normalizeValidation(raw: RawValidationRule[] | null | undefined): ValidationRule[] | undefined {
  if (!raw || raw.length === 0) return undefined;
  const rules = raw.map(normalizeValidationRule).filter((r): r is ValidationRule => r !== null);
  return rules.length > 0 ? rules : undefined;
}

function normalizeQuestionType(type: string): QuestionType {
  if (KNOWN_QUESTION_TYPES.has(type as QuestionType)) return type as QuestionType;
  return 'short_text';
}

function normalizeQuestion(question: RawQuestion): QuestionDefinition {
  return {
    id: question.id,
    label: question.label,
    type: normalizeQuestionType(question.type),
    order: question.order,
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
            .map(normalizeQuestion),
        }
      : undefined,
    allocationConfig: question.allocationConfig
      ? {
          totalRequired: question.allocationConfig.totalRequired ?? 100,
          minPerFund: question.allocationConfig.minPerFund ?? 0,
          maxPerFund: question.allocationConfig.maxPerFund ?? 100,
          allowPartialAllocation: question.allocationConfig.allowPartialAllocation ?? false,
          funds: question.allocationConfig.funds?.map((fund) => ({
            id: fund.id,
            name: fund.name,
            description: fund.description ?? undefined,
            category: fund.category ?? undefined,
            riskLevel: (fund.riskLevel as 'low' | 'low-medium' | 'medium' | 'medium-high' | 'high' | undefined) ?? undefined,
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

function normalizePageRepeat(raw: RawPageRepeatConfig | null | undefined): PageRepeatConfig | null {
  if (!raw) return null;
  return {
    sourceField: raw.sourceField,
    minRepeat: raw.minRepeat,
    maxRepeat: raw.maxRepeat,
    titleTemplate: raw.titleTemplate,
  };
}

function normalizeDisclosure(raw: RawDisclosure): Disclosure | null {
  if (!raw.acknowledgment?.questionId || !raw.acknowledgment.label) return null;
  const content: DisclosureContent = raw.content
    ? { type: raw.content.type as DisclosureContent['type'], body: raw.content.body }
    : { type: 'markdown', body: '' };
  const acknowledgment: DisclosureAcknowledgment = {
    questionId: raw.acknowledgment.questionId,
    type: (raw.acknowledgment.type === 'signature' ? 'signature' : 'boolean') as DisclosureAcknowledgment['type'],
    label: raw.acknowledgment.label,
    hint: raw.acknowledgment.hint ?? '',
    required: raw.acknowledgment.required ?? true,
  };
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? null,
    content,
    viewRequired: raw.viewRequired ?? false,
    visibility: normalizeVisibility(raw.visibility ?? null),
    acknowledgment,
  };
}

function normalizeGroupValidation(raw: RawGroupValidationRule): GroupValidationRule | null {
  if (raw.type !== 'group_sum') return null;
  return {
    type: 'group_sum',
    questionId: raw.questionId,
    field: raw.field,
    filterField: raw.filterField ?? null,
    filterValue: raw.filterValue ?? null,
    operator: raw.operator as GroupValidationRule['operator'],
    value: raw.value,
    condition: normalizeVisibility(raw.condition ?? null),
    description: raw.description ?? null,
  };
}

/** Normalize any carrier's raw JSON into the canonical ApplicationDefinition shape. */
function normalizeApplicationDefinition(raw: RawApplicationDefinition): ApplicationDefinition {
  // Resolve carrier display name — handle both field naming conventions
  const carrier = raw.carrier ?? raw.carrierName ?? raw.carrierId ?? '';
  // Resolve application id — some carriers omit it and use productId
  const id = raw.id ?? raw.productId ?? '';

  const pages = [...raw.pages]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map<PageDefinition>((page) => {
      // Normalise pageType: treat "form" and anything unknown as "standard"
      const rawType = page.pageType ?? 'standard';
      const pageType: PageDefinition['pageType'] = rawType === 'disclosure' ? 'disclosure' : 'standard';

      const questions =
        pageType === 'disclosure'
          ? // Disclosure pages: derive questions from acknowledgments
            (page.disclosures ?? [])
              .reduce<QuestionDefinition[]>((acc, d) => {
                const ack = d.acknowledgment;
                if (!ack?.questionId || !ack.label) return acc;
                acc.push({
                  id: ack.questionId,
                  label: ack.label,
                  type: (ack.type === 'signature' ? 'signature' : 'boolean') as QuestionType,
                  required: ack.required ?? true,
                  hint: ack.hint ?? undefined,
                  visibility: null,
                });
                return acc;
              }, [])
          : [...(page.questions ?? [])]
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map(normalizeQuestion);

      const disclosures =
        pageType === 'disclosure'
          ? (page.disclosures ?? [])
              .map(normalizeDisclosure)
              .filter((d): d is Disclosure => d !== null)
          : undefined;

      const groupValidations = (page.groupValidations ?? [])
        .map(normalizeGroupValidation)
        .filter((r): r is GroupValidationRule => r !== null);

      return {
        id: page.id,
        title: page.title,
        description: page.description ?? null,
        order: page.order,
        pageType,
        visibility: normalizeVisibility(page.visibility ?? null),
        pageRepeat: normalizePageRepeat(page.pageRepeat),
        questions,
        ...(disclosures && disclosures.length > 0 ? { disclosures } : {}),
        ...(groupValidations.length > 0 ? { groupValidations } : {}),
      };
    });

  const fieldSyncs: FieldSyncGroup[] = (raw.fieldSyncs ?? []).map((fs) => ({
    id: fs.id,
    description: fs.description ?? null,
    fields: fs.fields,
    behavior: 'pre_fill_warn' as const,
    overrideWarning: fs.overrideWarning ?? null,
    condition: normalizeVisibility(fs.condition ?? null),
  }));

  return {
    id,
    version: raw.version ?? '1.0.0',
    carrier,
    productName: raw.productName ?? '',
    productId: raw.productId ?? id,
    effectiveDate: raw.effectiveDate,
    locale: raw.locale,
    description: raw.description ?? '',
    productType: raw.productType,
    distributors: raw.distributors,
    pages,
    ...(fieldSyncs.length > 0 ? { fieldSyncs } : {}),
  };
}

/**
 * Parse any carrier's raw application definition JSON into the canonical
 * ApplicationDefinition shape used throughout the wizard.
 *
 * Handles structural variations across carriers (e.g. different carrier
 * field names, alternate validation rule formats, pageType aliases) so
 * callers never need to know which carrier produced the JSON.
 */
export function parseApplicationDefinition(raw: unknown): ApplicationDefinition {
  return normalizeApplicationDefinition(raw as RawApplicationDefinition);
}
