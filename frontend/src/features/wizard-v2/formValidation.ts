import type { PageDefinition, QuestionDefinition, ValidationRule } from '../../types/application';
import { evaluateVisibility } from './visibility';

export type GroupItemValue = Record<string, string | boolean>;
export type AnswerValue = string | boolean | GroupItemValue[];
export type FormValues = Record<string, AnswerValue>;
export type FormErrors = Record<string, string>;

function isEmptyValue(value: AnswerValue | undefined) {
  if (value === undefined) return true;
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.length === 0;

  return !value.trim();
}

function asString(value: AnswerValue | undefined) {
  return typeof value === 'string' ? value : '';
}

function parseDateValue(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getRuleMessage(rule: ValidationRule): string {
  return rule.description?.trim() || 'Invalid value';
}

function valuesEqual(
  left: string | boolean | number,
  right: string | boolean | number,
) {
  if (typeof left === 'number' || typeof right === 'number') {
    const leftNum = Number(left);
    const rightNum = Number(right);
    if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum)) {
      return leftNum === rightNum;
    }
  }

  return String(left) === String(right);
}

function resolveRuleTargetValue(
  rule: ValidationRule,
  pageValues: FormValues,
  groupItem?: GroupItemValue,
): string | boolean | number | null {
  if (rule.value !== undefined && typeof rule.value !== 'object') {
    return rule.value;
  }

  const ref = rule.ref_field || rule.field;
  if (!ref) return null;

  if (groupItem && ref in groupItem) {
    const itemValue = groupItem[ref];
    if (typeof itemValue === 'string' || typeof itemValue === 'boolean') {
      return itemValue;
    }
  }

  const pageValue = pageValues[ref];
  if (typeof pageValue === 'string' || typeof pageValue === 'boolean') {
    return pageValue;
  }

  return null;
}

function validateRule(
  rule: ValidationRule,
  question: QuestionDefinition,
  value: AnswerValue | undefined,
  pageValues: FormValues,
  groupItem?: GroupItemValue,
): string | null {
  const textValue = asString(value);
  const trimmedValue = textValue.trim();

  switch (rule.type) {
    case 'required': {
      if (question.type === 'boolean') return null;
      return isEmptyValue(value) ? getRuleMessage(rule) : null;
    }
    case 'min_length': {
      if (!trimmedValue) return null;
      const minLength = typeof rule.value === 'number' ? rule.value : Number(rule.value);
      if (Number.isNaN(minLength)) return null;
      return trimmedValue.length < minLength ? getRuleMessage(rule) : null;
    }
    case 'max_length': {
      if (!trimmedValue) return null;
      const maxLength = typeof rule.value === 'number' ? rule.value : Number(rule.value);
      if (Number.isNaN(maxLength)) return null;
      return trimmedValue.length > maxLength ? getRuleMessage(rule) : null;
    }
    case 'pattern': {
      if (!trimmedValue) return null;
      if (typeof rule.value !== 'string' || !rule.value) return null;
      try {
        const regex = new RegExp(rule.value);
        return regex.test(trimmedValue) ? null : getRuleMessage(rule);
      } catch {
        return null;
      }
    }
    case 'min': {
      if (!trimmedValue) return null;
      const minValue = typeof rule.value === 'number' ? rule.value : Number(rule.value);
      const actual = Number(trimmedValue);
      if (Number.isNaN(minValue) || Number.isNaN(actual)) return null;
      return actual < minValue ? getRuleMessage(rule) : null;
    }
    case 'max': {
      if (!trimmedValue) return null;
      const maxValue = typeof rule.value === 'number' ? rule.value : Number(rule.value);
      const actual = Number(trimmedValue);
      if (Number.isNaN(maxValue) || Number.isNaN(actual)) return null;
      return actual > maxValue ? getRuleMessage(rule) : null;
    }
    case 'min_date': {
      if (!trimmedValue || typeof rule.value !== 'string') return null;
      const actual = parseDateValue(trimmedValue);
      const minDate = parseDateValue(rule.value);
      if (actual === null || minDate === null) return null;
      return actual < minDate ? getRuleMessage(rule) : null;
    }
    case 'max_date': {
      if (!trimmedValue || typeof rule.value !== 'string') return null;
      const actual = parseDateValue(trimmedValue);
      const maxDate = parseDateValue(rule.value);
      if (actual === null || maxDate === null) return null;
      return actual > maxDate ? getRuleMessage(rule) : null;
    }
    case 'equals': {
      if (!trimmedValue) return null;
      const target = resolveRuleTargetValue(rule, pageValues, groupItem);
      if (target === null) return null;
      return valuesEqual(trimmedValue, target) ? null : getRuleMessage(rule);
    }
    case 'equals_today': {
      if (!trimmedValue) return null;
      const today = new Date().toISOString().slice(0, 10);
      return trimmedValue === today ? null : getRuleMessage(rule);
    }
    case 'async':
      return null;
    default:
      return null;
  }
}

