import { useEffect, useRef } from 'react';
import { useApplication } from '../context/ApplicationContext';

const AI_SERVICE_BASE = import.meta.env.VITE_AI_SERVICE_URL ?? 'https://3ddrg3spbd.us-east-1.awsapprunner.com';

interface WidgetFieldUpdate {
  field_id: string;
  value: string | boolean;
  status: string;
}

interface IRIWidgetInstance {
  config: { knownData: Record<string, string> };
  sessionId?: string | null;
  isOpen?: boolean;
  _addMessage: (role: string, text: string) => void;
  _setTyping: (active: boolean) => void;
  _setInputEnabled: (enabled: boolean) => void;
  _updateProgress: (data: Record<string, unknown>) => void;
  _setPhase: (phase: string) => void;
  _emit: (name: string, detail: Record<string, unknown>) => void;
}

interface IRIChatGlobal {
  _initialized?: boolean;
  _instance?: IRIWidgetInstance;
}

declare global {
  interface Window {
    IRIChat?: IRIChatGlobal;
  }
}

/**
 * Bridges the embedded widget.js events into ApplicationContext.
 * - Widget → React: listens for iri:field_updated, iri:session_created, iri:phase_changed
 * - React → Widget: injects wizard fields as knownData before session start,
 *   and sends new wizard fields to existing session when widget is re-opened
 */
export function useWidgetSync() {
  const { mergeFields, setSessionId, setPhase, collectedFields } = useApplication();
  const collectedRef = useRef(collectedFields);
  collectedRef.current = collectedFields;

  // Track which fields the widget session already knows about
  const widgetKnownFieldsRef = useRef<Record<string, string | boolean>>({});
  const syncingRef = useRef(false);

  // Inject collectedFields into the widget's knownData before it starts a session.
  // Also detect when widget re-opens with an active session and sync new wizard fields.
  useEffect(() => {
    let prevOpen = false;

    const interval = setInterval(() => {
      const instance = window.IRIChat?._instance;
      if (!instance) return;

      // Before session starts: keep knownData in sync with wizard values
      if (!instance.sessionId) {
        const knownData: Record<string, string> = {};
        for (const [key, val] of Object.entries(collectedRef.current)) {
          if (typeof val === 'string' && val.trim()) {
            knownData[key] = val;
          } else if (typeof val === 'boolean') {
            knownData[key] = val ? 'true' : 'false';
          }
        }
        if (Object.keys(knownData).length > 0) {
          instance.config.knownData = knownData;
        }
        prevOpen = false;
        return;
      }

      // Detect widget panel re-opened with an active session
      const isOpen = !!instance.isOpen;
      if (isOpen && !prevOpen && instance.sessionId && !syncingRef.current) {
        // Find fields the wizard has that the widget session doesn't know about
        const newFields: Record<string, string> = {};
        for (const [key, val] of Object.entries(collectedRef.current)) {
          const strVal = typeof val === 'boolean' ? (val ? 'true' : 'false') : val;
          if (typeof strVal === 'string' && strVal.trim() && widgetKnownFieldsRef.current[key] !== val) {
            newFields[key] = strVal;
          }
        }

        if (Object.keys(newFields).length > 0) {
          syncingRef.current = true;

          // Build a friendly summary
          const fieldList = Object.entries(newFields)
            .slice(0, 15)
            .filter(([k, v]) => k && v != null)
            .map(([k, v]) => `${String(k).replace(/_/g, ' ')}: ${String(v)}`)
            .join(', ');
          const userMsg = `I've updated some fields in the form: ${fieldList}`;

          instance._addMessage('user', userMsg);
          instance._setTyping(true);
          instance._setInputEnabled(false);

          fetch(`${AI_SERVICE_BASE}/api/v1/sessions/${instance.sessionId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMsg }),
          })
            .then((r) => r.json())
            .then((data) => {
              instance._addMessage('assistant', data.reply || 'Got it, fields updated.');
              instance._setTyping(false);
              instance._setInputEnabled(true);
              if (data.phase) instance._setPhase(data.phase);
              try { instance._updateProgress(data); } catch (_) { /* ignore progress update errors */ }

              // Track synced fields
              for (const [k, v] of Object.entries(newFields)) {
                widgetKnownFieldsRef.current[k] = v;
              }

              // Merge any newly extracted fields back
              if (data.updated_fields?.length) {
                const fieldMap: Record<string, string | boolean> = {};
                for (const f of data.updated_fields) {
                  fieldMap[f.field_id] = f.value;
                  widgetKnownFieldsRef.current[f.field_id] = f.value;
                }
                mergeFields(fieldMap);
                instance._emit('iri:field_updated', { fields: data.updated_fields });
              }

              syncingRef.current = false;
            })
            .catch((err) => {
              instance._addMessage('assistant', 'Sorry, I couldn\'t sync those fields: ' + err.message);
              instance._setTyping(false);
              instance._setInputEnabled(true);
              syncingRef.current = false;
            });
        }
      }
      prevOpen = isOpen;
    }, 500);

    return () => clearInterval(interval);
  }, [mergeFields]);

  // Track fields the widget reports so we don't re-send them
  useEffect(() => {
    function handleFieldUpdated(e: Event) {
      const detail = (e as CustomEvent).detail;
      const fields: WidgetFieldUpdate[] = detail?.fields ?? [];
      if (!fields.length) return;

      const fieldMap: Record<string, string | boolean> = {};
      for (const f of fields) {
        fieldMap[f.field_id] = f.value;
        widgetKnownFieldsRef.current[f.field_id] = f.value;
      }
      mergeFields(fieldMap);
    }

    function handleSessionCreated(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.session_id) {
        setSessionId(detail.session_id);
        // Seed known fields from what was passed as knownData
        widgetKnownFieldsRef.current = { ...collectedRef.current };
      }
    }

    function handlePhaseChanged(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.phase) {
        setPhase(detail.phase);
      }
    }

    window.addEventListener('iri:field_updated', handleFieldUpdated);
    window.addEventListener('iri:session_created', handleSessionCreated);
    window.addEventListener('iri:phase_changed', handlePhaseChanged);

    return () => {
      window.removeEventListener('iri:field_updated', handleFieldUpdated);
      window.removeEventListener('iri:session_created', handleSessionCreated);
      window.removeEventListener('iri:phase_changed', handlePhaseChanged);
    };
  }, [mergeFields, setSessionId, setPhase]);
}
