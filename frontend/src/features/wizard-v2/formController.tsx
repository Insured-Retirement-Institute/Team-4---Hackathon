import { createContext, useContext, useMemo, useState } from 'react';
import type { ApplicationDefinition, PageDefinition, QuestionDefinition } from '../../types/application';
import { createDummyValue } from './createDummyValue';
import { getPageErrors, type AnswerValue, type FormErrors, type FormValues, type GroupItemValue } from './formValidation';
import { evaluateVisibility } from './visibility';

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

interface WizardV2FormProviderProps {
  definition: ApplicationDefinition;
  initialValues?: Record<string, unknown>;
  children: React.ReactNode;
}

export function WizardV2FormProvider({ definition, initialValues, children }: WizardV2FormProviderProps) {
  const allQuestions = definition.pages.flatMap((page) => page.questions);

  const [values, setValues] = useState<FormValues>(() => {
    const initial = getInitialValues(allQuestions);
    return initialValues ? { ...initial, ...(initialValues as FormValues) } : initial;
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Only show pages whose visibility condition is satisfied by current values
  const visiblePages = useMemo(
    () => definition.pages.filter((page) => evaluateVisibility(page.visibility, values)),
    [definition.pages, values],
  );

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
    const nextErrors = getPageErrors(page, values);

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const isPageComplete = (page: PageDefinition) => Object.keys(getPageErrors(page, values)).length === 0;

  const controller: WizardV2Controller = {
    definition,
    values,
    errors,
    pages: visiblePages,
    setValue,
    bulkSetValues,
    validatePage,
    isPageComplete,
    populateWithDummyData,
  };

  return <WizardV2Context.Provider value={controller}>{children}</WizardV2Context.Provider>;
}

export function useWizardV2Controller() {
  const context = useContext(WizardV2Context);
  if (!context) {
    throw new Error('useWizardV2Controller must be used within WizardV2FormProvider');
  }
  return context;
}
