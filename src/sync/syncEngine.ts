import type { ConflictResolution, RepoConfig } from '@/types';
import { useStore } from '@/store';
import { serializeAll, parseAll, MANIFEST_PATH, type FileMap } from '@/serialization';
import { gitBlobSha } from '@/lib/gitBlobSha';
import { loadBaseline, saveBaseline, type Baseline } from './localCache';
import { GithubApi, GithubApiError, type TreeChange } from './githubApi';
import { seedData } from '@/data/seed';
import { applyResolutions, threeWayMerge } from './conflict';

export type SyncOutcome = 'synced' | 'conflict' | 'nochange';

let api: GithubApi | null = null;
let pending:
  | { ours: FileMap; theirs: FileMap; remoteCommit: string; baseTreeSha: string; autoMerged: FileMap }
  | null = null;

export function isConfigured(): boolean {
  return api !== null;
}

/** wire up the API client (called on boot if settings exist, and after Settings save) */
export function configureApi(repo: RepoConfig, pat: string) {
  api = new GithubApi(repo, pat);
}

export function disconnect() {
  api = null;
  pending = null;
}

/** verify token + repo before saving settings; returns the repo's default branch */
export async function verifyRepo(repo: RepoConfig, pat: string): Promise<{ defaultBranch: string }> {
  const a = new GithubApi(repo, pat);
  const info = await a.verify();
  api = a;
  return { defaultBranch: info.defaultBranch };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function sameMap(a: FileMap, b: FileMap): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

const OWNED_PREFIXES = ['cards/', 'projects/', 'diary/', 'boards/'];
/** Files this app manages. Anything else in the repo (README, LICENSE, assets,
 *  other docs) is left completely untouched — never merged, never deleted. */
function isOwnedPath(path: string): boolean {
  return (
    path === 'cardnote.json' ||
    path === 'links.ndjson' ||
    OWNED_PREFIXES.some((p) => path.startsWith(p))
  );
}

async function fetchRemoteFiles(
  remoteCommit: string,
  baselineFiles: FileMap,
): Promise<{ files: FileMap; treeSha: string }> {
  const treeSha = await api!.getCommitTreeSha(remoteCommit);
  const blobs = await api!.listBlobs(treeSha);
  const baseShas = new Map<string, string>();
  for (const [p, c] of Object.entries(baselineFiles)) baseShas.set(p, await gitBlobSha(c));
  const files: FileMap = {};
  for (const e of blobs) {
    if (!isOwnedPath(e.path)) continue; // leave foreign files alone
    if (baselineFiles[e.path] !== undefined && baseShas.get(e.path) === e.sha) {
      files[e.path] = baselineFiles[e.path]; // unchanged remotely → no fetch
    } else {
      files[e.path] = await api!.getBlob(e.sha);
    }
  }
  return { files, treeSha };
}

async function buildChanges(files: FileMap, baseTreeSha: string | null): Promise<TreeChange[] | null> {
  if (!baseTreeSha) {
    return Promise.all(
      Object.entries(files).map(async ([path, content]) => ({
        path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: await api!.createBlob(content),
      })),
    );
  }
  const remoteBlobs = await api!.listBlobs(baseTreeSha);
  const remoteSha = new Map(remoteBlobs.map((e) => [e.path, e.sha]));
  const changes: TreeChange[] = [];
  for (const [path, content] of Object.entries(files)) {
    const localSha = await gitBlobSha(content);
    if (remoteSha.get(path) !== localSha) {
      const sha = await api!.createBlob(content);
      changes.push({ path, mode: '100644', type: 'blob', sha });
    }
  }
  for (const e of remoteBlobs) {
    // only ever delete files this app owns — never touch README/LICENSE/assets
    if (isOwnedPath(e.path) && files[e.path] === undefined) {
      changes.push({ path: e.path, mode: '100644', type: 'blob', sha: null });
    }
  }
  return changes.length ? changes : null;
}

async function commitFiles(
  files: FileMap,
  baseTreeSha: string | null,
  parents: string[],
  message: string,
): Promise<string> {
  const changes = await buildChanges(files, baseTreeSha);
  if (!changes) return parents[0]; // nothing actually changed
  const newTree = await api!.createTree(baseTreeSha, changes);
  const commitSha = await api!.createCommit(message, newTree, parents);
  if (parents.length === 0) {
    try {
      await api!.createRef(commitSha);
    } catch {
      await api!.updateRef(commitSha, true);
    }
  } else {
    await api!.updateRef(commitSha, false);
  }
  return commitSha;
}

async function persistBaseline(commitSha: string, files: FileMap) {
  const baseline: Baseline = { commitSha, files };
  await saveBaseline(baseline);
}

async function refreshHistory() {
  if (!api) return;
  const commits = await api.listCommits(8);
  useStore.getState().setCommits(commits);
}

function finalize(commitSha: string) {
  const store = useStore.getState();
  store.setSyncStatus('ready');
  store.markSynced();
  void refreshHistory();
  return commitSha;
}

function isNonFastForward(e: unknown): boolean {
  return e instanceof GithubApiError && e.status === 422;
}

/** Full sync: commit local changes, pull+merge remote, push.
 *  Retries automatically when another device pushes between our head fetch
 *  and updateRef (non-fast-forward 422) — the retry re-merges on the new head. */
export async function syncNow(message = '更新筆記', attempt = 0): Promise<SyncOutcome> {
  if (!api) throw new Error('尚未設定 GitHub 同步');
  const store = useStore.getState();
  store.setSyncError(null);
  store.setSyncStatus('pushing');
  const ours = serializeAll(store.getData());
  const baseline = (await loadBaseline()) ?? { commitSha: null, files: {} };
  try {
    const head = await api.getHeadSha();

    // brand new / empty repo → initial commit
    if (!head) {
      const sha = await commitFiles(ours, null, [], message);
      await persistBaseline(sha, ours);
      finalize(sha);
      return 'synced';
    }

    // remote unchanged since our last sync → just push local diff
    if (head === baseline.commitSha) {
      if (sameMap(ours, baseline.files)) {
        store.setSyncStatus('ready');
        store.markSynced();
        void refreshHistory();
        return 'nochange';
      }
      const baseTree = await api.getCommitTreeSha(head);
      const sha = await commitFiles(ours, baseTree, [head], message);
      await persistBaseline(sha, ours);
      finalize(sha);
      return 'synced';
    }

    // remote advanced → fetch, three-way merge
    store.setSyncStatus('pulling');
    const { files: theirs, treeSha } = await fetchRemoteFiles(head, baseline.files);
    const { merged, conflicts } = threeWayMerge(baseline.files, ours, theirs);
    if (conflicts.length) {
      pending = { ours, theirs, remoteCommit: head, baseTreeSha: treeSha, autoMerged: merged };
      store.setConflicts(conflicts);
      store.setSyncStatus('conflict');
      return 'conflict';
    }
    // commit + persist baseline BEFORE mutating the store, so a failed push
    // (e.g. non-fast-forward) leaves local state and baseline consistent.
    const sha = await commitFiles(merged, treeSha, [head], message);
    await persistBaseline(sha, merged);
    store.hydrate(parseAll(merged));
    finalize(sha);
    return 'synced';
  } catch (e) {
    if (isNonFastForward(e) && attempt < 2) return syncNow(message, attempt + 1);
    store.setSyncError(errMsg(e));
    throw e;
  }
}

/** Finish a conflicted sync once the user has chosen per-file resolutions. */
export async function resolveConflictsAndSync(resolutions: ConflictResolution[]): Promise<void> {
  if (!api || !pending) return;
  const store = useStore.getState();
  store.setSyncError(null);
  try {
    const final = applyResolutions(pending.autoMerged, resolutions, pending.ours, pending.theirs);
    store.setSyncStatus('pushing');
    // push first; only mutate the store + clear conflicts once it actually lands
    const sha = await commitFiles(final, pending.baseTreeSha, [pending.remoteCommit], '解決同步衝突後合併');
    await persistBaseline(sha, final);
    store.hydrate(parseAll(final));
    store.setConflicts([]);
    finalize(sha);
    pending = null;
  } catch (e) {
    store.setSyncError(errMsg(e));
    throw e;
  }
}

/** Used by Settings after a successful verify+save: configure, then do a first sync.
 *  Fresh device (no baseline) + remote already holds app data + local is still the
 *  untouched seed → adopt the remote outright instead of merging demo cards into it. */
export async function connectAndSync(repo: RepoConfig, pat: string): Promise<SyncOutcome> {
  configureApi(repo, pat);
  const store = useStore.getState();
  const baseline = await loadBaseline();
  if (!baseline && sameMap(serializeAll(store.getData()), serializeAll(seedData()))) {
    const head = await api!.getHeadSha();
    if (head) {
      store.setSyncStatus('pulling');
      const { files: theirs } = await fetchRemoteFiles(head, {});
      if (theirs[MANIFEST_PATH] !== undefined) {
        await persistBaseline(head, theirs);
        store.hydrate(parseAll(theirs));
        finalize(head);
        return 'synced';
      }
    }
  }
  return syncNow('來自卡片盒筆記的同步');
}
