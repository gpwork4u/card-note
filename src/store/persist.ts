import { useStore } from '.';
import type { AppData } from '.';
import { loadAppData, loadSettings, saveAppData, saveSettings } from '@/sync/localCache';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let settingsTimer: ReturnType<typeof setTimeout> | null = null;

function snapshotData(): AppData {
  return useStore.getState().getData();
}

function scheduleDataSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveAppData(snapshotData()).catch((e) => console.warn('saveAppData failed', e));
  }, 400);
}

function scheduleSettingsSave() {
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => {
    const s = useStore.getState();
    void saveSettings({ repo: s.repo, pat: s.pat }).catch((e) =>
      console.warn('saveSettings failed', e),
    );
  }, 300);
}

/** Subscribe to the store and mirror persisted slices into IndexedDB (debounced). */
export function startPersistence() {
  let prev = useStore.getState();
  useStore.subscribe((state) => {
    if (
      state.cards !== prev.cards ||
      state.links !== prev.links ||
      state.projects !== prev.projects ||
      state.diary !== prev.diary
    ) {
      scheduleDataSave();
    }
    if (state.repo !== prev.repo || state.pat !== prev.pat) {
      scheduleSettingsSave();
    }
    prev = state;
  });
}

/**
 * Boot the app: load cached data + settings from IndexedDB, hydrate the store,
 * then start mirroring changes back. Returns once the store is ready to render.
 */
export async function bootstrap() {
  const st = useStore.getState();
  try {
    const [data, settings] = await Promise.all([loadAppData(), loadSettings()]);
    if (data && Array.isArray(data.cards)) {
      st.hydrate({
        cards: data.cards,
        links: data.links ?? [],
        projects: data.projects ?? [],
        diary: data.diary ?? [],
        boards: Array.isArray(data.boards) ? data.boards : [],
      });
      // migrate caches written before multi-board support: build a default board
      if (useStore.getState().boards.length === 0) {
        useStore.getState().migrateDefaultBoard();
      }
    } else {
      // first run — give the seed data a home in IndexedDB
      await saveAppData(st.getData());
      st.hydrate({});
    }
    if (settings) {
      st.setRepo(settings.repo ?? null);
      st.setPat(settings.pat ?? '');
      st.setSyncStatus(settings.repo ? 'ready' : 'unconfigured');
    }
  } catch (e) {
    console.warn('bootstrap failed, continuing with seed', e);
    st.hydrate({});
  }
  startPersistence();
}
