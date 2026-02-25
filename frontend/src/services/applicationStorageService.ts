const SAVES_INDEX_KEY = 'eapp_saves';
const saveDataKey = (id: string) => `eapp_save_data_${id}`;

export interface SavedApplicationEntry {
  id: string;
  productId: string;
  productName: string;
  carrier: string;
  version: string;
  /** Set once on first save, never overwritten. */
  startedAt: string;
  lastSavedAt: string;
  status: 'in_progress' | 'submitted';
  currentStep: number;
}

export interface SavedApplicationData {
  currentStep: number;
  values: Record<string, unknown>;
}

function readIndex(): SavedApplicationEntry[] {
  try {
    const raw = localStorage.getItem(SAVES_INDEX_KEY);
    return raw ? (JSON.parse(raw) as SavedApplicationEntry[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: SavedApplicationEntry[]): void {
  localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(entries));
}

export function listSaves(): SavedApplicationEntry[] {
  return readIndex().sort(
    (a, b) => new Date(b.lastSavedAt).getTime() - new Date(a.lastSavedAt).getTime(),
  );
}

/**
 * Upserts a save entry. `startedAt` is managed internally:
 * - On first insert it is set to the current timestamp.
 * - On subsequent updates the original value is preserved.
 */
export function saveApplication(
  entry: Omit<SavedApplicationEntry, 'startedAt'>,
  data: SavedApplicationData,
): void {
  const index = readIndex();
  const existingIdx = index.findIndex((e) => e.id === entry.id);
  const startedAt = existingIdx >= 0 ? index[existingIdx].startedAt : new Date().toISOString();
  const fullEntry: SavedApplicationEntry = { ...entry, startedAt };

  if (existingIdx >= 0) {
    index[existingIdx] = fullEntry;
  } else {
    index.push(fullEntry);
  }

  writeIndex(index);
  localStorage.setItem(saveDataKey(entry.id), JSON.stringify(data));
}

export function loadApplicationData(id: string): SavedApplicationData | null {
  try {
    const raw = localStorage.getItem(saveDataKey(id));
    return raw ? (JSON.parse(raw) as SavedApplicationData) : null;
  } catch {
    return null;
  }
}

export function markSubmitted(id: string): void {
  const index = readIndex();
  const entry = index.find((e) => e.id === id);
  if (entry) {
    entry.status = 'submitted';
    entry.lastSavedAt = new Date().toISOString();
    writeIndex(index);
  }
}

export function deleteApplication(id: string): void {
  writeIndex(readIndex().filter((e) => e.id !== id));
  localStorage.removeItem(saveDataKey(id));
}

export function countInProgress(): number {
  return readIndex().filter((e) => e.status === 'in_progress').length;
}
