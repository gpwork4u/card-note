import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store';
import type { KanbanColumn, Project } from '@/types';
import { enrichCard } from '@/lib/derive';
import { KANBAN_COLUMNS } from '@/lib/tokens';
import { PlusIcon } from '@/components/common/icons';
import { KanbanCardItem, type EnrichedCard } from './KanbanCardItem';

/** local (<640px) detection — keeps imports within the allowed set */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    const handler = () => setMobile(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return mobile;
}

function projectCount(p: Project): number {
  return p.cols.todo.length + p.cols.doing.length + p.cols.done.length;
}

// ---------------------------------------------------------------- tabs

function ProjectTabs({
  projects,
  activeId,
  onSelect,
  onNew,
}: {
  projects: Project[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        padding: '14px 28px 2px',
        flexShrink: 0,
      }}
    >
      {projects.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            className="reset-btn"
            onClick={() => onSelect(p.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              height: 34,
              padding: '0 14px',
              borderRadius: 10,
              border: active ? '1px solid #c9d4fb' : '1px solid rgba(0,0,0,.08)',
              background: active ? '#eef1fe' : '#fff',
              color: active ? '#2a3a8a' : '#6a6a74',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: p.color,
                flexShrink: 0,
              }}
            />
            {p.name}
            <span
              style={{
                fontSize: 11,
                color: '#a8a8b0',
                background: 'rgba(0,0,0,.04)',
                padding: '0 6px',
                borderRadius: 6,
              }}
            >
              {projectCount(p)}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        className="reset-btn"
        onClick={onNew}
        style={{
          height: 34,
          padding: '0 13px',
          borderRadius: 10,
          border: '1px dashed rgba(0,0,0,.18)',
          background: 'transparent',
          color: '#8a8a94',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + 新增專案
      </button>
    </div>
  );
}

// -------------------------------------------------------------- column

function KanbanColumnView({
  col,
  projectId,
  cards,
  count,
  isMobile,
}: {
  col: (typeof KANBAN_COLUMNS)[number];
  projectId: string;
  cards: EnrichedCard[];
  count: number;
  isMobile: boolean;
}) {
  const moveKanbanCard = useStore((s) => s.moveKanbanCard);
  const addCard = useStore((s) => s.addCard);
  const selectCard = useStore((s) => s.selectCard);
  const [over, setOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { cardId: string; from: KanbanColumn };
      if (data.cardId && data.from && data.from !== col.id) {
        moveKanbanCard(projectId, data.cardId, data.from, col.id);
      }
    } catch {
      /* ignore malformed drag payloads */
    }
  };

  const handleAdd = () => {
    const id = addCard({ title: '新卡片', type: 'idea' });
    // store has no "add card to a project column" action; moveKanbanCard's removal
    // from `from` is a no-op for a card not yet placed, so we use a different `from`
    // to push the fresh card straight into this column, then open it for editing.
    const from: KanbanColumn = col.id === 'todo' ? 'doing' : 'todo';
    moveKanbanCard(projectId, id, from, col.id);
    selectCard(id);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        // only clear when actually leaving the column box
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={handleDrop}
      style={{
        width: isMobile ? '80vw' : 288,
        flexShrink: 0,
        background: '#fbfaf7',
        border: over ? '1px solid #c9d4fb' : '1px solid rgba(0,0,0,.06)',
        boxShadow: over ? '0 0 0 3px rgba(66,99,235,.08)' : 'none',
        borderRadius: 14,
        padding: 13,
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color .12s, box-shadow .12s',
      }}
    >
      {/* column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 3,
            background: col.color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#33333a' }}>{col.title}</span>
        <span
          style={{
            fontSize: 11.5,
            color: '#a8a8b0',
            background: '#fff',
            border: '1px solid rgba(0,0,0,.06)',
            padding: '1px 7px',
            borderRadius: 7,
          }}
        >
          {count}
        </span>
      </div>

      {/* card list */}
      <div
        className="scrl"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          overflowY: 'auto',
          minHeight: 0,
          flex: '1 1 auto',
          marginTop: 11,
        }}
      >
        {cards.map((card) => (
          <KanbanCardItem key={card.id} card={card} currentCol={col.id} projectId={projectId} />
        ))}
      </div>

      {/* add card */}
      <button
        type="button"
        className="reset-btn"
        onClick={handleAdd}
        style={{
          marginTop: 10,
          height: 32,
          flexShrink: 0,
          border: '1px dashed rgba(0,0,0,.14)',
          background: 'transparent',
          borderRadius: 9,
          color: '#a8a8b0',
          fontSize: 12.5,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width: '100%',
        }}
      >
        <PlusIcon size={13} /> 新增卡片
      </button>
    </div>
  );
}

// ------------------------------------------------------------- empty state

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: '#8a8a94',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600 }}>還沒有專案</div>
      <button
        type="button"
        className="reset-btn"
        onClick={onNew}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          height: 38,
          padding: '0 18px',
          borderRadius: 10,
          border: '1px solid #c9d4fb',
          background: '#eef1fe',
          color: '#2a3a8a',
          fontSize: 13.5,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <PlusIcon size={15} /> 新增專案
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- view

export default function KanbanView() {
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const cards = useStore((s) => s.cards);
  const links = useStore((s) => s.links);
  const selectProject = useStore((s) => s.selectProject);
  const openNewProj = useStore((s) => s.openNewProj);
  const isMobile = useIsMobile();

  const cardMap = useMemo(
    () => new Map<string, EnrichedCard>(cards.map((c) => [c.id, enrichCard(c, links)])),
    [cards, links],
  );

  const proj = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {!proj ? (
        <EmptyState onNew={openNewProj} />
      ) : (
        <>
          <ProjectTabs
            projects={projects}
            activeId={proj.id}
            onSelect={selectProject}
            onNew={openNewProj}
          />

          <div
            className="scrl"
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              padding: '18px 28px 24px',
            }}
          >
            <div style={{ display: 'flex', gap: 18, height: '100%', alignItems: 'flex-start' }}>
              {KANBAN_COLUMNS.map((col) => {
                const ids = proj.cols[col.id];
                const colCards = ids
                  .map((id) => cardMap.get(id))
                  .filter((c): c is EnrichedCard => c !== undefined);
                return (
                  <KanbanColumnView
                    key={col.id}
                    col={col}
                    projectId={proj.id}
                    cards={colCards}
                    count={ids.length}
                    isMobile={isMobile}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
