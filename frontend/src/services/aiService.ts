const AI_SERVICE_BASE = import.meta.env.VITE_AI_SERVICE_URL ?? 'https://3ddrg3spbd.us-east-1.awsapprunner.com';

export interface SessionResponse {
  session_id: string;
  phase: string;
  greeting: string;
  current_step: string | null;
  current_step_index: number | null;
  total_steps: number | null;
  field_summary: Record<string, unknown>;
}

export interface UpdatedField {
  field_id: string;
  value: string | boolean;
  status: string;
}

export interface ToolCallInfo {
  name: string;
  result_summary?: string;
}

export interface MessageResponse {
  reply: string;
  phase: string;
  updated_fields: UpdatedField[];
  tool_calls?: ToolCallInfo[];
  current_step: string | null;
  current_step_index: number | null;
  total_steps: number | null;
}

async function fetchSchema(): Promise<unknown[]> {
  const res = await fetch(`${AI_SERVICE_BASE}/api/v1/demo/midland-schema`);
  if (!res.ok) {
    throw new Error(`Failed to fetch schema: ${res.status}`);
  }
  return res.json();
}

export async function createSession(productId = 'midland-fixed-annuity-001', knownData?: Record<string, string>, advisorName?: string): Promise<SessionResponse> {
  const questions = await fetchSchema();

  const body: Record<string, unknown> = { questions, product_id: productId };
  if (knownData && Object.keys(knownData).length > 0) {
    body.known_data = knownData;
  }
  if (advisorName) {
    body.advisor_name = advisorName;
  }

  const res = await fetch(`${AI_SERVICE_BASE}/api/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create session: ${res.status} ${text}`);
  }

  return res.json();
}

export async function sendMessage(sessionId: string, message: string): Promise<MessageResponse> {
  const res = await fetch(`${AI_SERVICE_BASE}/api/v1/sessions/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send message: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  const res = await fetch(`${AI_SERVICE_BASE}/api/v1/sessions/${sessionId}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get session: ${res.status} ${text}`);
  }

  return res.json();
}
