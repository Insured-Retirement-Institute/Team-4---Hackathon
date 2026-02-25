const AI_SERVICE_BASE = import.meta.env.VITE_AI_SERVICE_URL ?? 'https://3ddrg3spbd.us-east-1.awsapprunner.com';

export interface InitiateCallParams {
  to_number: string;
  missing_fields: Array<{ id: string; label: string }>;
  client_name: string;
  advisor_name: string;
}

export interface CallStatus {
  status: string;
  transcript?: string;
  live_transcript?: Array<{ role: string; content: string }>;
  extracted_fields?: Record<string, string>;
  duration_seconds?: number;
}

export async function initiateCall(params: InitiateCallParams): Promise<{ call_id: string; status: string }> {
  const res = await fetch(`${AI_SERVICE_BASE}/api/v1/retell/calls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to initiate call: ${res.status} ${text}`);
  }
  return res.json();
}

export async function getCallStatus(callId: string): Promise<CallStatus> {
  const res = await fetch(`${AI_SERVICE_BASE}/api/v1/retell/calls/${encodeURIComponent(callId)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get call status: ${res.status} ${text}`);
  }
  return res.json();
}