export function getValidationMessage(
  question: QuestionDefinition,
  value: AnswerValue | undefined,
  pageValues: FormValues,
): string | null {
  if (question.type === 'allocation_table') {
    const allocations = Array.isArray(value) ? value : [];

    if (question.required && allocations.length === 0) {
      return 'Add at least one allocation';
    }

    if (allocations.length === 0) {
      return null;
    }

    const invalidRow = allocations.some((item) => {
      const fundId = item.fundId;
      const percentage = item.percentage;
      return (
        typeof fundId !== 'string'
        || !fundId.trim()
        || typeof percentage !== 'string'
        || !percentage.trim()
        || Number.isNaN(Number(percentage))
      );
    });

    if (invalidRow) {
      return 'Choose a fund and enter a valid percentage for each allocation';
    }

    const total = allocations.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
    const requiredTotal = question.allocationConfig?.totalRequired ?? 100;
    if (total !== requiredTotal) {
      return `Allocations must total ${requiredTotal}% (current total: ${total}%)`;
    }

    return null;
  }

  if (question.type === 'repeatable_group' && question.groupConfig) {
    const items = Array.isArray(value) ? value : [];
    const minItems = Math.max(1, question.groupConfig.minItems);
    if (items.length < minItems) {
      return `Add at least ${minItems} item${minItems > 1 ? 's' : ''}`;
    }

    const missingRequired = items.some((item) =>
      question.groupConfig!.fields.some((field) => {
        if (!field.required || field.type === 'boolean') return false;
        const fieldValue = item[field.id];
        return typeof fieldValue !== 'string' || !fieldValue.trim();
      }),
    );

    if (missingRequired) {
      return 'Complete all required fields in each item';
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      for (const field of question.groupConfig.fields) {
        const fieldValue = item[field.id];
        const fieldRules = field.validation ?? [];
        for (const rule of fieldRules) {
          const message = validateRule(rule, field, fieldValue, pageValues, item);
          if (message) {
            return `${question.label} #${itemIndex + 1}: ${message}`;
          }
        }
      }
    }
  }

  if (question.required && question.type !== 'boolean' && isEmptyValue(value)) {
    return 'This field is required';
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  if (question.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Enter a valid email address';
  }

  if (question.type === 'phone' && value.replace(/\D/g, '').length < 10) {
    return 'Enter a valid phone number';
  }

  if ((question.type === 'number' || question.type === 'currency') && Number.isNaN(Number(value))) {
    return 'Enter a numeric value';
  }

  if (question.type === 'number' && question.min !== undefined && Number(value) < question.min) {
    return `Value must be at least ${question.min}`;
  }

  if (question.type === 'number' && question.max !== undefined && Number(value) > question.max) {
    return `Value must be ${question.max} or less`;
  }

  const rules = question.validation ?? [];
  for (const rule of rules) {
    const message = validateRule(rule, question, value, pageValues);
    if (message) {
      return message;
    }
  }

  return null;
}

export function getPageErrors(page: PageDefinition, values: FormValues): FormErrors {
  return page.questions.reduce<FormErrors>((acc, question) => {
    if (!evaluateVisibility(question.visibility, values)) return acc;
    const value = values[question.id];
    const message = getValidationMessage(question, value, values);
    if (message) {
      acc[question.id] = message;
    }
    return acc;
  }, {});
}
