import { useState } from 'react';
import { useStore } from '@/store';
import { syncNow } from '@/sync/syncEngine';

const STATUS_LABEL: Record<string, string> = {
  unconfigured: '尚未連線',
  ready: '已同步',
  initializing: '初始化中',
  loading: '載入中',
  committing: '提交中',
  pushing: '推送中',
  pulling: '拉取中',
  conflict: '有衝突',
  error: '同步錯誤',
};

const STATUS_COLOR: Record<string, string> = {
  ready: '#0ca678',
  unconfigured: '#a8a8b0',
  conflict: '#e8590c',
  error: '#e03131',
};

export function SyncStatusContent() {
  const repo = useStore((s) => s.repo);
  const status = useStore((s) => s.syncStatus);
  const commits = useStore((s) => s.commits);
  const error = useStore((s) => s.syncError);
  const openSettings = useStore((s) => s.openSettings);
  const [busy, setBusy] = useState(false);

  const color = STATUS_COLOR[status] ?? '#4263eb';

  async function push() {
    setBusy(true);
    try {
      await syncNow('立即推送變更');
    } catch {
      /* error surfaced via store.syncError */
    } finally {
      setBusy(false);
    }
  }

  if (!repo) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>尚未連線 GitHub</div>
        <div style={{ fontSize: 11.5, color: '#9a9aa4', marginBottom: 12, lineHeight: 1.6 }}>
          連到一個 GitHub 儲存庫即可把卡片同步到雲端、跨裝置使用。
        </div>
        <button
          onClick={openSettings}
          className="reset-btn"
          style={{ width: '100%', height: 34, borderRadius: 8, background: '#1b1b22', color: '#fff', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          前往設定
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        {STATUS_LABEL[status] ?? status}
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: '#9a9aa4', marginBottom: 12 }}>
        github.com/{repo.owner}/{repo.repo} · {repo.branch}
      </div>

      {error && (
        <div style={{ fontSize: 11.5, background: '#fdf3f4', color: '#b0535e', borderRadius: 8, padding: '8px 10px', marginBottom: 10, wordBreak: 'break-word' }}>
          {error}
        </div>
      )}

      {commits.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: '#9a9aa4', marginBottom: 7, fontWeight: 600 }}>最近提交</div>
          {commits.map((cm) => (
            <div key={cm.hash} style={{ display: 'flex', gap: 9, padding: '6px 0', borderTop: '1px solid rgba(0,0,0,.05)' }}>
              <span className="mono" style={{ fontSize: 11, color: '#7048e8', flexShrink: 0 }}>{cm.hash}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#3a3a44', lineHeight: 1.3 }}>{cm.msg}</div>
                <div style={{ fontSize: 10.5, color: '#b3b3bb' }}>{cm.time}</div>
              </div>
            </div>
          ))}
        </>
      )}

      <button
        onClick={push}
        disabled={busy}
        className="reset-btn"
        style={{ width: '100%', marginTop: 10, height: 32, borderRadius: 8, background: '#1b1b22', color: '#fff', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}
      >
        {busy && <span className="spinner" style={{ borderTopColor: '#fff' }} />}
        立即推送變更
      </button>
    </div>
  );
}
