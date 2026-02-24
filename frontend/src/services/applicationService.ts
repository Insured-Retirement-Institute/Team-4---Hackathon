import type { ApplicationDefinition, AnswerMap } from '../types/application';

export type { ApplicationDefinition, AnswerMap };

const BASE = 'https://y5s8xyzi3v.us-east-1.awsapprunner.com/application';

// ── GET /application/:productId ───────────────────────────────────────────────

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
