import { createContext, useContext, useMemo, useState } from 'react';

export interface WizardFormValues {
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssn: string;
  maritalStatus: string;
  citizenshipStatus: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  primaryBeneficiaryName: string;
  primaryBeneficiaryRelationship: string;
  primaryBeneficiaryDateOfBirth: string;
  primaryBeneficiaryTaxId: string;
  primaryBeneficiaryPercentage: string;
  contingentBeneficiaryName: string;
  contingentBeneficiaryRelationship: string;
  contingentBeneficiaryDateOfBirth: string;
  contingentBeneficiaryPercentage: string;
  employmentStatus: string;
  annualHouseholdIncome: string;
  sourceOfFunds: string;
  federalTaxBracket: string;
  estimatedNetWorth: string;
  liquidNetWorth: string;
  investmentExperience: string;
  riskTolerance: string;
  annuityType: string;
  surrenderPeriod: string;
  payoutOption: string;
  initialPremiumAmount: string;
  qualificationType: string;
  optionalRider: string;
  fundingMethod: string;
  bankAccountType: string;
  bankName: string;
  bankRoutingNumber: string;
  bankAccountNumber: string;
  transferInstitution: string;
  transferAccountNumber: string;
  transferType: string;
  transferAmount: string;
  primaryObjective: string;
  investmentTimeHorizon: string;
  expectedNeedForFunds: string;
  reactionToMarketLoss: string;
  replacingExistingAnnuity: boolean;
  informedOfSurrenderCharges: boolean;
  understandsSurrenderPeriod: boolean;
  suitabilityNotes: string;
  applicantAcknowledgment: boolean;
}

type WizardFieldName = keyof WizardFormValues;

type WizardFormErrors = Partial<Record<WizardFieldName, string>>;

interface WizardFormController {
  values: WizardFormValues;
  errors: WizardFormErrors;
  setValue: <K extends WizardFieldName>(field: K, value: WizardFormValues[K]) => void;
  validateStep: (step: number) => boolean;
}

const STEP_REQUIRED_FIELDS: Record<number, WizardFieldName[]> = {
  1: ['firstName', 'lastName', 'dateOfBirth', 'ssn', 'email', 'phone', 'address', 'city', 'state', 'zipCode'],
  2: ['primaryBeneficiaryName', 'primaryBeneficiaryRelationship', 'primaryBeneficiaryPercentage'],
  3: ['employmentStatus', 'annualHouseholdIncome', 'sourceOfFunds', 'riskTolerance'],
  4: ['annuityType', 'surrenderPeriod', 'payoutOption', 'initialPremiumAmount', 'qualificationType'],
  5: ['fundingMethod'],
  6: ['primaryObjective', 'investmentTimeHorizon', 'expectedNeedForFunds', 'reactionToMarketLoss', 'applicantAcknowledgment'],
};

const initialValues: WizardFormValues = {
  title: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  ssn: '',
  maritalStatus: '',
  citizenshipStatus: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  primaryBeneficiaryName: '',
  primaryBeneficiaryRelationship: '',
  primaryBeneficiaryDateOfBirth: '',
  primaryBeneficiaryTaxId: '',
  primaryBeneficiaryPercentage: '',
  contingentBeneficiaryName: '',
  contingentBeneficiaryRelationship: '',
  contingentBeneficiaryDateOfBirth: '',
  contingentBeneficiaryPercentage: '',
  employmentStatus: '',
  annualHouseholdIncome: '',
  sourceOfFunds: '',
  federalTaxBracket: '',
  estimatedNetWorth: '',
  liquidNetWorth: '',
  investmentExperience: '',
  riskTolerance: '',
  annuityType: 'fixed_indexed',
  surrenderPeriod: '',
  payoutOption: '',
  initialPremiumAmount: '',
  qualificationType: '',
  optionalRider: '',
  fundingMethod: 'bank_transfer',
  bankAccountType: '',
  bankName: '',
  bankRoutingNumber: '',
  bankAccountNumber: '',
  transferInstitution: '',
  transferAccountNumber: '',
  transferType: '',
  transferAmount: '',
  primaryObjective: '',
  investmentTimeHorizon: '',
  expectedNeedForFunds: '',
  reactionToMarketLoss: '',
  replacingExistingAnnuity: false,
  informedOfSurrenderCharges: false,
  understandsSurrenderPeriod: false,
  suitabilityNotes: '',
  applicantAcknowledgment: false,
};

const WizardFormControllerContext = createContext<WizardFormController | undefined>(undefined);

interface WizardFormProviderProps {
  children: React.ReactNode;
}

export function WizardFormProvider({ children }: WizardFormProviderProps) {
  const [values, setValues] = useState<WizardFormValues>(initialValues);
  const [errors, setErrors] = useState<WizardFormErrors>({});

  const setValue = <K extends WizardFieldName>(field: K, value: WizardFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateStep = (step: number) => {
    const requiredFields = STEP_REQUIRED_FIELDS[step] ?? [];
    if (requiredFields.length === 0) return true;

    const nextErrors: WizardFormErrors = {};
    requiredFields.forEach((field) => {
      const value = values[field];
      if (typeof value === 'boolean' && !value) {
        nextErrors[field] = 'This field is required';
        return;
      }

      if (typeof value !== 'boolean' && !String(value ?? '').trim()) {
        nextErrors[field] = 'This field is required';
      }
    });

    if (step === 5 && values.fundingMethod === 'bank_transfer') {
      ['bankAccountType', 'bankName', 'bankRoutingNumber', 'bankAccountNumber'].forEach((field) => {
        const key = field as WizardFieldName;
        if (!String(values[key]).trim()) {
          nextErrors[key] = 'This field is required';
        }
      });
    }

    if (step === 5 && values.fundingMethod === 'wire') {
      ['transferInstitution', 'transferAccountNumber', 'transferType', 'transferAmount'].forEach((field) => {
        const key = field as WizardFieldName;
        if (!String(values[key]).trim()) {
          nextErrors[key] = 'This field is required';
        }
      });
    }

    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (
      values.primaryBeneficiaryPercentage
      && !/^\d+(\.\d+)?$/.test(values.primaryBeneficiaryPercentage)
    ) {
      nextErrors.primaryBeneficiaryPercentage = 'Enter a numeric percentage';
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const controller = useMemo<WizardFormController>(
    () => ({
      values,
      errors,
      setValue,
      validateStep,
    }),
    [errors, values],
  );

  return <WizardFormControllerContext.Provider value={controller}>{children}</WizardFormControllerContext.Provider>;
}

export function useWizardFormController() {
  const context = useContext(WizardFormControllerContext);
  if (!context) {
    throw new Error('useWizardFormController must be used within WizardFormProvider');
  }
  return context;
}
