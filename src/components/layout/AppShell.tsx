import type { ReactNode } from 'react';
import { useStore } from '@/store';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { LeftRail } from './LeftRail';
import { TopBar } from './TopBar';
import { BottomTabBar } from './BottomTabBar';
import { DetailHost } from './DetailHost';
import { Sheet } from '@/components/common/Sheet';
import { AiSuggestionsContent } from '@/components/panels/AiSuggestionsContent';
import { SyncStatusContent } from '@/components/panels/SyncStatusContent';

function Popover({ onClose, title, width, children }: { onClose: () => void; title: string; width: number; children: ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 50 }} />
      <div
        className="anim-pop"
        style={{
          position: 'absolute',
          top: 62,
          right: 16,
          width,
          maxWidth: 'calc(100vw - 32px)',
          background: '#fff',
          border: '1px solid #ece6fb',
          borderRadius: 16,
          boxShadow: '0 18px 50px rgba(80,40,180,.16)',
          zIndex: 55,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} className="reset-btn" style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(0,0,0,.05)', color: '#7a7a84', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const view = useStore((s) => s.view);
  const aiPanelOpen = useStore((s) => s.aiPanelOpen);
  const toggleAiPanel = useStore((s) => s.toggleAiPanel);
  const syncOpen = useStore((s) => s.syncOpen);
  const toggleSync = useStore((s) => s.toggleSync);

  return (
    <div style={{ position: 'relative', display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden', background: 'var(--bg)' }}>
      {!isMobile && <LeftRail />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <TopBar isMobile={isMobile} />
        <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>{children}</div>
        {isMobile && <BottomTabBar />}

        {!isMobile && aiPanelOpen && view === 'whiteboard' && (
          <Popover onClose={toggleAiPanel} title="AI 連結建議" width={340}>
            <AiSuggestionsContent />
          </Popover>
        )}
        {!isMobile && syncOpen && (
          <Popover onClose={() => toggleSync(false)} title="GitHub 同步" width={300}>
            <SyncStatusContent />
          </Popover>
        )}
      </div>

      <DetailHost />

      {isMobile && aiPanelOpen && view === 'whiteboard' && (
        <Sheet onClose={toggleAiPanel} title="AI 連結建議">
          <AiSuggestionsContent />
        </Sheet>
      )}
      {isMobile && syncOpen && (
        <Sheet onClose={() => toggleSync(false)} title="GitHub 同步">
          <SyncStatusContent />
        </Sheet>
      )}
    </div>
  );
}
