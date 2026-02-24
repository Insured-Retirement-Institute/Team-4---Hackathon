const { parseRelativeDate, startOfDay, todayISO } = require('../utils/dateUtils');

/**
 * Main entry: validate answers against a product definition.
 * @param {object} product - The full application definition
 * @param {object} answers - The answer map
 * @param {string} scope - "full" or "page"
 * @param {string|null} pageId - Required when scope === "page"
 * @returns {{ valid: boolean, errors: Array }}
 */
function validate(product, answers, scope = 'full', pageId = null) {
  const errors = [];
  const pages = product.pages || [];

  for (const page of pages) {
    if (scope === 'page' && page.id !== pageId) continue;

    // Check page visibility
    if (!evaluateVisibility(page.visibility, answers)) continue;

    if (page.pageRepeat) {
      // Repeating page — answers stored as array under page.id
      const instances = answers[page.id];
      if (!Array.isArray(instances)) {
        // Determine expected count from sourceField
        const count = Number(answers[page.pageRepeat.sourceField]) || 0;
        for (let i = 0; i < count; i++) {
          // Missing instance — report required errors for all required questions
          validatePageQuestions(page, {}, answers, errors, i);
        }
        continue;
      }
      for (let i = 0; i < instances.length; i++) {
        const instanceAnswers = instances[i] || {};
        // Merge instance answers into a view for cross-page condition evaluation
        const mergedForConditions = { ...answers, ...instanceAnswers };
        validatePageQuestions(page, instanceAnswers, mergedForConditions, errors, i);
      }
    } else {
      validatePageQuestions(page, answers, answers, errors, null);
      // Page-level group validations
      validateGroupRules(page, answers, errors, null);
    }

    // Disclosures
    if (page.disclosures && Array.isArray(page.disclosures)) {
      for (const disc of page.disclosures) {
        if (!evaluateVisibility(disc.visibility, answers)) continue;
        const ack = disc.acknowledgment;
        if (ack && ack.required) {
          const val = answers[ack.questionId];
          if (val === undefined || val === null || val === '' || val === false) {
            errors.push({
              questionId: ack.questionId,
              pageRepeatIndex: null,
              groupIndex: null,
              groupFieldId: null,
              filterField: null,
              filterValue: null,
              type: 'required',
              message: ack.label || `${ack.questionId} is required`
            });
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate all questions on a page (or page instance).
 */
function validatePageQuestions(page, localAnswers, globalAnswers, errors, pageRepeatIndex) {
  const questions = page.questions || [];

  for (const question of questions) {
    // Check question visibility using global answers (includes local for repeat pages)
    const conditionContext = pageRepeatIndex !== null ? globalAnswers : localAnswers;
    if (!evaluateVisibility(question.visibility, conditionContext)) continue;

    const answer = localAnswers[question.id];

    if (question.type === 'repeatable_group' && question.groupConfig) {
      validateRepeatableGroup(question, answer, errors, pageRepeatIndex);
    } else if (question.type === 'allocation_table' && question.allocationConfig) {
      validateAllocations(question, answer, errors, pageRepeatIndex);
    } else {
      validateQuestionRules(question, answer, localAnswers, errors, pageRepeatIndex);
    }
  }

  // Group validations (only for non-repeat pages; repeat pages handled differently)
  if (pageRepeatIndex === null) {
    validateGroupRules(page, localAnswers, errors, null);
  }
}

/**
 * Validate a single question's validation rules.
 */
function validateQuestionRules(question, answer, allAnswers, errors, pageRepeatIndex) {
  const rules = question.validation || [];

  for (const rule of rules) {
    const err = evaluateRule(rule, answer, question, allAnswers);
    if (err) {
      errors.push({
        questionId: question.id,
        pageRepeatIndex: pageRepeatIndex,
        groupIndex: null,
        groupFieldId: null,
        filterField: null,
        filterValue: null,
        type: rule.type,
        message: err
      });
    }
  }
}

/**
 * Validate a repeatable_group question — iterate each item and validate fields.
 */
function validateRepeatableGroup(question, answer, errors, pageRepeatIndex) {
  const config = question.groupConfig;
  const items = Array.isArray(answer) ? answer : [];

  // Check minItems
  if (question.required && config.minItems > 0 && items.length < config.minItems) {
    errors.push({
      questionId: question.id,
      pageRepeatIndex,
      groupIndex: null,
      groupFieldId: null,
      filterField: null,
      filterValue: null,
      type: 'required',
      message: question.validation?.find(r => r.type === 'required')?.description
        || `At least ${config.minItems} item(s) required`
    });
  }

  // Validate each item's fields
  for (let gi = 0; gi < items.length; gi++) {
    const item = items[gi] || {};
    for (const field of config.fields) {
      const fieldAnswer = item[field.id];
      const fieldRules = field.validation || [];

      // If field is required, inject a required rule check
      if (field.required && !fieldRules.some(r => r.type === 'required')) {
        const reqErr = evaluateRule({ type: 'required' }, fieldAnswer, field, item);
        if (reqErr) {
          errors.push({
            questionId: question.id,
            pageRepeatIndex,
            groupIndex: gi,
            groupFieldId: field.id,
            filterField: null,
            filterValue: null,
            type: 'required',
            message: reqErr
          });
        }
      }

      for (const rule of fieldRules) {
        const err = evaluateRule(rule, fieldAnswer, field, item);
        if (err) {
          errors.push({
            questionId: question.id,
            pageRepeatIndex,
            groupIndex: gi,
            groupFieldId: field.id,
            filterField: null,
            filterValue: null,
            type: rule.type,
            message: err
          });
        }
      }
    }
  }
}

/**
 * Validate allocation_table question.
 */
function validateAllocations(question, answer, errors, pageRepeatIndex) {
  const rules = question.validation || [];

  // Check required
  for (const rule of rules) {
    if (rule.type === 'required') {
      if (!answer || !Array.isArray(answer) || answer.length === 0) {
        errors.push({
          questionId: question.id,
          pageRepeatIndex,
          groupIndex: null,
          groupFieldId: null,
          filterField: null,
          filterValue: null,
          type: 'required',
          message: rule.description || `${question.label || question.id} is required`
        });
        return; // No point checking sum if nothing provided
      }
    }

    if (rule.type === 'allocation_sum') {
      if (Array.isArray(answer)) {
        const total = answer.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0);
        if (total !== rule.value) {
          errors.push({
            questionId: question.id,
            pageRepeatIndex,
            groupIndex: null,
            groupFieldId: null,
            filterField: null,
            filterValue: null,
            type: 'allocation_sum',
            message: rule.description || `Total allocation must equal ${rule.value}% (current total: ${total}%)`
          });
        }
      }
    }
  }
}

/**
 * Validate page-level groupValidations (group_sum).
 */
function validateGroupRules(page, answers, errors, pageRepeatIndex) {
  const groupRules = page.groupValidations || [];

  for (const rule of groupRules) {
    // Check optional condition
    if (rule.condition && !evaluateCondition(rule.condition, answers)) continue;

    if (rule.type === 'group_sum') {
      const groupAnswer = answers[rule.questionId];
      if (!Array.isArray(groupAnswer)) continue;

      let items = groupAnswer;
      if (rule.filterField) {
        items = items.filter(item => item[rule.filterField] === rule.filterValue);
      }

      // If filtered set is empty, skip (no items to validate)
      if (items.length === 0) continue;

      const sum = items.reduce((s, item) => s + (Number(item[rule.field]) || 0), 0);
      let failed = false;

      switch (rule.operator) {
        case 'eq':  failed = sum !== rule.value; break;
        case 'gte': failed = sum < rule.value; break;
        case 'lte': failed = sum > rule.value; break;
      }

      if (failed) {
        errors.push({
          questionId: rule.questionId,
          pageRepeatIndex,
          groupIndex: null,
          groupFieldId: null,
          filterField: rule.filterField || null,
          filterValue: rule.filterValue !== undefined ? rule.filterValue : null,
          type: 'group_sum',
          message: rule.description || `Group sum must ${rule.operator} ${rule.value} (current total: ${sum})`
        });
      }
    }
  }
}

/**
 * Evaluate a single validation rule against an answer.
 * Returns an error message string, or null if valid.
 */
function evaluateRule(rule, answer, question, allAnswers) {
  switch (rule.type) {
    case 'required':
      if (!isPresent(answer)) {
        return rule.description || `${question.label || question.id} is required`;
      }
      return null;

    case 'min': {
      if (!isPresent(answer)) return null; // skip if empty (required handles that)
      const num = Number(answer);
      if (isNaN(num) || num < rule.value) {
        return rule.description || `Must be at least ${rule.value}`;
      }
      return null;
    }

    case 'max': {
      if (!isPresent(answer)) return null;
      const num = Number(answer);
      if (isNaN(num) || num > rule.value) {
        return rule.description || `Must be at most ${rule.value}`;
      }
      return null;
    }

    case 'min_length': {
      if (!isPresent(answer)) return null;
      const str = String(answer);
      if (str.length < rule.value) {
        return rule.description || `Must be at least ${rule.value} characters`;
      }
      return null;
    }

    case 'max_length': {
      if (!isPresent(answer)) return null;
      const str = String(answer);
      if (str.length > rule.value) {
        return rule.description || `Must be at most ${rule.value} characters`;
      }
      return null;
    }

    case 'pattern': {
      if (!isPresent(answer)) return null;
      const str = String(answer);
      try {
        const re = new RegExp(rule.value);
        if (!re.test(str)) {
          return rule.description || `Does not match required format`;
        }
      } catch (e) {
        return rule.description || `Invalid pattern`;
      }
      return null;
    }

    case 'min_date': {
      if (!isPresent(answer)) return null;
      const answerDate = startOfDay(new Date(answer));
      const minDate = parseRelativeDate(rule.value);
      if (!minDate || isNaN(answerDate.getTime())) return null;
      if (answerDate < minDate) {
        return rule.description || `Date must be on or after ${rule.value}`;
      }
      return null;
    }

    case 'max_date': {
      if (!isPresent(answer)) return null;
      const answerDate = startOfDay(new Date(answer));
      const maxDate = parseRelativeDate(rule.value);
      if (!maxDate || isNaN(answerDate.getTime())) return null;
      if (answerDate > maxDate) {
        return rule.description || `Date must be on or before ${rule.value}`;
      }
      return null;
    }

    case 'equals': {
      if (!isPresent(answer)) return null;
      // Loose comparison to handle string/number/boolean matching
      if (answer != rule.value && answer !== rule.value) {
        return rule.description || `Must equal ${rule.value}`;
      }
      return null;
    }

    case 'equals_today': {
      if (!isPresent(answer)) return null;
      const today = todayISO();
      const ansStr = String(answer).split('T')[0];
      if (ansStr !== today) {
        return rule.description || `Date must be today's date`;
      }
      return null;
    }

    case 'cross_field': {
      const leftVal = allAnswers[rule.field];
      const rightVal = allAnswers[rule.ref_field];
      if (!isPresent(leftVal) || !isPresent(rightVal)) return null;
      if (!compareCrossField(leftVal, rule.op, rightVal)) {
        return rule.description || `${rule.field} must be ${rule.op} ${rule.ref_field}`;
      }
      return null;
    }

    case 'async':
      // Stub — async validation not wired to external services yet
      return null;

    case 'allocation_sum':
      // Handled separately in validateAllocations
      return null;

    default:
      return null;
  }
}

function compareCrossField(left, op, right) {
  // Try numeric comparison first
  const lNum = Number(left);
  const rNum = Number(right);
  const useNumeric = !isNaN(lNum) && !isNaN(rNum);

  const l = useNumeric ? lNum : left;
  const r = useNumeric ? rNum : right;

  switch (op) {
    case 'eq':  return l === r;
    case 'neq': return l !== r;
    case 'gt':  return l > r;
    case 'gte': return l >= r;
    case 'lt':  return l < r;
    case 'lte': return l <= r;
    default:    return true;
  }
}

/**
 * Check if a value is considered "present" (non-null, non-empty).
 */
function isPresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Evaluate a visibility condition. Returns true if visible (null = always visible).
 */
function evaluateVisibility(condition, answers) {
  if (condition === null || condition === undefined) return true;
  return evaluateCondition(condition, answers);
}

/**
 * Recursively evaluate a ConditionExpression (leaf or compound).
 */
function evaluateCondition(condition, answers) {
  if (!condition) return true;

  // Compound condition
  if (condition.operator && condition.conditions) {
    const { operator, conditions } = condition;
    switch (operator) {
      case 'AND':
        return conditions.every(c => evaluateCondition(c, answers));
      case 'OR':
        return conditions.some(c => evaluateCondition(c, answers));
      case 'NOT':
        return !evaluateCondition(conditions[0], answers);
      default:
        return true;
    }
  }

  // Leaf condition
  if (condition.field) {
    const fieldValue = answers[condition.field];
    const compareValue = condition.ref_field
      ? answers[condition.ref_field]
      : condition.value;

    return evaluateLeafOp(fieldValue, condition.op, compareValue);
  }

  return true;
}

function evaluateLeafOp(fieldValue, op, compareValue) {
  switch (op) {
    case 'eq':
      return fieldValue == compareValue;
    case 'neq':
      return fieldValue != compareValue;
    case 'gt':
      return Number(fieldValue) > Number(compareValue);
    case 'gte':
      return Number(fieldValue) >= Number(compareValue);
    case 'lt':
      return Number(fieldValue) < Number(compareValue);
    case 'lte':
      return Number(fieldValue) <= Number(compareValue);
    case 'in':
      return Array.isArray(compareValue) && compareValue.includes(fieldValue);
    case 'not_in':
      return Array.isArray(compareValue) && !compareValue.includes(fieldValue);
    case 'contains':
      // multi_select answer (array) contains value, OR allocation_table answer contains fund
      if (Array.isArray(fieldValue)) {
        // For allocation_table, check if any fundId matches
        return fieldValue.some(item =>
          item === compareValue ||
          (typeof item === 'object' && item !== null && item.fundId === compareValue)
        );
      }
      return false;
    case 'min_items':
      return Array.isArray(fieldValue) && fieldValue.length >= Number(compareValue);
    case 'max_items':
      return Array.isArray(fieldValue) && fieldValue.length <= Number(compareValue);
    default:
      return true;
  }
}

module.exports = { validate };
