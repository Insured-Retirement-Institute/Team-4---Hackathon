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

// ── SSE Streaming ────────────────────────────────────────────────────────────

export interface StreamEvent {
  type: 'agent_start' | 'tool_start' | 'tool_result' | 'agent_complete';
  name?: string;
  description?: string;
  fields_extracted?: Record<string, string>;
  duration_ms?: number;
  iteration?: number;
  known_data?: Record<string, string>;
  sources_used?: string[];
  fields_found?: number;
  summary?: string;
  total_duration_ms?: number;
  message?: string;
  timestamp?: number;
}

export function runPrefillStream(
  clientId: string,
  advisorId: string,
  onEvent: (event: StreamEvent) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`${AI_SERVICE_BASE}/api/v1/prefill/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, advisor_id: advisorId }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Stream failed: ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No readable stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(trimmed.slice(6));
              onEvent(event);
            } catch {
              // skip malformed events
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        console.error('Prefill stream error:', err);
      }
    });

  return controller;
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
