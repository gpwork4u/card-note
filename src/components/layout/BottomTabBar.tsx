import { useStore } from '@/store';
import type { ViewName } from '@/types';
import { WhiteboardIcon, LibraryIcon, KanbanIcon, DiaryIcon, SearchIcon } from '@/components/common/icons';

const NAV: { view: ViewName; label: string; Icon: typeof WhiteboardIcon }[] = [
  { view: 'whiteboard', label: '白板', Icon: WhiteboardIcon },
  { view: 'library', label: '卡片庫', Icon: LibraryIcon },
  { view: 'kanban', label: '看板', Icon: KanbanIcon },
  { view: 'diary', label: '日記', Icon: DiaryIcon },
];

export function BottomTabBar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const openSearch = useStore((s) => s.openSearch);

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
        background: 'rgba(251,250,247,.95)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(0,0,0,.07)',
        paddingBottom: 'var(--safe-bottom)',
        zIndex: 30,
      }}
    >
      {NAV.map(({ view: v, label, Icon }) => {
        const active = view === v;
        return (
          <button
            key={v}
            onClick={() => setView(v)}
            className="reset-btn"
            style={{
              flex: 1,
              height: 54,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              color: active ? 'var(--accent)' : '#9a9aa4',
            }}
          >
            <Icon size={21} />
            <span style={{ fontSize: 10, letterSpacing: 0.3 }}>{label}</span>
          </button>
        );
      })}
      <button
        onClick={openSearch}
        className="reset-btn"
        style={{
          flex: 1,
          height: 54,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          color: '#7048e8',
        }}
      >
        <SearchIcon size={21} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>AI</span>
      </button>
    </div>
  );
}
