import { useState } from 'react';
import { useStore } from '@/store';
import { connectAndSync, disconnect, verifyRepo } from '@/sync/syncEngine';
import { setProvider, providerLabel } from '@/ai';
import { ClaudeProvider, verifyAnthropicKey } from '@/ai/claude';
import { LocalProvider } from '@/ai/local';
import { Modal } from '@/components/common/Modal';
import { GithubIcon, ImportIcon, SparkleIcon } from '@/components/common/icons';

export function SettingsDialog() {
  const open = useStore((s) => s.settingsOpen);
  const close = useStore((s) => s.closeSettings);
  const storeRepo = useStore((s) => s.repo);
  const storePat = useStore((s) => s.pat);
  const setRepo = useStore((s) => s.setRepo);
  const setPat = useStore((s) => s.setPat);
  const openImport = useStore((s) => s.openImport);

  const [owner, setOwner] = useState(storeRepo?.owner ?? '');
  const [repo, setRepoName] = useState(storeRepo?.repo ?? '');
  const [branch, setBranch] = useState(storeRepo?.branch ?? 'main');
  const [pat, setPatLocal] = useState(storePat ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const storeAnthropicKey = useStore((s) => s.anthropicKey);
  const setAnthropicKey = useStore((s) => s.setAnthropicKey);
  const [aiKey, setAiKeyLocal] = useState(storeAnthropicKey ?? '');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  async function saveAiKey() {
    const key = aiKey.trim();
    if (!key) {
      setAiMsg({ kind: 'err', text: '請貼上 Anthropic API key（sk-ant-…）。' });
      return;
    }
    setAiBusy(true);
    setAiMsg(null);
    try {
      // 免費端點驗證 key 有效，才持久化並切換 provider
      await verifyAnthropicKey(key);
      setAnthropicKey(key);
      setProvider(new ClaudeProvider(key));
      setAiMsg({ kind: 'ok', text: `已驗證並啟用 ${providerLabel()}。AI 搜尋、連結建議、日記擷取與自動分類將改用 Claude。` });
    } catch (e) {
      setAiMsg({ kind: 'err', text: '啟用失敗：' + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setAiBusy(false);
    }
  }

  function disableAi() {
    setAnthropicKey('');
    setAiKeyLocal('');
    setProvider(new LocalProvider());
    setAiMsg({ kind: 'info', text: '已改回本機（離線）模式，key 已從此裝置移除。' });
  }

  if (!open) return null;

  async function connect() {
    if (!owner.trim() || !repo.trim()) {
      setMsg({ kind: 'err', text: '請填入 GitHub 帳號與儲存庫名稱。' });
      return;
    }
    setBusy(true);
    setMsg(null);
    const cfg = { owner: owner.trim(), repo: repo.trim(), branch: branch.trim() || 'main' };
    try {
      await verifyRepo(cfg, pat);
      setRepo(cfg);
      setPat(pat);
      const outcome = await connectAndSync(cfg, pat);
      setMsg({
        kind: outcome === 'conflict' ? 'info' : 'ok',
        text: outcome === 'conflict' ? '已連線，但偵測到同步衝突，請在衝突視窗中處理。' : '已連線並完成同步 ✓',
      });
    } catch (e) {
      setMsg({ kind: 'err', text: '連線失敗：' + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setBusy(false);
    }
  }

  function doDisconnect() {
    disconnect();
    setRepo(null);
    setPat('');
    useStore.getState().setSyncStatus('unconfigured');
    setMsg({ kind: 'info', text: '已中斷連線（本機資料仍保留）。' });
  }

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#6a6a74', marginBottom: 5, display: 'block' };
  const input: React.CSSProperties = {
    width: '100%',
    height: 40,
    padding: '0 12px',
    border: '1px solid rgba(0,0,0,.12)',
    borderRadius: 10,
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    background: '#fff',
  };

  return (
    <Modal onClose={close} width={520}>
      <div style={{ padding: '20px 22px 12px', borderBottom: '1px solid rgba(0,0,0,.07)', display: 'flex', alignItems: 'center', gap: 9 }}>
        <GithubIcon size={18} />
        <div style={{ fontSize: 16, fontWeight: 700 }}>設定</div>
        <div style={{ flex: 1 }} />
        <button onClick={close} className="reset-btn" style={{ fontSize: 18, color: '#9a9aa4', width: 28, height: 28 }}>✕</button>
      </div>

      <div className="scrl" style={{ overflowY: 'auto', padding: '18px 22px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>GitHub 同步</div>
        <div style={{ fontSize: 11.5, color: '#9a9aa4', lineHeight: 1.6, marginBottom: 14 }}>
          資料以「一張卡片一個檔案」存到你的 GitHub 儲存庫，每次變更都是一個 commit。多裝置只要連到同一個 repo 就會同步。
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={label}>GitHub 帳號 / 組織</label>
            <input style={input} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="例如 me" />
          </div>
          <div>
            <label style={label}>儲存庫名稱</label>
            <input style={input} value={repo} onChange={(e) => setRepoName(e.target.value)} placeholder="notes" />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>分支</label>
          <input style={input} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
        </div>
        <div style={{ marginBottom: 6 }}>
          <label style={label}>Personal Access Token（fine-grained，Contents 讀寫）</label>
          <input style={{ ...input, fontFamily: 'Space Mono, monospace' }} value={pat} onChange={(e) => setPatLocal(e.target.value)} placeholder="github_pat_…" type="password" />
        </div>
        <div style={{ fontSize: 11, color: '#b0838a', background: '#fdf3f4', border: '1px solid #f6e0e2', borderRadius: 8, padding: '8px 10px', lineHeight: 1.55, marginBottom: 14 }}>
          ⚠️ Token 只存在這台裝置的瀏覽器（IndexedDB），不會被提交到 git。建議用 fine-grained token、只授權這一個 repo 的 Contents 讀寫，並設定到期日。
        </div>

        {msg && (
          <div
            style={{
              fontSize: 12.5,
              borderRadius: 8,
              padding: '9px 11px',
              marginBottom: 12,
              background: msg.kind === 'err' ? '#fdf3f4' : msg.kind === 'ok' ? '#e9f9f1' : '#eef1fe',
              color: msg.kind === 'err' ? '#b0535e' : msg.kind === 'ok' ? '#0a7a55' : '#3a5bd0',
            }}
          >
            {msg.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={connect}
            disabled={busy}
            className="reset-btn"
            style={{ flex: 1, height: 40, borderRadius: 10, background: '#1b1b22', color: '#fff', fontSize: 13.5, fontWeight: 700, opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {busy && <span className="spinner" style={{ borderTopColor: '#fff' }} />}
            {storeRepo ? '重新連線並同步' : '連線並同步'}
          </button>
          {storeRepo && (
            <button onClick={doDisconnect} className="reset-btn" style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', color: '#6a6a74', fontSize: 13.5, fontWeight: 600 }}>
              中斷
            </button>
          )}
        </div>

        <div style={{ height: 1, background: 'rgba(0,0,0,.06)', margin: '20px 0' }} />

        {/* import */}
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>匯入</div>
        <button
          onClick={openImport}
          className="reset-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', background: '#fff', color: '#3a3a44', fontSize: 13, fontWeight: 600 }}
        >
          <ImportIcon size={16} /> 從 Heptabase 匯入
        </button>

        <div style={{ height: 1, background: 'rgba(0,0,0,.06)', margin: '20px 0' }} />

        {/* AI (future) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          <SparkleIcon size={14} style={{ color: '#7048e8' }} /> AI（Claude）
        </div>
        <div style={{ fontSize: 11.5, color: '#9a9aa4', lineHeight: 1.6, marginBottom: 10 }}>
          {storeAnthropicKey
            ? '已啟用 Claude：AI 搜尋、連結建議、日記擷取與自動分類使用語意理解（瀏覽器直連，key 只存本機 IndexedDB）。'
            : '目前 AI 搜尋與連結建議使用本機關鍵字比對。貼上 Anthropic API key 即可改用 Claude 做語意理解（瀏覽器直連，key 只存本機）。'}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <input
            style={{ ...input, flex: 1, fontFamily: 'Space Mono, monospace' }}
            value={aiKey}
            onChange={(e) => setAiKeyLocal(e.target.value)}
            placeholder="sk-ant-…"
            type="password"
          />
          <button
            onClick={() => void saveAiKey()}
            disabled={aiBusy}
            className="reset-btn"
            style={{ height: 40, padding: '0 16px', borderRadius: 10, background: '#7048e8', color: '#fff', fontSize: 13, fontWeight: 700, opacity: aiBusy ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {aiBusy && <span className="spinner" style={{ borderTopColor: '#fff' }} />}
            {aiBusy ? '驗證中…' : storeAnthropicKey ? '更新' : '啟用'}
          </button>
          {storeAnthropicKey && (
            <button
              onClick={disableAi}
              className="reset-btn"
              style={{ height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', color: '#6a6a74', fontSize: 13, fontWeight: 600 }}
            >
              停用
            </button>
          )}
        </div>
        {aiMsg && (
          <div
            style={{
              fontSize: 12.5,
              borderRadius: 8,
              padding: '9px 11px',
              background: aiMsg.kind === 'err' ? '#fdf3f4' : aiMsg.kind === 'ok' ? '#e9f9f1' : '#eef1fe',
              color: aiMsg.kind === 'err' ? '#b0535e' : aiMsg.kind === 'ok' ? '#0a7a55' : '#3a5bd0',
            }}
          >
            {aiMsg.text}
          </div>
        )}
      </div>
    </Modal>
  );
}
