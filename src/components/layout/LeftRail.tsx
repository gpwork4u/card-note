import { useStore } from '@/store';
import type { ViewName } from '@/types';
import {
  WhiteboardIcon,
  LibraryIcon,
  KanbanIcon,
  DiaryIcon,
  SearchIcon,
  SettingsIcon,
} from '@/components/common/icons';

const NAV: { view: ViewName; label: string; Icon: typeof WhiteboardIcon }[] = [
  { view: 'whiteboard', label: '白板', Icon: WhiteboardIcon },
  { view: 'library', label: '卡片庫', Icon: LibraryIcon },
  { view: 'kanban', label: '看板', Icon: KanbanIcon },
  { view: 'diary', label: '日記', Icon: DiaryIcon },
];

export function LeftRail() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const openSearch = useStore((s) => s.openSearch);
  const openSettings = useStore((s) => s.openSettings);

  return (
    <div
      style={{
        width: 'var(--rail-w)',
        flexShrink: 0,
        background: 'var(--rail)',
        borderRight: '1px solid rgba(0,0,0,.07)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14px 0',
        gap: 4,
        zIndex: 30,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: 'linear-gradient(150deg,#4263eb,#7048e8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 900,
          fontSize: 18,
          marginBottom: 14,
          boxShadow: '0 4px 12px rgba(66,99,235,.32)',
        }}
      >
        卡
      </div>

      {NAV.map(({ view: v, label, Icon }) => {
        const active = view === v;
        return (
          <button
            key={v}
            onClick={() => setView(v)}
            className="reset-btn"
            title={label}
            style={{
              width: 50,
              height: 52,
              borderRadius: 14,
              background: active ? '#eef1fe' : 'transparent',
              color: active ? 'var(--accent)' : '#9a9aa4',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all .15s',
            }}
          >
            <Icon size={22} />
            <span style={{ fontSize: 10, marginTop: 3, letterSpacing: 0.5 }}>{label}</span>
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      <button
        onClick={openSearch}
        className="reset-btn"
        title="AI 搜尋"
        style={{
          width: 50,
          height: 50,
          borderRadius: 14,
          background: '#f0ecfb',
          color: '#7048e8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <SearchIcon size={20} />
        <span style={{ fontSize: 9, fontWeight: 700 }}>AI</span>
      </button>

      <button
        onClick={openSettings}
        className="reset-btn"
        title="設定"
        style={{
          width: 50,
          height: 44,
          borderRadius: 14,
          color: '#9a9aa4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 4,
        }}
      >
        <SettingsIcon size={20} />
      </button>
    </div>
  );
}
