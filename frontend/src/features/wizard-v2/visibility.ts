import type { ConditionExpression, VisibilityCondition, MultiVisibilityCondition } from '../../types/application';

type VisibilitySpec = null | undefined | ConditionExpression;
type FormValues = Record<string, unknown>;

function evalCondition(cond: VisibilityCondition, values: FormValues): boolean {
  const fieldValue = values[cond.field];
  // ref_field: compare two field values against each other instead of a literal
  const compareValue = cond.ref_field != null ? values[cond.ref_field] : cond.value;

  switch (cond.op) {
    case 'eq':
      return fieldValue === compareValue;

    case 'neq':
      return fieldValue !== compareValue;

    case 'gt':
      return Number(fieldValue) > Number(compareValue);

    case 'gte':
      return Number(fieldValue) >= Number(compareValue);

    case 'lt':
      return Number(fieldValue) < Number(compareValue);

    case 'lte':
      return Number(fieldValue) <= Number(compareValue);

    case 'in': {
      const allowed = Array.isArray(compareValue) ? compareValue : [];
      return allowed.includes(String(fieldValue));
    }

    case 'not_in': {
      const disallowed = Array.isArray(compareValue) ? compareValue : [];
      return !disallowed.includes(String(fieldValue));
    }

    case 'contains': {
      // field is a multi_select array — check if it includes the scalar value
      if (Array.isArray(fieldValue)) return (fieldValue as string[]).includes(String(compareValue));
      // field is a plain string — substring match
      if (typeof fieldValue === 'string') return fieldValue.includes(String(compareValue));
      return false;
    }

    case 'min_items':
      return Array.isArray(fieldValue) && fieldValue.length >= Number(compareValue);

    case 'max_items':
      return Array.isArray(fieldValue) && fieldValue.length <= Number(compareValue);

    default:
      return true;
  }
}

export function evaluateVisibility(visibility: VisibilitySpec, values: FormValues): boolean {
  if (visibility == null) return true;

  if ('conditions' in visibility) {
    const multi = visibility as MultiVisibilityCondition;
    const results = multi.conditions.map((c) => evaluateVisibility(c, values));

    if (multi.operator === 'OR') return results.some(Boolean);
    if (multi.operator === 'NOT') return !results.every(Boolean);
    // AND (default)
    return results.every(Boolean);
  }

  return evalCondition(visibility as VisibilityCondition, values);
}
