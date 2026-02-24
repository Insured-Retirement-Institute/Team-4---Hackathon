import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type FieldValue = string | boolean;

interface CollectedFields {
  [fieldId: string]: FieldValue;
}

interface ApplicationContextValue {
  /** All fields collected by AI chat so far */
  collectedFields: CollectedFields;
  /** Merge new fields into collected set (from AI chat responses) */
  mergeFields: (fields: Record<string, FieldValue>) => void;
  /** Active AI session ID */
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  /** Current AI phase */
  phase: string | null;
  setPhase: (phase: string | null) => void;
  /** Step progress */
  currentStepIndex: number | null;
  totalSteps: number | null;
  setStepProgress: (index: number | null, total: number | null) => void;
}

const ApplicationContext = createContext<ApplicationContextValue | undefined>(undefined);

export function ApplicationProvider({ children }: { children: React.ReactNode }) {
  const [collectedFields, setCollectedFields] = useState<CollectedFields>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [totalSteps, setTotalSteps] = useState<number | null>(null);

  const mergeFields = useCallback((fields: Record<string, FieldValue>) => {
    setCollectedFields((prev) => ({ ...prev, ...fields }));
  }, []);

  const setStepProgress = useCallback((index: number | null, total: number | null) => {
    setCurrentStepIndex(index);
    setTotalSteps(total);
  }, []);

  const value = useMemo<ApplicationContextValue>(
    () => ({
      collectedFields,
      mergeFields,
      sessionId,
      setSessionId,
      phase,
      setPhase,
      currentStepIndex,
      totalSteps,
      setStepProgress,
    }),
    [collectedFields, mergeFields, sessionId, phase, currentStepIndex, totalSteps, setStepProgress],
  );

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplication() {
  const ctx = useContext(ApplicationContext);
  if (!ctx) {
    throw new Error('useApplication must be used within ApplicationProvider');
  }
  return ctx;
}
