import type { ConditionExpression } from '../../types/application';

type VisibilitySpec = null | undefined | ConditionExpression;
type FormValues = Record<string, unknown>;

export function evaluateVisibility(_visibility: VisibilitySpec, _values: FormValues): boolean {
  return true;
}
