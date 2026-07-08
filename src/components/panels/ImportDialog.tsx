import { useRef, useState } from 'react';
import { useStore } from '@/store';
import type { AppData } from '@/store';
import type { ImportReport } from '@/types';
import { importFromFile } from '@/importers/heptabase';
import { Modal } from '@/components/common/Modal';
import { ImportIcon } from '@/components/common/icons';

export function ImportDialog() {
  const open = useStore((s) => s.importOpen);
  const close = useStore((s) => s.closeImport);
  const mergeImport = useStore((s) => s.mergeImport);
  const setView = useStore((s) => s.setView);
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [fileName, setFileName] = useState('');

  if (!open) return null;

  function reset() {
    setData(null);
    setReport(null);
    setErr(null);
    setFileName('');
  }

  async function handleFile(file: File) {
    setBusy(true);
    setErr(null);
    setFileName(file.name);
    try {
      const out = await importFromFile(file);
      setData(out.data);
      setReport(out.report);
    } catch (e) {
      setErr('匯入失敗：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  function confirmImport() {
    if (!data) return;
    mergeImport(data);
    reset();
    close();
    setView('whiteboard');
  }

  return (
    <Modal onClose={() => { reset(); close(); }} width={520}>
      <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(0,0,0,.07)', display: 'flex', alignItems: 'center', gap: 9 }}>
        <ImportIcon size={18} />
        <div style={{ fontSize: 16, fontWeight: 700 }}>從 Heptabase 匯入</div>
      </div>

      <div className="scrl" style={{ overflowY: 'auto', padding: '18px 22px 8px' }}>
        <div style={{ fontSize: 12, color: '#9a9aa4', lineHeight: 1.6, marginBottom: 14 }}>
          在 Heptabase 的 Settings → Backup &amp; Sync → Export 匯出，選擇 <b>All-Data.json</b>（含白板座標與連線）或整包 <b>.zip</b>。也支援 Markdown 匯出的 zip。
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".json,.zip,application/json,application/zip"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="reset-btn"
          style={{
            width: '100%',
            border: '1.5px dashed rgba(112,72,232,.4)',
            background: '#faf9ff',
            borderRadius: 12,
            padding: '22px 16px',
            textAlign: 'center',
            color: '#6438d6',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {busy ? (
            <span><span className="spinner" style={{ marginRight: 8, verticalAlign: 'middle' }} /> 解析中…</span>
          ) : fileName ? (
            `已選擇：${fileName}（點此重新選擇）`
          ) : (
            '點此選擇 .json 或 .zip 檔'
          )}
        </button>

        {err && (
          <div style={{ marginTop: 12, fontSize: 12.5, background: '#fdf3f4', color: '#b0535e', borderRadius: 8, padding: '9px 11px' }}>{err}</div>
        )}

        {report && (
          <div style={{ marginTop: 14, background: '#f7f9ff', border: '1px solid #e3e9fb', borderRadius: 11, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>解析結果</div>
            <Stat label="卡片" value={report.cardsImported} />
            <Stat label="連結" value={report.linksImported} />
            {report.connectionsDropped > 0 && <Stat label="略過的連線" value={report.connectionsDropped} dim />}
            {report.instancesSkipped > 0 && <Stat label="略過的項目" value={report.instancesSkipped} dim />}
            {report.lossyCards.length > 0 && (
              <div style={{ fontSize: 11.5, color: '#a08a4a', marginTop: 6 }}>
                {report.lossyCards.length} 張卡片含複雜內容（表格/嵌入等），已盡量轉成純文字。
              </div>
            )}
            {report.warnings.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 11.5, color: '#9a9aa4', cursor: 'pointer' }}>{report.warnings.length} 則警告</summary>
                <div style={{ fontSize: 11, color: '#a8a8b0', marginTop: 6, maxHeight: 120, overflow: 'auto' }}>
                  {report.warnings.slice(0, 50).map((w, i) => (
                    <div key={i}>· {w}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(0,0,0,.07)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => { reset(); close(); }} className="reset-btn" style={{ height: 38, padding: '0 18px', borderRadius: 10, border: '1px solid rgba(0,0,0,.12)', color: '#6a6a74', fontSize: 13.5, fontWeight: 600 }}>
          取消
        </button>
        <button
          onClick={confirmImport}
          disabled={!data || (report?.cardsImported ?? 0) === 0}
          className="reset-btn"
          style={{ height: 38, padding: '0 20px', borderRadius: 10, background: '#1b1b22', color: '#fff', fontSize: 13.5, fontWeight: 700, opacity: data && (report?.cardsImported ?? 0) > 0 ? 1 : 0.5 }}
        >
          加入我的卡片庫
        </button>
      </div>
    </Modal>
  );
}

function Stat({ label, value, dim }: { label: string; value: number; dim?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0', color: dim ? '#9a9aa4' : '#3a3a44' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
