// Canonical domain types for the annuity application schema.
// Both the static JSON loader (applicationDefinition.ts) and the API service
// (applicationService.ts) import from here — single source of truth.

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

export interface AllocationFund {
  id: string;
  name: string;
  description?: string | null;
  creditingMethod?: string | null;
  index?: string | null;
  termYears?: number | null;
  hasStrategyFee?: boolean;
  strategyFeeAnnualPct?: number | null;
}

export interface AllocationConfig {
  totalRequired?: number;
  minPerFund?: number;
  maxPerFund?: number;
  funds: AllocationFund[];
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
  visibility: null | VisibilityCondition | MultiVisibilityCondition;
  validation?: ValidationRule[];
  allocationConfig?: AllocationConfig;
}

export interface VisibilityCondition {
  field: string;
  op: 'eq' | 'neq' | 'in' | 'contains' | 'gt';
  value: string | number | boolean | string[];
}

export interface MultiVisibilityCondition {
  /** Uppercase to match JSON schema exactly — normalised in evaluateVisibility */
  operator: 'AND' | 'OR';
  conditions: VisibilityCondition[];
}

export interface ValidationRule {
  type: 'required' | 'max_length' | 'min_length' | 'pattern' | 'min' | 'max' | 'min_date' | 'max_date' | 'equals' | 'async';
  value?: string | number;
  description?: string;
  serviceKey?: string;
}

export interface PageDefinition {
  id: string;
  title: string;
  description: string | null;
  questions: QuestionDefinition[];
  visibility: null | VisibilityCondition | MultiVisibilityCondition;
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
  pages: PageDefinition[];
}

/** Flat map of question IDs to their answer values. */
export type AnswerMap = Record<string, string | number | boolean | null>;
