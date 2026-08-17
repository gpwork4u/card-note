import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { bootstrap } from '@/store/persist';
import { requestPrimaryTab, waitForPrimaryTab } from '@/lib/tabLock';
import { configureApi } from '@/sync/syncEngine';
import { startAutoSync } from '@/sync/autoSync';
import { setProvider } from '@/ai';
import { ClaudeProvider } from '@/ai/claude';
import { AppShell } from '@/components/layout/AppShell';
import WhiteboardView from '@/views/WhiteboardView';
import LibraryView from '@/views/LibraryView';
import KanbanView from '@/views/KanbanView';
import DiaryView from '@/views/DiaryView';
import { AiSearchOverlay } from '@/components/panels/AiSearchOverlay';
import { SettingsDialog } from '@/components/panels/SettingsDialog';
import { ImportDialog } from '@/components/panels/ImportDialog';
import { ConflictResolver } from '@/components/panels/ConflictResolver';
import { NewProjectModal } from '@/components/panels/NewProjectModal';
import { AddToBoardModal } from '@/components/panels/AddToBoardModal';

function Splash() {
  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: 'var(--bg)' }}>
      <div style={{ width: 52, height: 52, borderRadius: 15, background: 'linear-gradient(150deg,#4263eb,#7048e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 24, boxShadow: '0 6px 18px rgba(66,99,235,.32)' }}>
        卡
      </div>
      <span style={{ fontSize: 13, color: '#9a9aa4' }}>載入中…</span>
    </div>
  );
}

/** 已有另一個分頁在跑：待命，不碰 IndexedDB 也不同步，等對方關閉再自動接手。 */
function Standby() {
  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, background: 'var(--bg)', padding: 24, textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 15, background: 'linear-gradient(150deg,#4263eb,#7048e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 24, boxShadow: '0 6px 18px rgba(66,99,235,.32)' }}>
        卡
      </div>
      <strong style={{ fontSize: 15 }}>已在另一個分頁開啟</strong>
      <span style={{ fontSize: 13, color: '#9a9aa4', maxWidth: 320, lineHeight: 1.6 }}>
        為了避免兩個分頁同時同步而覆蓋彼此的編輯，這個分頁先待命。關閉另一個分頁後，這裡會自動接手。
      </span>
    </div>
  );
}

/** StrictMode 會把掛載 effect 跑兩次；啟動只能有一輪，否則會重複訂閱與重複自動同步。 */
let booting: Promise<void> | null = null;

export default function App() {
  const [ready, setReady] = useState(false);
  const [standby, setStandby] = useState(false);
  const view = useStore((s) => s.view);

  useEffect(() => {
    booting ??= (async () => {
      // 唯一作用中分頁才啟動：其餘分頁待命，等鎖釋放後再走同一段流程
      if (!(await requestPrimaryTab())) {
        setStandby(true);
        await waitForPrimaryTab();
        setStandby(false);
      }
      await bootstrap();
      const st = useStore.getState();
      if (st.repo && st.pat) {
        configureApi(st.repo, st.pat);
        st.setSyncStatus('ready');
      }
      if (st.anthropicKey) {
        setProvider(new ClaudeProvider(st.anthropicKey));
      }
      startAutoSync();
    })();
    void booting.then(() => setReady(true));
  }, []);

  if (standby) return <Standby />;
  if (!ready) return <Splash />;

  return (
    <>
      <AppShell>
        {view === 'whiteboard' && <WhiteboardView />}
        {view === 'library' && <LibraryView />}
        {view === 'kanban' && <KanbanView />}
        {view === 'diary' && <DiaryView />}
      </AppShell>
      <AiSearchOverlay />
      <SettingsDialog />
      <ImportDialog />
      <ConflictResolver />
      <NewProjectModal />
      <AddToBoardModal />
    </>
  );
}
