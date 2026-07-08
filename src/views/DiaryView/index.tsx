import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import type { DiaryEntry } from '@/types';
import { CARD_TYPES } from '@/lib/tokens';
import { mdDisplay, weekdayLabel, todayISO } from '@/lib/format';
import { SparkleIcon } from '@/components/common/icons';
import { aiExtractDiary } from '@/ai';

/** < 640px → phone layout (self-contained matchMedia hook) */
function useIsPhone(): boolean {
  const query = '(max-width: 639px)';
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setPhone(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return phone;
}

/** Top "today" composer — local controlled state, commits on blur / "記下" button. */
function Composer({ hideHint }: { hideHint: boolean }) {
  const addDiaryEntry = useStore((s) => s.addDiaryEntry);
  const [text, setText] = useState('');

  const today = todayISO();

  const commit = () => {
    if (!text.trim()) return;
    addDiaryEntry(text);
    setText('');
  };

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,.08)',
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 22,
        boxShadow: '0 2px 10px rgba(0,0,0,.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#3a3a44' }}>
          今天 · {mdDisplay(today)}
          {weekdayLabel(today)}
        </span>
        <span style={{ flex: 1 }} />
        {!hideHint && (
          <span style={{ fontSize: 11.5, color: '#9a9aa4' }}>寫下想法，AI 幫你抽成卡片</span>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder="隨手記點什麼…"
        style={{
          width: '100%',
          minHeight: 48,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          resize: 'vertical',
          fontFamily: 'inherit',
          fontSize: 13.5,
          lineHeight: 1.6,
          color: '#3a3a44',
        }}
      />

      {text.trim() !== '' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            style={{
              height: 30,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: '#6438d6',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            記下
          </button>
        </div>
      )}
    </div>
  );
}

/** A single diary entry: date separator + content card (processed / unprocessed). */
function EntryCard({
  entry,
  processing,
  onExtract,
}: {
  entry: DiaryEntry;
  processing: boolean;
  onExtract: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      {/* date separator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#3a3a44' }}>
          {mdDisplay(entry.date)}
        </span>
        <span style={{ fontSize: 11.5, color: '#a8a8b0' }}>{weekdayLabel(entry.date)}</span>
        <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,.06)' }} />
      </div>

      {/* content card */}
      <div
        style={{
          background: '#fff',
          border: '1px solid rgba(0,0,0,.07)',
          borderRadius: 13,
          padding: '16px 18px',
        }}
      >
        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.75,
            color: '#3a3a44',
            whiteSpace: 'pre-line',
          }}
        >
          {entry.text}
        </div>

        {entry.processed ? (
          <div
            style={{
              marginTop: 14,
              paddingTop: 13,
              borderTop: '1px dashed rgba(112,72,232,.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                fontWeight: 700,
                color: '#6438d6',
                marginBottom: 9,
              }}
            >
              <SparkleIcon size={13} />
              <span>AI 從這篇抽出 {entry.extracted.length} 張卡片</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entry.extracted.map((ex, i) => (
                <div
                  key={ex.id ?? `${entry.id}-${i}`}
                  className="anim-pop"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    background: '#faf9ff',
                    border: '1px solid #ece6fb',
                    borderRadius: 10,
                    padding: '10px 12px',
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: CARD_TYPES[ex.type].color,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2a2a32' }}>
                      {ex.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#9a9aa4', marginTop: 2 }}>
                      {CARD_TYPES[ex.type].label}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#0ca678',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    已加入卡片庫
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={processing}
            onClick={() => onExtract(entry.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              marginTop: 13,
              height: 34,
              padding: '0 14px',
              borderRadius: 9,
              border: '1px solid #e3dcfb',
              background: '#f3f0ff',
              color: '#6438d6',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: processing ? 'default' : 'pointer',
            }}
          >
            {processing ? (
              <>
                <span className="spinner" style={{ width: 13, height: 13 }} />
                <span>整理中…</span>
              </>
            ) : (
              <>
                <SparkleIcon size={14} />
                <span>AI 整理成卡片</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DiaryView() {
  const diary = useStore((s) => s.diary);
  const isPhone = useIsPhone();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [extractError, setExtractError] = useState<string | null>(null);

  const handleExtract = async (id: string) => {
    // guard: skip if this entry is already being processed or already processed
    if (processingIds.has(id)) return;
    const entry = diary.find((d) => d.id === id);
    if (!entry || entry.processed) return;

    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setExtractError(null);
    try {
      await aiExtractDiary(id);
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div
      className="scrl"
      style={{ height: '100%', overflowY: 'auto', padding: '26px 32px 60px' }}
    >
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Composer hideHint={isPhone} />

        {extractError && (
          <div style={{ fontSize: 12, color: '#b0535e', background: '#fdf3f4', border: '1px solid #f6e0e2', borderRadius: 8, padding: '8px 10px', marginBottom: 14 }}>
            AI 擷取失敗：{extractError}
          </div>
        )}

        {diary.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#9a9aa4',
              fontSize: 13,
              padding: '48px 0',
            }}
          >
            還沒有日記，從上面寫下第一則想法吧。
          </div>
        ) : (
          diary.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              processing={processingIds.has(entry.id)}
              onExtract={handleExtract}
            />
          ))
        )}
      </div>
    </div>
  );
}
