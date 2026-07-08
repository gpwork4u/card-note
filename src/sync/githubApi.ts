import type { CommitInfo, RepoConfig } from '@/types';
import { base64ToUtf8, utf8ToBase64 } from '@/lib/base64';
import { relativeTime } from '@/lib/format';

const API = 'https://api.github.com';

export interface TreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
}

/** a file to write (sha from a created blob) or delete (sha: null) in a new tree */
export interface TreeChange {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string | null;
}

export class GithubApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'GithubApiError';
  }
}

export class GithubApi {
  constructor(
    private repo: RepoConfig,
    private token: string,
  ) {}

  private get base(): string {
    return `${API}/repos/${this.repo.owner}/${this.repo.repo}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = j.message ?? '';
      } catch {
        /* ignore */
      }
      throw new GithubApiError(
        `GitHub ${method} ${path} → ${res.status} ${detail}`.trim(),
        res.status,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** verify the token + repo are reachable; returns default branch name */
  async verify(): Promise<{ defaultBranch: string }> {
    const repo = await this.request<{ default_branch: string }>('GET', '');
    return { defaultBranch: repo.default_branch };
  }

  /** HEAD commit sha of the configured branch, or null if the ref doesn't exist */
  async getHeadSha(): Promise<string | null> {
    try {
      const ref = await this.request<{ object: { sha: string } }>(
        'GET',
        `/git/ref/heads/${encodeURIComponent(this.repo.branch)}`,
      );
      return ref.object.sha;
    } catch (e) {
      if (e instanceof GithubApiError && e.status === 404) return null;
      throw e;
    }
  }

  async getCommitTreeSha(commitSha: string): Promise<string> {
    const c = await this.request<{ tree: { sha: string } }>('GET', `/git/commits/${commitSha}`);
    return c.tree.sha;
  }

  /** all blob entries under a tree (recursive) */
  async listBlobs(treeSha: string): Promise<TreeEntry[]> {
    const t = await this.request<{ tree: TreeEntry[]; truncated: boolean }>(
      'GET',
      `/git/trees/${treeSha}?recursive=1`,
    );
    // A truncated listing would make missing files look like remote deletions and
    // could delete local cards. Abort rather than risk data loss.
    if (t.truncated) {
      throw new GithubApiError(
        '儲存庫檔案數量過多，GitHub 回傳的檔案清單被截斷；為避免資料遺失已中止同步。',
        0,
      );
    }
    return t.tree.filter((e) => e.type === 'blob');
  }

  async getBlob(sha: string): Promise<string> {
    const b = await this.request<{ content: string; encoding: string }>(
      'GET',
      `/git/blobs/${sha}`,
    );
    return b.encoding === 'base64' ? base64ToUtf8(b.content) : b.content;
  }

  async createBlob(content: string): Promise<string> {
    const b = await this.request<{ sha: string }>('POST', '/git/blobs', {
      content: utf8ToBase64(content),
      encoding: 'base64',
    });
    return b.sha;
  }

  async createTree(baseTree: string | null, changes: TreeChange[]): Promise<string> {
    const t = await this.request<{ sha: string }>('POST', '/git/trees', {
      ...(baseTree ? { base_tree: baseTree } : {}),
      tree: changes,
    });
    return t.sha;
  }

  async createCommit(message: string, treeSha: string, parents: string[]): Promise<string> {
    const c = await this.request<{ sha: string }>('POST', '/git/commits', {
      message,
      tree: treeSha,
      parents,
    });
    return c.sha;
  }

  async updateRef(sha: string, force = false): Promise<void> {
    await this.request('PATCH', `/git/refs/heads/${encodeURIComponent(this.repo.branch)}`, {
      sha,
      force,
    });
  }

  async createRef(sha: string): Promise<void> {
    await this.request('POST', '/git/refs', {
      ref: `refs/heads/${this.repo.branch}`,
      sha,
    });
  }

  async listCommits(limit = 8): Promise<CommitInfo[]> {
    try {
      const commits = await this.request<
        { sha: string; commit: { message: string; author: { date: string } } }[]
      >('GET', `/commits?sha=${encodeURIComponent(this.repo.branch)}&per_page=${limit}`);
      return commits.map((c) => ({
        hash: c.sha.slice(0, 6),
        msg: c.commit.message.split('\n')[0],
        time: relativeTime(c.commit.author.date),
      }));
    } catch {
      return [];
    }
  }
}
