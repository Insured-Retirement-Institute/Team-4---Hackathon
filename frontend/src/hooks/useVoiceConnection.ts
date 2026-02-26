import { useCallback, useRef, useState } from 'react';
import type { ToolCallInfo } from '../services/aiService';

const AI_SERVICE_BASE = import.meta.env.VITE_AI_SERVICE_URL ?? 'https://3ddrg3spbd.us-east-1.awsapprunner.com';

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
}

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'speaking' | 'error';

export interface VoiceConnectionOptions {
  onToolCallInfo?: (info: ToolCallInfo) => void;
}

export function useVoiceConnection(options?: VoiceConnectionOptions) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);

  const onToolCallInfoRef = useRef(options?.onToolCallInfo);
  onToolCallInfoRef.current = options?.onToolCallInfo;

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);

  const connect = useCallback(async (sessionId: string) => {
    if (wsRef.current) return;

    console.log('[Voice] Connecting to session:', sessionId);
    setStatus('connecting');
    setTranscripts([]);

    // Get mic access
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
    } catch (err) {
      console.error('[Voice] Microphone access denied:', err);
      setStatus('error');
      return;
    }
    console.log('[Voice] Microphone access granted');

    // Build WebSocket URL
    const wsBase = AI_SERVICE_BASE.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/api/v1/sessions/${sessionId}/voice`;
    console.log('[Voice] Opening WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Playback context at 24kHz
    const playbackCtx = new AudioContext({ sampleRate: 24000 });
    playbackCtxRef.current = playbackCtx;
    nextPlayTimeRef.current = 0;

    ws.onopen = () => {
      console.log('[Voice] WebSocket connected, setting up mic capture');
      setStatus('connected');

      // Set up mic capture
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Downsample to 16kHz if needed
        const sampleRate = audioCtx.sampleRate;
        const ratio = Math.round(sampleRate / 16000);
        const outputLength = ratio > 1 ? Math.floor(inputData.length / ratio) : inputData.length;
        const samples = new Float32Array(outputLength);
        for (let i = 0; i < outputLength; i++) {
          samples[i] = inputData[i * ratio];
        }

        // Float32 → Int16
        const int16 = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          const s = Math.max(-1, Math.min(1, samples[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Base64 encode
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);

        ws.send(JSON.stringify({ type: 'audio', data: b64 }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'audio' && msg.data) {
          setStatus('speaking');
          playAudioChunk(msg.data, playbackCtx);
        } else if (msg.type === 'transcript') {
          console.log(`[Voice] Transcript (${msg.role}):`, msg.text);
          if (msg.role === 'user') {
            setStatus('connected');
          }
          setTranscripts((prev) => [...prev, { role: msg.role, text: msg.text }]);
        } else if (msg.type === 'field_update' && msg.fields) {
          console.log('[Voice] field_update received:', msg.fields.length, 'fields', msg.fields);
          // Dispatch the same CustomEvent that the widget uses
          for (const field of msg.fields) {
            window.dispatchEvent(
              new CustomEvent('iri:field_updated', {
                detail: { field_id: field.field_id, value: field.value, status: field.status },
              }),
            );
          }
        } else if (msg.type === 'tool_call_info') {
          console.log('[Voice] tool_call_info received:', {
            name: msg.name,
            source_label: msg.source_label,
            result_data_keys: msg.result_data ? Object.keys(msg.result_data) : [],
            field_count: msg.result_data ? Object.keys(msg.result_data).length : 0,
          });
          onToolCallInfoRef.current?.(msg as ToolCallInfo);
        } else if (msg.type === 'phase_change') {
          console.log('[Voice] phase_change:', msg.phase);
          window.dispatchEvent(
            new CustomEvent('iri:phase_changed', { detail: { phase: msg.phase } }),
          );
        } else if (msg.type === 'session_ended') {
          console.log('[Voice] Session ended');
          cleanupConnection();
          setStatus('idle');
        } else if (msg.type === 'error') {
          console.error('[Voice] Error:', msg.message);
          setStatus('error');
        }
      } catch {
        // skip malformed
      }
    };

    ws.onclose = (ev) => {
      console.log('[Voice] WebSocket closed:', ev.code, ev.reason);
      cleanupConnection();
      setStatus('idle');
    };

    ws.onerror = (ev) => {
      console.error('[Voice] WebSocket error:', ev);
      cleanupConnection();
      setStatus('error');
    };
  }, []);

  const playAudioChunk = useCallback((b64Data: string, ctx: AudioContext) => {
    // Decode base64 → Int16 → Float32
    const binary = atob(b64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }, []);

  const cleanupConnection = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;

    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;

    playbackCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    nextPlayTimeRef.current = 0;
  }, []);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'end_session' }));
      ws.close();
    }
    wsRef.current = null;
    cleanupConnection();
    setStatus('idle');
  }, [cleanupConnection]);

  return { status, transcripts, connect, disconnect };
}
