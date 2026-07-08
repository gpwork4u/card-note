import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { bootstrap } from '@/store/persist';
import { configureApi } from '@/sync/syncEngine';
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

export default function App() {
  const [ready, setReady] = useState(false);
  const view = useStore((s) => s.view);

  useEffect(() => {
    void (async () => {
      await bootstrap();
      const st = useStore.getState();
      if (st.repo && st.pat) {
        configureApi(st.repo, st.pat);
        st.setSyncStatus('ready');
      }
      setReady(true);
    })();
  }, []);

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
