const AI_SERVICE_BASE = import.meta.env.VITE_AI_SERVICE_URL ?? 'https://3ddrg3spbd.us-east-1.awsapprunner.com';

export interface Client {
  client_id: string;
  display_name: string;
}

export interface PrefillResult {
  known_data: Record<string, string>;
  sources_used: string[];
  fields_found: number;
  summary: string;
}

export async function fetchClients(): Promise<Client[]> {
  const res = await fetch(`${AI_SERVICE_BASE}/api/v1/prefill/clients`);
  if (!res.ok) {
    throw new Error(`Failed to fetch clients: ${res.status}`);
  }
  return res.json();
}

export async function runPrefill(clientId: string): Promise<PrefillResult> {
  const res = await fetch(`${AI_SERVICE_BASE}/api/v1/prefill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prefill failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function runPrefillWithDocument(file: File, clientId?: string): Promise<PrefillResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (clientId) {
    formData.append('client_id', clientId);
  }

  const res = await fetch(`${AI_SERVICE_BASE}/api/v1/prefill/document`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Prefill with document failed: ${res.status} ${text}`);
  }
  return res.json();
}
