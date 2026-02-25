// Canonical domain types for the annuity application schema.
// Both the static JSON loader (applicationDefinition.ts) and the API service
// (apiService.ts) import from here — single source of truth.
// Mirrors backend/Assets/annuity-eapp-openapi-3.yaml (auto-generated; check before editing).

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
  | 'initials'
  | 'file_upload'
  | 'repeatable_group'
  | 'allocation_table';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface AllocationFund {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  riskLevel?: 'low' | 'low-medium' | 'medium' | 'medium-high' | 'high' | null;
  creditingMethod?: string | null;
  index?: string | null;
  termYears?: number | null;
  hasStrategyFee?: boolean | null;
  strategyFeeAnnualPct?: number | null;
}

export interface AllocationConfig {
  totalRequired: number;
  minPerFund: number;
  maxPerFund: number;
  allowPartialAllocation: boolean;
  funds: AllocationFund[];
}

export interface QuestionDefinition {
  id: string;
  label: string;
  type: QuestionType;
  order?: number;
  required?: boolean;
  placeholder?: string | null;
  hint?: string;
  options?: QuestionOption[] | null;
  min?: number;
  max?: number;
  groupConfig?: {
    minItems: number;
    maxItems: number;
    addLabel?: string;
    fields: QuestionDefinition[];
  };
  visibility: null | VisibilityCondition | MultiVisibilityCondition;
  validation?: ValidationRule[];
  allocationConfig?: AllocationConfig;
}

// ── Conditions (visibility & group validation) ────────────────────────────────

export interface VisibilityCondition {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'min_items' | 'max_items';
  value: string | number | boolean | string[];
  ref_field?: string | null;
}

export interface MultiVisibilityCondition {
  /** Uppercase to match JSON schema exactly — normalised in evaluateVisibility */
  operator: 'AND' | 'OR' | 'NOT';
  conditions: (VisibilityCondition | MultiVisibilityCondition)[];
}

/** Union type matching the spec's ConditionExpression oneOf */
export type ConditionExpression = VisibilityCondition | MultiVisibilityCondition;

// ── Validation rules ──────────────────────────────────────────────────────────

export interface ValidationRule {
  type:
    | 'required'
    | 'min'
    | 'max'
    | 'min_length'
    | 'max_length'
    | 'pattern'
    | 'min_date'
    | 'max_date'
    | 'equals'
    | 'equals_today'
    | 'cross_field'
    | 'allocation_sum'
    | 'async';
  value?: string | number | boolean;
  description?: string | null;
  // cross_field fields
  field?: string;
  op?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
  ref_field?: string;
  // async fields
  serviceKey?: string;
}

export interface GroupValidationRule {
  type: 'group_sum';
  questionId: string;
  field: string;
  filterField?: string | null;
  filterValue?: string | number | boolean | null;
  operator: 'eq' | 'gte' | 'lte';
  value: number;
  condition?: ConditionExpression | null;
  description?: string | null;
}

// ── Page repeat ───────────────────────────────────────────────────────────────

export interface PageRepeatConfig {
  /** Question ID whose integer answer determines repeat count */
  sourceField: string;
  minRepeat: number;
  maxRepeat: number;
  /** Template with #{index} and #{total} interpolation tokens */
  titleTemplate: string;
}

// ── Disclosures ───────────────────────────────────────────────────────────────

export interface DisclosureContent {
  /** Delivery format — markdown and html are rendered inline; url opens externally */
  type: 'markdown' | 'html' | 'url';
  body: string;
}

export interface DisclosureAcknowledgment {
  /** Key under which acknowledgment is stored in AnswerMap */
  questionId: string;
  type: 'boolean' | 'signature';
  label: string;
  hint: string;
  required: boolean;
}

export interface Disclosure {
  id: string;
  title: string;
  description?: string | null;
  content: DisclosureContent;
  /** Whether full content must be presented before acknowledgment is enabled */
  viewRequired: boolean;
  visibility?: ConditionExpression | null;
  acknowledgment: DisclosureAcknowledgment;
}

// ── Field sync ────────────────────────────────────────────────────────────────

export interface FieldSyncGroup {
  id: string;
  description?: string | null;
  /** Question IDs to keep in sync (minimum 2) */
  fields: string[];
  behavior: 'pre_fill_warn';
  overrideWarning?: string | null;
  condition?: ConditionExpression | null;
}

// ── Pages & Application ───────────────────────────────────────────────────────

export interface PageDefinition {
  id: string;
  title: string;
  order?: number;
  pageType?: 'standard' | 'disclosure';
  description: string | null;
  questions: QuestionDefinition[];
  visibility: null | ConditionExpression;
  pageRepeat?: PageRepeatConfig | null;
  disclosures?: Disclosure[] | null;
  groupValidations?: GroupValidationRule[];
}

export interface ApplicationDefinition {
  id: string;
  version: string;
  carrier: string;
  productName: string;
  productId: string;
  effectiveDate?: string;
  locale?: string;
  description: string;
  productType?: string;
  distributors?: string[];
  createdAt?: string;
  updatedAt?: string;
  pages: PageDefinition[];
  fieldSyncs?: FieldSyncGroup[];
}

/** Flat map of question IDs to their answer values.
 *  Supports scalars, repeatable group arrays, and repeating page arrays. */
export type AnswerMap = Record<string, string | number | boolean | null | unknown[]>;
