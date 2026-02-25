import type { ApplicationDefinition, AnswerMap } from '../types/application';

export type { ApplicationDefinition, AnswerMap };

const BASE = 'https://y5s8xyzi3v.us-east-1.awsapprunner.com';

// ── Shared error response ─────────────────────────────────────────────────────

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

// ── Products ──────────────────────────────────────────────────────────────────

/** Shape returned by GET /products (list) */
export interface Product {
  productId: string;
  carrier: string;
  productName: string;
  productType?: string;
  distributors?: string[];
  createdAt: string;
  updatedAt: string;
  // Extended fields present in the full definition record (GET /products/:productId)
  id?: string;
  version?: string;
  locale?: string;
  effectiveDate?: string;
  description?: string;
  pages?: ApplicationDefinition['pages'];
}

/** GET /products — list all products */
export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${BASE}/products`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch products: ${res.status} ${text}`);
  }
  return res.json();
}

/** GET /products/:productId — fetch full product / application definition */
export async function getApplication(productId: string, locale = 'en-US'): Promise<ApplicationDefinition> {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(productId)}?locale=${locale}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch application: ${res.status} ${text}`);
  }
  return res.json();
}

export interface CreateProductRequest {
  carrier: string;
  productName: string;
  productId: string;
}

/** POST /products — create a new product record */
export async function createProduct(body: CreateProductRequest): Promise<Product> {
  const res = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create product: ${res.status} ${text}`);
  }
  return res.json();
}

/** PUT /products/:productId — update an existing product (partial merge) */
export async function updateProduct(productId: string, fields: Partial<Product>): Promise<Product> {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update product: ${res.status} ${text}`);
  }
  return res.json();
}

/** DELETE /products/:productId — delete a product (returns 204 No Content) */
export async function deleteProduct(productId: string): Promise<void> {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete product: ${res.status} ${text}`);
  }
}

// ── Applications ──────────────────────────────────────────────────────────────

/** Shape returned by POST /applications and GET /applications/:id */
export interface ApplicationInstance {
  id: string;
  productId: string;
  answers: AnswerMap;
  status: 'in_progress' | 'submitted';
  createdAt: string;
  updatedAt: string;
}

/** POST /applications — create a new in-progress application instance */
export async function createApplication(productId: string): Promise<ApplicationInstance> {
  const res = await fetch(`${BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create application: ${res.status} ${text}`);
  }
  return res.json();
}

/** GET /applications/:id — retrieve a saved application instance */
export async function getApplicationInstance(id: string): Promise<ApplicationInstance> {
  const res = await fetch(`${BASE}/applications/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch application instance: ${res.status} ${text}`);
  }
  return res.json();
}

/** PUT /applications/:id/answers — merge new answers into an in-progress application */
export async function updateAnswers(id: string, answers: AnswerMap): Promise<ApplicationInstance> {
  const res = await fetch(`${BASE}/applications/${encodeURIComponent(id)}/answers`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update answers: ${res.status} ${text}`);
  }
  return res.json();
}

// ── Validate ──────────────────────────────────────────────────────────────────

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

/** POST /application/:applicationId/validate — validate answers (page or full scope) */
export async function validateApplication(
  applicationId: string,
  body: ValidationRequest,
  scope: ValidationScope = 'full',
  pageId?: string,
): Promise<ValidationResponse> {
  const params = new URLSearchParams({ scope });
  if (scope === 'page' && pageId) params.set('pageId', pageId);

  const res = await fetch(`${BASE}/application/${encodeURIComponent(applicationId)}/validate?${params}`, {
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

// ── Submit ────────────────────────────────────────────────────────────────────

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

/** POST /application/:applicationId/submit — run the 5-step submission pipeline */
export async function submitApplication(
  applicationId: string,
  body: SubmissionRequest,
): Promise<SubmissionResponse> {
  const res = await fetch(`${BASE}/application/${encodeURIComponent(applicationId)}/submit`, {
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

// ── Distributors ──────────────────────────────────────────────────────────────

export interface Distributor {
  distributorId: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

/** GET /distributors — list all distributors */
export async function getDistributors(): Promise<Distributor[]> {
  const res = await fetch(`${BASE}/distributors`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch distributors: ${res.status} ${text}`);
  }
  return res.json();
}

/** GET /distributors/:distributorId — get a single distributor */
export async function getDistributor(distributorId: string): Promise<Distributor> {
  const res = await fetch(`${BASE}/distributors/${encodeURIComponent(distributorId)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch distributor: ${res.status} ${text}`);
  }
  return res.json();
}

export interface CreateDistributorRequest {
  distributorId: string;
  name: string;
}

/** POST /distributors — create a new distributor */
export async function createDistributor(body: CreateDistributorRequest): Promise<Distributor> {
  const res = await fetch(`${BASE}/distributors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create distributor: ${res.status} ${text}`);
  }
  return res.json();
}

/** PUT /distributors/:distributorId — update an existing distributor (partial merge) */
export async function updateDistributor(distributorId: string, fields: Partial<Distributor>): Promise<Distributor> {
  const res = await fetch(`${BASE}/distributors/${encodeURIComponent(distributorId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update distributor: ${res.status} ${text}`);
  }
  return res.json();
}

/** DELETE /distributors/:distributorId — delete a distributor (returns 204 No Content) */
export async function deleteDistributor(distributorId: string): Promise<void> {
  const res = await fetch(`${BASE}/distributors/${encodeURIComponent(distributorId)}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete distributor: ${res.status} ${text}`);
  }
}
