import { createContext, useContext, useMemo, useState } from 'react';
import { APPLICATION_DEFINITION, type PageDefinition, type QuestionDefinition } from './applicationDefinition';

type GroupItemValue = Record<string, string | boolean>;
type AnswerValue = string | boolean | GroupItemValue[];

type FormValues = Record<string, AnswerValue>;

type FormErrors = Record<string, string>;

interface WizardV2Controller {
  values: FormValues;
  errors: FormErrors;
  pages: PageDefinition[];
  setValue: (questionId: string, value: AnswerValue) => void;
  validatePage: (page: PageDefinition) => boolean;
  populateWithDummyData: () => void;
}

const WizardV2Context = createContext<WizardV2Controller | undefined>(undefined);

function getInitialValues(questions: QuestionDefinition[]): FormValues {
  return questions.reduce<FormValues>((acc, question) => {
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

function findOptionValue(question: QuestionDefinition, candidates: string[]) {
  if (!question.options?.length) return null;

  const option = question.options.find((item) => {
    const value = item.value.toLowerCase();
    const label = item.label.toLowerCase();
    return candidates.some((candidate) => value.includes(candidate) || label.includes(candidate));
  });

  return option?.value ?? question.options[0].value;
}

function createDummyValue(question: QuestionDefinition): AnswerValue {
  const id = question.id.toLowerCase();

  if (question.type === 'boolean') {
    if (id.includes('same_as') || id.includes('address_same')) return false;
    if (id.includes('has_joint')) return true;
    if (id.includes('has_existing_insurance')) return true;
    if (id.includes('is_replacement')) return false;
    if (id.includes('acknowledged') || id.includes('certification')) return true;
    return true;
  }

  if (question.type === 'select' || question.type === 'radio' || question.type === 'multi_select') {
    if (id.includes('gender')) return findOptionValue(question, ['female', 'male']) ?? '';
    if (id.includes('citizen')) return findOptionValue(question, ['yes']) ?? '';
    if (id.includes('citizenship_status')) return findOptionValue(question, ['us', 'citizen']) ?? '';
    if (id.includes('tax_status')) return findOptionValue(question, ['ira', 'qualified']) ?? '';
    if (id.includes('owner_type')) return findOptionValue(question, ['individual', 'natural']) ?? '';
    if (id.includes('id_type')) return findOptionValue(question, ['driver', 'license', 'state']) ?? '';
    if (id.includes('state')) return findOptionValue(question, ['ca', 'california']) ?? '';
    if (id.includes('country')) return findOptionValue(question, ['us', 'united']) ?? '';
    if (id.includes('plan_type')) return findOptionValue(question, ['ira', 'qualified']) ?? '';
    if (id.includes('product_type')) return findOptionValue(question, ['annuity', 'fixed']) ?? '';
    if (id.includes('transfer_scope')) return findOptionValue(question, ['full']) ?? '';
    if (id.includes('partial_amount_type')) return findOptionValue(question, ['dollar', 'amount']) ?? '';
    if (id.includes('transfer_timing')) return findOptionValue(question, ['asap', 'immediate', 'next']) ?? '';
    if (id.includes('backup_withholding')) return findOptionValue(question, ['no']) ?? '';
    if (id.includes('funding_methods')) return findOptionValue(question, ['check', 'transfer']) ?? '';
    return question.options?.[0]?.value ?? '';
  }

  if (question.type === 'date') {
    const today = new Date().toISOString().slice(0, 10);
    if (id.includes('signature_date') || id === 'date_signed') return today;
    if (id.includes('expiration')) return '2030-12-31';
    if (id.includes('trust_date')) return '2015-06-15';
    if (id.includes('joint_annuitant_dob')) return '1982-11-03';
    if (id.includes('joint_owner_dob')) return '1982-11-03';
    if (id.includes('owner_dob')) return '1978-05-18';
    if (id.includes('dob')) return '1978-05-18';
    return '2025-01-15';
  }

  if (question.type === 'email') {
    if (id.includes('joint_owner')) return 'sam.patel@example.com';
    if (id.includes('owner')) return 'alex.patel@example.com';
    return 'client@example.com';
  }

  if (question.type === 'phone') {
    if (id.includes('fax')) return '5155551122';
    if (id.includes('joint_annuitant')) return '5155550199';
    if (id.includes('joint_owner')) return '5155550199';
    if (id.includes('owner')) return '5155550188';
    return '5155550188';
  }

  if (question.type === 'ssn') {
    if (id.includes('joint_annuitant')) return '234-56-7890';
    if (id.includes('joint')) return '234-56-7890';
    if (id.includes('owner')) return '345-67-8901';
    return '123-45-6789';
  }

  if (question.type === 'currency') {
    if (id.includes('check_amount')) return '25000';
    if (id.includes('direct_transfer_amount')) return '50000';
    if (id.includes('exchange_1035_amount')) return '60000';
    if (id.includes('qualified_rollover_amount')) return '30000';
    if (id.includes('salary_reduction_amount')) return '12000';
    if (id.includes('estimated_transfer_amount')) return '85000';
    if (id.includes('partial_dollar_amount')) return '10000';
    return '100000';
  }

  if (question.type === 'number') {
    if (id.includes('years_employed')) return '12';
    if (id.includes('transfer_count')) return '1';
    if (id.includes('percentage')) return '100';
    return '1';
  }

  if (question.type === 'signature') return 'sig_token_alex_patel';
  if (question.type === 'allocation_table') return '100';
  if (question.type === 'repeatable_group') {
    const fields = question.groupConfig?.fields ?? [];
    const item = fields.reduce<GroupItemValue>((acc, field) => {
      const value = createDummyValue(field);
      if (typeof value === 'string' || typeof value === 'boolean') {
        acc[field.id] = value;
      } else {
        acc[field.id] = '';
      }
      return acc;
    }, {});
    return [item];
  }

  if (id.includes('joint_annuitant_first_name')) return 'Sam';
  if (id.includes('joint_annuitant_middle_initial')) return 'K';
  if (id.includes('joint_annuitant_last_name')) return 'Rivera';
  if (id.includes('joint_owner_first_name')) return 'Sam';
  if (id.includes('joint_owner_middle_initial')) return 'K';
  if (id.includes('joint_owner_last_name')) return 'Rivera';
  if (id.includes('owner_first_name')) return 'Alex';
  if (id.includes('owner_middle_initial')) return 'R';
  if (id.includes('owner_last_name')) return 'Patel';
  if (id.includes('first_name')) return 'Alex';
  if (id.includes('middle_initial')) return 'R';
  if (id.includes('last_name')) return 'Patel';
  if (id.includes('street_address') || id.includes('address_1')) return '4100 Market St';
  if (id.includes('address_2')) return 'Suite 200';
  if (id.includes('city')) return 'Des Moines';
  if (id.includes('state')) return 'CA';
  if (id.includes('zip')) return '50309';
  if (id.includes('occupation')) return 'Operations Manager';
  if (id.includes('employer_name')) return 'Heartland Logistics';
  if (id.includes('trust_name')) return 'Patel Family Trust';
  if (id.includes('id_number')) return 'D1234567';
  if (id.includes('contract_number')) return 'MN-FA-2026-00091';
  if (id.includes('dtcc')) return '1234';
  if (id.includes('account_number')) return 'ACC-90871234';
  if (id.includes('company_name') || id.includes('carrier')) return 'Midland National';
  if (id.includes('plan_type')) return 'Traditional IRA';
  if (id.includes('product_type')) return 'Fixed Annuity';
  if (id.includes('title')) return 'HR Director';
  if (id.includes('signed_at_city')) return 'Des Moines';
  if (id.includes('signed_at_state')) return 'IA';

  return 'Sample value';
}

function isEmptyValue(value: AnswerValue) {
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.length === 0;

  return !value.trim();
}

function getValidationMessage(question: QuestionDefinition, value: AnswerValue): string | null {
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
  children: React.ReactNode;
}

export function WizardV2FormProvider({ children }: WizardV2FormProviderProps) {
  const pages = APPLICATION_DEFINITION.pages;
  const allQuestions = pages.flatMap((page) => page.questions);

  const [values, setValues] = useState<FormValues>(() => getInitialValues(allQuestions));
  const [errors, setErrors] = useState<FormErrors>({});

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

  const populateWithDummyData = () => {
    const dummyValues = allQuestions.reduce<FormValues>((acc, question) => {
      acc[question.id] = createDummyValue(question);
      return acc;
    }, {});
    setValues((prev) => ({ ...prev, ...dummyValues }));
    setErrors({});
  };

  const validatePage = (page: PageDefinition) => {
    const nextErrors = page.questions.reduce<FormErrors>((acc, question) => {
      const value = values[question.id];
      const message = getValidationMessage(question, value);
      if (message) {
        acc[question.id] = message;
      }
      return acc;
    }, {});

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const controller = useMemo<WizardV2Controller>(
    () => ({
      values,
      errors,
      pages,
      setValue,
      validatePage,
      populateWithDummyData,
    }),
    [errors, pages, values],
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
