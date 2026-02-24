const BASE = '/application';

// ── Shared types ─────────────────────────────────────────────────────────────

/** Flat map of question IDs to their answer values. */
export type AnswerMap = Record<string, string | number | boolean | null>;

// ── GET /application/:productId ───────────────────────────────────────────────

export interface ApplicationDefinition {
  id: string;
  version: string;
  carrier: string;
  productName: string;
  productId: string;
  effectiveDate: string;
  locale: string;
  description: string;
  pages: Page[];
}

export interface Page {
  pageId: string;
  title: string;
  description?: string | null;
  condition?: unknown;
  pageRepeat?: unknown;
  questions: Question[];
}

export interface Question {
  questionId: string;
  type: string;
  label: string;
  hint?: string | null;
  required?: boolean;
  options?: Option[];
  condition?: unknown;
  validation?: unknown[];
  [key: string]: unknown;
}

export interface Option {
  value: string;
  label: string;
}

export async function getApplication(productId: string, locale = 'en-US'): Promise<ApplicationDefinition> {
  const res = await fetch(`${BASE}/${encodeURIComponent(productId)}?locale=${locale}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch application: ${res.status} ${text}`);
  }
  return res.json();
}

// ── POST /application/:applicationId/validate ─────────────────────────────────

export interface ValidationRequest {
  productId: string;
  answers: AnswerMap;
}

export interface ValidationError {
  questionId: string;
  pageRepeatIndex?: number | null;
  groupIndex?: number | null;
  groupFieldId?: string | null;
  filterField?: string | null;
  filterValue?: string | number | boolean | null;
  type: string;
  message: string;
}

export interface ValidationResponse {
  valid: boolean;
  errors: ValidationError[];
}

export type ValidationScope = 'full' | 'page';

export async function validateApplication(
  applicationId: string,
  body: ValidationRequest,
  scope: ValidationScope = 'full',
  pageId?: string,
): Promise<ValidationResponse> {
  const params = new URLSearchParams({ scope });
  if (scope === 'page' && pageId) params.set('pageId', pageId);

  const res = await fetch(`${BASE}/${encodeURIComponent(applicationId)}/validate?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Validation request failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── POST /application/:applicationId/submit ───────────────────────────────────

export type SubmissionSource = 'web' | 'mobile' | 'ai_agent' | 'phone';

export interface SubmissionMetadata {
  submissionSource: SubmissionSource;
  agentId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SubmissionRequest {
  productId: string;
  answers: AnswerMap;
  metadata?: SubmissionMetadata | null;
}

export type SubmissionStatus = 'received' | 'pending_review' | 'approved' | 'declined' | 'requires_information';

export interface SubmissionResponse {
  confirmationNumber: string;
  status: SubmissionStatus;
  submittedAt: string;
  message?: string | null;
}

export async function submitApplication(
  applicationId: string,
  body: SubmissionRequest,
): Promise<SubmissionResponse> {
  const res = await fetch(`${BASE}/${encodeURIComponent(applicationId)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Submission failed: ${res.status} ${text}`);
  }

  return res.json();
}
