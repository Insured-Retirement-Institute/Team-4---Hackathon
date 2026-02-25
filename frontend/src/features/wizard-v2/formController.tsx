import { createContext, useContext, useMemo, useState } from 'react';
import type { ApplicationDefinition, PageDefinition, QuestionDefinition } from '../../types/application';
import { createDummyValue } from './createDummyValue';

type GroupItemValue = Record<string, string | boolean>;
type AnswerValue = string | boolean | GroupItemValue[];

type FormValues = Record<string, AnswerValue>;

type FormErrors = Record<string, string>;

interface WizardV2Controller {
  definition: ApplicationDefinition;
  values: FormValues;
  errors: FormErrors;
  pages: PageDefinition[];
  setValue: (questionId: string, value: AnswerValue) => void;
  bulkSetValues: (fields: Record<string, AnswerValue>) => void;
  validatePage: (page: PageDefinition) => boolean;
  isPageComplete: (page: PageDefinition) => boolean;
  populateWithDummyData: () => void;
}

const WizardV2Context = createContext<WizardV2Controller | undefined>(undefined);

function getInitialValues(questions: QuestionDefinition[]): FormValues {
  return questions.reduce<FormValues>((acc, question) => {
    if (question.type === 'allocation_table') {
      acc[question.id] = [];
      return acc;
    }

    if (question.type === 'repeatable_group' && question.groupConfig) {
      const initialItemsCount = Math.max(1, question.groupConfig.minItems);
      acc[question.id] = Array.from({ length: initialItemsCount }, () =>
        question.groupConfig!.fields.reduce<GroupItemValue>((item, field) => {
          item[field.id] = field.type === 'boolean' ? false : '';
          return item;
        }, {}),
      );
      return acc;
    }

    acc[question.id] = question.type === 'boolean' ? false : '';
    return acc;
  }, {});
}

function isEmptyValue(value: AnswerValue) {
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.length === 0;

  return !value.trim();
}

function getValidationMessage(question: QuestionDefinition, value: AnswerValue): string | null {
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

  return null;
}

interface WizardV2FormProviderProps {
  definition: ApplicationDefinition;
  initialValues?: Record<string, unknown>;
  children: React.ReactNode;
}

export function WizardV2FormProvider({ definition, initialValues, children }: WizardV2FormProviderProps) {
  const pages = definition.pages;
  const allQuestions = pages.flatMap((page) => page.questions);

  const [values, setValues] = useState<FormValues>(() => {
    const initial = getInitialValues(allQuestions);
    return initialValues ? { ...initial, ...(initialValues as FormValues) } : initial;
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const getPageErrors = (page: PageDefinition) =>
    page.questions.reduce<FormErrors>((acc, question) => {
      const value = values[question.id];
      const message = getValidationMessage(question, value);
      if (message) {
        acc[question.id] = message;
      }
      return acc;
    }, {});

  const setValue = (questionId: string, value: AnswerValue) => {
    setValues((prev) => ({ ...prev, [questionId]: value }));
    setErrors((prev) => {
      if (!prev[questionId]) {
        return prev;
      }

      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const bulkSetValues = (fields: Record<string, AnswerValue>) => {
    setValues((prev) => ({ ...prev, ...fields }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(fields)) {
        delete next[key];
      }
      return next;
    });
  };

  const populateWithDummyData = () => {
    const dummyValues = allQuestions.reduce<FormValues>((acc, question) => {
      acc[question.id] = createDummyValue(question);
      return acc;
    }, {});
    setValues((prev) => ({ ...prev, ...dummyValues }));
    setErrors({});
  };

  const validatePage = (page: PageDefinition) => {
    const nextErrors = getPageErrors(page);

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const isPageComplete = (page: PageDefinition) => Object.keys(getPageErrors(page)).length === 0;

  const controller = useMemo<WizardV2Controller>(
    () => ({
      definition,
      values,
      errors,
      pages,
      setValue,
      bulkSetValues,
      validatePage,
      isPageComplete,
      populateWithDummyData,
    }),
    [definition, errors, pages, values],
  );

  return <WizardV2Context.Provider value={controller}>{children}</WizardV2Context.Provider>;
}

export function useWizardV2Controller() {
  const context = useContext(WizardV2Context);
  if (!context) {
    throw new Error('useWizardV2Controller must be used within WizardV2FormProvider');
  }
  return context;
}
