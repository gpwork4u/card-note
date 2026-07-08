import { openDB, type IDBPDatabase } from 'idb';
import type { AppData } from '@/store';
import type { RepoConfig } from '@/types';
import type { FileMap } from '@/serialization';

export interface PersistedSettings {
  repo: RepoConfig | null;
  pat: string;
  anthropicKey?: string;
}

export interface Baseline {
  /** commit sha of the last successful sync */
  commitSha: string | null;
  /**
   * Full file content at the last sync. Acts as the merge-base for three-way
   * merges (shallow REST sync has no real git merge-base). Small for a notes repo.
   */
  files: FileMap;
}

const DB_NAME = 'card-note';
const VERSION = 1;
const STORE = 'kv';

const K_APPDATA = 'appdata';
const K_SETTINGS = 'settings';
const K_BASELINE = 'baseline';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

export async function loadAppData(): Promise<AppData | null> {
  return ((await db()).get(STORE, K_APPDATA)) as Promise<AppData | null>;
}

export async function saveAppData(data: AppData): Promise<void> {
  await (await db()).put(STORE, data, K_APPDATA);
}

export async function loadSettings(): Promise<PersistedSettings | null> {
  return ((await db()).get(STORE, K_SETTINGS)) as Promise<PersistedSettings | null>;
}

export async function saveSettings(s: PersistedSettings): Promise<void> {
  await (await db()).put(STORE, s, K_SETTINGS);
}

export async function loadBaseline(): Promise<Baseline | null> {
  return ((await db()).get(STORE, K_BASELINE)) as Promise<Baseline | null>;
}

export async function saveBaseline(b: Baseline): Promise<void> {
  await (await db()).put(STORE, b, K_BASELINE);
}

export async function clearAll(): Promise<void> {
  await (await db()).clear(STORE);
}
