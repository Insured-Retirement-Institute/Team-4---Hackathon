import type { QuestionDefinition } from './applicationDefinition';

type GroupItemValue = Record<string, string | boolean>;
type DummyAnswerValue = string | boolean | GroupItemValue[];

function findOptionValue(question: QuestionDefinition, candidates: string[]) {
  if (!question.options?.length) return null;

  const option = question.options.find((item) => {
    const value = item.value.toLowerCase();
    const label = item.label.toLowerCase();
    return candidates.some((candidate) => value.includes(candidate) || label.includes(candidate));
  });

  return option?.value ?? question.options[0].value;
}

export function createDummyValue(question: QuestionDefinition): DummyAnswerValue {
  // Normalize camelCase IDs (e.g. ownerFirstName) to snake_case (owner_first_name)
  const id = question.id.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  const matches = (keyword: string) => id.includes(keyword);

  if (question.type === 'boolean') {
    if (matches('same_as') || matches('address_same')) return false;
    if (matches('has_joint')) return true;
    if (matches('has_existing_insurance')) return true;
    if (matches('is_replacement')) return false;
    if (matches('acknowledged') || matches('certification')) return true;
    return true;
  }

  if (question.type === 'select' || question.type === 'radio' || question.type === 'multi_select') {
    if (matches('gender')) return findOptionValue(question, ['female', 'male']) ?? '';
    if (matches('citizen')) return findOptionValue(question, ['yes']) ?? '';
    if (matches('citizenship_status')) return findOptionValue(question, ['us', 'citizen']) ?? '';
    if (matches('tax_status')) return findOptionValue(question, ['ira', 'qualified']) ?? '';
    if (matches('owner_type')) return findOptionValue(question, ['individual', 'natural']) ?? '';
    if (matches('id_type')) return findOptionValue(question, ['driver', 'license', 'state']) ?? '';
    if (matches('state')) return findOptionValue(question, ['ia', 'iowa']) ?? '';
    if (matches('country')) return findOptionValue(question, ['us', 'united']) ?? '';
    if (matches('plan_type')) return findOptionValue(question, ['ira', 'qualified']) ?? '';
    if (matches('product_type')) return findOptionValue(question, ['annuity', 'fixed']) ?? '';
    if (matches('transfer_scope')) return findOptionValue(question, ['full']) ?? '';
    if (matches('partial_amount_type')) return findOptionValue(question, ['dollar', 'amount']) ?? '';
    if (matches('transfer_timing')) return findOptionValue(question, ['asap', 'immediate', 'next']) ?? '';
    if (matches('backup_withholding')) return findOptionValue(question, ['no']) ?? '';
    if (matches('funding_methods')) return findOptionValue(question, ['check', 'transfer']) ?? '';
    if (matches('bene_type')) return findOptionValue(question, ['primary']) ?? '';
    if (matches('bene_relationship')) return findOptionValue(question, ['spouse', 'child']) ?? '';
    if (matches('bene_entity_type')) return findOptionValue(question, ['individual', 'person', 'natural']) ?? '';
    if (matches('bene_distribution_method')) return findOptionValue(question, ['per_stirpes', 'equal', 'per']) ?? '';
    return question.options?.[0]?.value ?? '';
  }

  if (question.type === 'date') {
    const today = new Date().toISOString().slice(0, 10);
    if (
      matches('signature_date')
      || matches('date_signed')
      || matches('agent_date_signed')
      || matches('producer_date_signed')
    ) return today;
    if (matches('expiration')) return '2030-12-31';
    if (matches('trust_date')) return '2015-06-15';
    if (matches('joint_annuitant_dob')) return '1968-07-22';
    if (matches('joint_owner_dob')) return '1968-07-22';
    if (matches('bene_dob')) return '1962-09-14';
    if (matches('owner_dob')) return '1965-03-15';
    if (matches('annuitant_dob')) return '1965-03-15';
    if (matches('dob')) return '1965-03-15';
    return '2026-01-15';
  }

  if (question.type === 'email') {
    if (matches('joint_owner')) return 'sam.patel@example.com';
    if (matches('owner')) return 'alex.patel@example.com';
    return 'client@example.com';
  }

  if (question.type === 'phone') {
    if (matches('fax')) return '5155551122';
    if (matches('joint_annuitant')) return '5155550199';
    if (matches('joint_owner')) return '5155550199';
    if (matches('owner')) return '5155550188';
    return '5155550188';
  }

  if (question.type === 'ssn') {
    if (matches('joint_annuitant')) return '234-56-7890';
    if (matches('joint')) return '234-56-7890';
    if (matches('bene_ssn')) return '987-65-4321';
    if (matches('owner')) return '345-67-8901';
    if (matches('annuitant')) return '123-45-6789';
    return '123-45-6789';
  }

  if (question.type === 'currency') {
    if (matches('check_amount')) return '25000';
    if (matches('direct_transfer_amount')) return '50000';
    if (matches('exchange_1035_amount')) return '60000';
    if (matches('qualified_rollover_amount')) return '30000';
    if (matches('salary_reduction_amount')) return '12000';
    if (matches('estimated_transfer_amount')) return '85000';
    if (matches('partial_dollar_amount')) return '10000';
    return '100000';
  }

  if (question.type === 'number') {
    if (matches('years_employed')) return '12';
    if (matches('transfer_count')) return '1';
    if (matches('bene_percentage')) return '100';
    if (matches('percentage')) return '100';
    return '1';
  }

  if (question.type === 'signature') return 'sig_token_alex_patel';
  if (question.type === 'initials') return 'ARP';
  if (question.type === 'file_upload') return '';
  if (question.type === 'allocation_table') {
    const firstFund = question.allocationConfig?.funds?.[0];
    if (!firstFund) return [];
    return [{ fundId: firstFund.id, percentage: String(question.allocationConfig?.totalRequired ?? 100) }];
  }
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
  if (id.includes('joint_annuitant_middle_initial') || id.includes('joint_annuitant_middle_name')) return 'K';
  if (id.includes('joint_annuitant_last_name')) return 'Rivera';
  if (id.includes('joint_owner_first_name')) return 'Sam';
  if (id.includes('joint_owner_middle_initial') || id.includes('joint_owner_middle_name')) return 'K';
  if (id.includes('joint_owner_last_name')) return 'Rivera';
  if (id.includes('bene_first_name')) return 'Jane';
  if (id.includes('bene_middle_initial') || id.includes('bene_middle_name')) return 'E';
  if (id.includes('bene_last_name')) return 'Patel';
  if (id.includes('owner_first_name')) return 'Alex';
  if (id.includes('owner_middle_initial') || id.includes('owner_middle_name')) return 'R';
  if (id.includes('owner_last_name')) return 'Patel';
  if (id.includes('first_name')) return 'Alex';
  if (id.includes('middle_initial') || id.includes('middle_name')) return 'R';
  if (id.includes('last_name')) return 'Patel';
  if (id.includes('surrendering_owner_name')) return 'Alex R Patel';
  if (id.includes('surrendering_annuitant_name')) return 'Alex R Patel';
  if (id.includes('surrendering_joint_owner_name')) return 'Sam K Rivera';
  if (id.includes('surrendering_joint_annuitant_name')) return 'Sam K Rivera';
  if (id.includes('surrendering_company_name')) return 'Lincoln Financial Group';
  if (id.includes('surrendering_account_number')) return 'ANN-9876543';
  if (id.includes('street_address') || id.includes('address_1')) return '4100 Market St';
  if (id.includes('address_2')) return 'Suite 200';
  if (id.includes('city')) return 'Des Moines';
  if (id.includes('state')) return 'IA';
  if (id.includes('zip')) return '50309';
  if (id.includes('occupation')) return 'Operations Manager';
  if (id.includes('employer_name')) return 'Heartland Logistics';
  if (id.includes('trust_name')) return 'Patel Family Trust';
  if (id.includes('id_number')) return 'D1234567';
  if (id.includes('contract_number')) return 'MN-FA-2026-00091';
  if (id.includes('dtcc')) return '1234';
  if (id.includes('account_number')) return 'ACC-90871234';
  if (id === 'surrendering_phone_ext') return '1234';
  if (id === 'agent_replacement_company') return 'Midland National';
  if (id.includes('company_name') || id.includes('carrier')) return 'Midland National';
  if (id.includes('plan_type')) return 'Traditional IRA';
  if (id.includes('product_type')) return 'Fixed Annuity';
  if (id.includes('title')) return 'HR Director';
  if (id.includes('signed_at_city')) return 'Des Moines';
  if (id.includes('signed_at_state')) return 'IA';
  if (id.includes('owner_id_country')) return 'United States';
  if (id.includes('owner_country_of_citizenship')) return 'U.S.A.';
  if (id.includes('owner_years_employed')) return '5';

  return 'Sample value';
}
