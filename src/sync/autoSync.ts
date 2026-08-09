import { useStore } from '@/store';
import { isConfigured, syncNow } from './syncEngine';

/** Push edits to GitHub automatically, debounced after the last change.
 *  Conflicts still surface through the normal ConflictResolver flow. */
const DEBOUNCE_MS = 5000;

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let dirtyWhileRunning = false;

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void run(), DEBOUNCE_MS);
}

async function run() {
  const store = useStore.getState();
  if (!isConfigured() || !store.repo) return;
  // conflict needs the user; a manual sync in flight will pick our edits up itself
  if (store.syncStatus === 'conflict' || store.syncStatus === 'pushing' || store.syncStatus === 'pulling') {
    dirtyWhileRunning = true;
    return;
  }
  running = true;
  try {
    await syncNow('自動同步');
  } catch {
    // surfaced via store.syncError; reset status so a later edit can retry
    useStore.getState().setSyncStatus('error');
  } finally {
    running = false;
    if (dirtyWhileRunning) {
      dirtyWhileRunning = false;
      schedule();
    }
  }
}

export function startAutoSync() {
  let prev = useStore.getState();
  useStore.subscribe((state) => {
    const changed =
      state.cards !== prev.cards ||
      state.boards !== prev.boards ||
      state.links !== prev.links ||
      state.projects !== prev.projects ||
      state.diary !== prev.diary;
    prev = state;
    if (!changed) return;
    // syncNow hydrates the store with merged data; don't re-schedule for our own writes
    if (running) {
      dirtyWhileRunning = true;
      return;
    }
    schedule();
  });
}
