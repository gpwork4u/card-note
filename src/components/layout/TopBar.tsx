import { useStore } from '@/store';
import { GithubIcon, PlusIcon, SettingsIcon } from '@/components/common/icons';

const TITLES: Record<string, string> = {
  whiteboard: '我的白板',
  library: '卡片庫',
  kanban: '看板',
  diary: '日記',
};

const SYNC_DOT: Record<string, string> = {
  ready: '#0ca678',
  unconfigured: '#b0b0b8',
  conflict: '#e8590c',
  error: '#e03131',
  pushing: '#4263eb',
  pulling: '#4263eb',
};

export function TopBar({ isMobile }: { isMobile: boolean }) {
  const view = useStore((s) => s.view);
  const cards = useStore((s) => s.cards);
  const links = useStore((s) => s.links);
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const syncStatus = useStore((s) => s.syncStatus);
  const toggleSync = useStore((s) => s.toggleSync);
  const toggleAiPanel = useStore((s) => s.toggleAiPanel);
  const openSettings = useStore((s) => s.openSettings);
  const addCard = useStore((s) => s.addCard);
  const selectCard = useStore((s) => s.selectCard);
  const createCardOnBoard = useStore((s) => s.createCardOnBoard);
  const activeBoardId = useStore((s) => s.activeBoardId);
  const boards = useStore((s) => s.boards);

  const solidCount = links.filter((l) => l.type === 'solid').length;
  const aiCount = links.filter((l) => l.type === 'ai').length;
  const proj = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? boards[0];
  const title = view === 'whiteboard' ? (activeBoard?.name ?? '白板') : TITLES[view];

  const sub =
    view === 'whiteboard'
      ? `${activeBoard?.placements.length ?? 0} 張卡片 · 共 ${cards.length} 張`
      : view === 'library'
        ? `${cards.length} 張卡片`
        : view === 'kanban'
          ? proj
            ? `${proj.name} · ${proj.cols.todo.length + proj.cols.doing.length + proj.cols.done.length} 張卡片`
            : '尚無專案'
          : '日記';

  function addNewCard() {
    // on the whiteboard, drop the new card straight onto the active board
    if (view === 'whiteboard' && activeBoardId) {
      const id = createCardOnBoard(activeBoardId, { title: '新卡片', type: 'idea', body: '' });
      selectCard(id);
    } else {
      const id = addCard({ title: '新卡片', type: 'idea', body: '' });
      selectCard(id);
    }
  }

  return (
    <div
      style={{
        height: 'var(--topbar-h)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        paddingTop: isMobile ? 'var(--safe-top)' : 0,
        gap: 12,
        borderBottom: '1px solid rgba(0,0,0,.06)',
        background: 'rgba(251,250,247,.86)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>{title}</span>
        {!isMobile && (
          <span style={{ fontSize: 12.5, color: '#9a9aa4', whiteSpace: 'nowrap' }}>{sub}</span>
        )}
      </div>
      <div style={{ flex: 1 }} />

      {/* AI suggestions pill (whiteboard only) */}
      {view === 'whiteboard' && aiCount > 0 && (
        <button
          onClick={toggleAiPanel}
          className="reset-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 34,
            padding: isMobile ? '0 10px' : '0 13px',
            borderRadius: 999,
            border: '1px solid #e3dcfb',
            background: '#f3f0ff',
            color: '#6438d6',
            fontSize: 13,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#7048e8', animation: 'pulse 1.8s infinite' }} />
          {isMobile ? aiCount : `AI 建議了 ${aiCount} 個連結`}
        </button>
      )}

      {/* add card */}
      <button
        onClick={addNewCard}
        className="reset-btn"
        title="新增卡片"
        style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(0,0,0,.08)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a3a44' }}
      >
        <PlusIcon size={18} />
      </button>

      {/* sync */}
      <button
        onClick={() => toggleSync()}
        className="reset-btn"
        title="GitHub 同步"
        style={{ display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 12px', borderRadius: 9, border: '1px solid rgba(0,0,0,.08)', background: '#fff' }}
      >
        <GithubIcon size={16} />
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: SYNC_DOT[syncStatus] ?? '#4263eb' }} />
        {!isMobile && (
          <span style={{ fontSize: 12.5, color: '#5a6072', fontWeight: 500 }}>
            {syncStatus === 'ready' ? '已同步' : syncStatus === 'unconfigured' ? '本機' : syncStatus === 'conflict' ? '有衝突' : '同步'}
          </span>
        )}
      </button>

      {/* settings (mobile: rail is hidden) */}
      {isMobile && (
        <button onClick={openSettings} className="reset-btn" title="設定" style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6a6a74' }}>
          <SettingsIcon size={19} />
        </button>
      )}
    </div>
  );
}
