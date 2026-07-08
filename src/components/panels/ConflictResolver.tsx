import { useState } from 'react';
import { useStore } from '@/store';
import type { ConflictChoice, ConflictResolution } from '@/types';
import { resolveConflictsAndSync } from '@/sync/syncEngine';
import { parseCard, parseProject, cardIdFromPath, projectIdFromPath, diaryDateFromPath } from '@/serialization';
import { Modal } from '@/components/common/Modal';

const KIND_LABEL: Record<string, string> = { card: '卡片', link: '連結', project: '專案', diary: '日記' };

function summary(kind: string, path: string, content: string): string {
  try {
    if (kind === 'card') return parseCard(content, cardIdFromPath(path)).title;
    if (kind === 'project') return parseProject(content, projectIdFromPath(path)).name;
    if (kind === 'diary') return diaryDateFromPath(path);
  } catch {
    /* ignore */
  }
  return content.slice(0, 80) || '（已刪除）';
}

export function ConflictResolver() {
  const open = useStore((s) => s.conflictOpen);
  const conflicts = useStore((s) => s.conflicts);
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({});
  const [busy, setBusy] = useState(false);

  if (!open || conflicts.length === 0) return null;

  const choiceFor = (path: string): ConflictChoice => choices[path] ?? 'keep-both';

  async function apply() {
    setBusy(true);
    try {
      const resolutions: ConflictResolution[] = conflicts.map((c) => ({ path: c.path, choice: choiceFor(c.path) }));
      await resolveConflictsAndSync(resolutions);
    } finally {
      setBusy(false);
    }
  }

  const options: { value: ConflictChoice; label: string }[] = [
    { value: 'keep-both', label: '兩個都留' },
    { value: 'ours', label: '用本機版' },
    { value: 'theirs', label: '用雲端版' },
  ];

  return (
    <Modal onClose={() => {}} width={600}>
      <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>同步衝突 · {conflicts.length}</div>
        <div style={{ fontSize: 12, color: '#9a9aa4', marginTop: 4 }}>
          這些項目在兩個裝置上都改過。預設「兩個都留」，絕不自動覆蓋你的資料。
        </div>
      </div>

      <div className="scrl" style={{ overflowY: 'auto', padding: '14px 22px', maxHeight: '52vh' }}>
        {conflicts.map((c) => (
          <div key={c.path} style={{ border: '1px solid rgba(0,0,0,.09)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7048e8', background: '#f3f0ff', padding: '2px 8px', borderRadius: 6 }}>
                {KIND_LABEL[c.kind] ?? c.kind}
              </span>
              <span className="mono" style={{ fontSize: 11, color: '#a8a8b0' }}>{c.path}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ background: '#f7f9ff', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10.5, color: '#9a9aa4', marginBottom: 3 }}>本機版</div>
                <div style={{ fontSize: 12.5, color: '#2a2a32', fontWeight: 600 }}>{summary(c.kind, c.path, c.ours)}</div>
              </div>
              <div style={{ background: '#f6f9f6', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10.5, color: '#9a9aa4', marginBottom: 3 }}>雲端版</div>
                <div style={{ fontSize: 12.5, color: '#2a2a32', fontWeight: 600 }}>{summary(c.kind, c.path, c.theirs)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {options.map((o) => {
                const active = choiceFor(c.path) === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setChoices((prev) => ({ ...prev, [c.path]: o.value }))}
                    className="reset-btn"
                    style={{
                      flex: 1,
                      height: 32,
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: active ? '1px solid #c9d4fb' : '1px solid rgba(0,0,0,.1)',
                      background: active ? '#eef1fe' : '#fff',
                      color: active ? '#2a3a8a' : '#6a6a74',
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(0,0,0,.07)', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={apply}
          disabled={busy}
          className="reset-btn"
          style={{ height: 38, padding: '0 20px', borderRadius: 10, background: '#1b1b22', color: '#fff', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}
        >
          {busy && <span className="spinner" style={{ borderTopColor: '#fff' }} />}
          套用並同步
        </button>
      </div>
    </Modal>
  );
}
