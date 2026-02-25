import type { VisibilityCondition, MultiVisibilityCondition } from '../../types/application';

type VisibilitySpec = null | undefined | VisibilityCondition | MultiVisibilityCondition;
type FormValues = Record<string, unknown>;

function evalCondition(cond: VisibilityCondition, values: FormValues): boolean {
  const fieldValue = values[cond.field];

  switch (cond.op) {
    case 'eq':
      return fieldValue === cond.value;

    case 'neq':
      return fieldValue !== cond.value;

    case 'in': {
      const allowed = Array.isArray(cond.value) ? cond.value : [];
      return allowed.includes(String(fieldValue));
    }

    case 'contains': {
      // field is a multi_select array — check if it contains the scalar value
      if (Array.isArray(fieldValue)) return (fieldValue as string[]).includes(String(cond.value));
      // field is a plain string — substring check
      if (typeof fieldValue === 'string') return fieldValue.includes(String(cond.value));
      return false;
    }

    case 'gt':
      return Number(fieldValue) > Number(cond.value);

    default:
      return true;
  }
}

export function evaluateVisibility(visibility: VisibilitySpec, values: FormValues): boolean {
  if (visibility == null) return true;

  if ('conditions' in visibility) {
    const results = visibility.conditions.map((c) => evalCondition(c, values));
    return visibility.operator === 'OR'
      ? results.some(Boolean)
      : results.every(Boolean);
  }

  return evalCondition(visibility, values);
}
