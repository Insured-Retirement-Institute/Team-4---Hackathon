export interface WizardStep {
  id: number;
  label: string;
  sublabel?: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: 1, label: 'Personal Details', sublabel: 'Applicant info (1/2)' },
  { id: 2, label: 'Beneficiary', sublabel: 'Primary & contingent' },
  { id: 3, label: 'Financial Profile', sublabel: 'Income & net worth' },
  { id: 4, label: 'Annuity Selection', sublabel: 'Product & term' },
  { id: 5, label: 'Payment Setup', sublabel: 'Funding method' },
  { id: 6, label: 'Suitability Review', sublabel: 'Risk & objectives' },
  { id: 7, label: 'Review & Submit', sublabel: 'Confirm application' },
];
