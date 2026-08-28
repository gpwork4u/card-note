import { create } from 'zustand';
import type {
  Board,
  Card,
  CardType,
  CommitInfo,
  Conflict,
  DiaryEntry,
  DiaryExtract,
  ExtractedCard,
  KanbanColumn,
  Link,
  LinkSuggestion,
  Placement,
  Project,
  RepoConfig,
  SyncStatus,
  ViewName,
} from '@/types';
import { seedData } from '@/data/seed';
import { ulid, shortId } from '@/lib/ulid';
import { nowISO, todayISO } from '@/lib/format';
import { PROJECT_PALETTE } from '@/lib/tokens';
import { linkKey } from '@/lib/derive';

export interface AppData {
  cards: Card[];
  links: Link[];
  projects: Project[];
  diary: DiaryEntry[];
  boards: Board[];
}

interface Store {
  // ---- data ----
  cards: Card[];
  links: Link[];
  projects: Project[];
  diary: DiaryEntry[];
  boards: Board[];
  activeProjectId: string | null;
  activeBoardId: string | null;

  // ---- ui ----
  view: ViewName;
  selectedId: string | null;
  detailOpen: boolean;
  aiPanelOpen: boolean;
  searchOpen: boolean;
  syncOpen: boolean;
  settingsOpen: boolean;
  importOpen: boolean;
  conflictOpen: boolean;
  addToBoardOpen: boolean;
  boardManagerOpen: boolean;
  newProjOpen: boolean;
  newProjName: string;
  newProjSel: string[];
  libQuery: string;
  searchQuery: string;
  pan: { x: number; y: number };
  scale: number;
  hydrated: boolean;

  // ---- sync ----
  syncStatus: SyncStatus;
  repo: RepoConfig | null;
  pat: string;
  anthropicKey: string;
  commits: CommitInfo[];
  conflicts: Conflict[];
  syncError: string | null;
  lastSyncedAt: string | null;

  // ---- navigation / ui actions ----
  setView: (v: ViewName) => void;
  selectCard: (id: string) => void;
  closeDetail: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleAiPanel: () => void;
  toggleSync: (open?: boolean) => void;
  openSettings: () => void;
  closeSettings: () => void;
  openImport: () => void;
  closeImport: () => void;
  setLibQuery: (q: string) => void;
  setSearchQuery: (q: string) => void;
  closeAllOverlays: () => void;

  // ---- whiteboard ----
  setPan: (p: { x: number; y: number }) => void;
  setScale: (s: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  moveCard: (id: string, x: number, y: number) => void;

  // ---- boards (whiteboards) ----
  selectBoard: (id: string) => void;
  createBoard: (name?: string) => string;
  renameBoard: (id: string, name: string) => void;
  deleteBoard: (id: string) => void;
  addCardToBoard: (boardId: string, cardId: string, pos?: { x: number; y: number }) => void;
  addCardsToBoard: (boardId: string, cardIds: string[]) => void;
  removeCardFromBoard: (boardId: string, cardId: string) => void;
  moveCardOnBoard: (boardId: string, cardId: string, x: number, y: number) => void;
  createCardOnBoard: (
    boardId: string,
    input: { title: string; type: CardType; body?: string },
    pos?: { x: number; y: number },
  ) => string;
  reorderBoards: (orderedIds: string[]) => void;
  setBoardArchived: (id: string, archived: boolean) => void;
  openAddToBoard: () => void;
  closeAddToBoard: () => void;
  openBoardManager: () => void;
  closeBoardManager: () => void;
  migrateDefaultBoard: () => void;

  // ---- cards ----
  addCard: (input: Partial<Card> & { title: string; type: CardType }) => string;
  updateCard: (id: string, patch: Partial<Card>) => void;
  deleteCard: (id: string) => void;

  // ---- links ----
  addLink: (a: string, b: string) => void;
  removeLink: (a: string, b: string) => void;
  acceptLink: (a: string, b: string) => void;
  dismissLink: (a: string, b: string) => void;
  setAiSuggestions: (suggestions: LinkSuggestion[]) => void;

  // ---- diary ----
  addDiaryEntry: (text: string) => string;
  updateDiary: (id: string, patch: Partial<DiaryEntry>) => void;
  applyDiaryExtraction: (entryId: string, extracted: ExtractedCard[]) => void;

  // ---- projects ----
  selectProject: (id: string) => void;
  openNewProj: () => void;
  closeNewProj: () => void;
  setNewProjName: (n: string) => void;
  toggleNewProjCard: (id: string) => void;
  createProject: () => void;
  moveKanbanCard: (projectId: string, cardId: string, from: KanbanColumn, to: KanbanColumn) => void;
  removeCardFromProject: (projectId: string, cardId: string) => void;

  // ---- sync state ----
  setSyncStatus: (s: SyncStatus) => void;
  setRepo: (r: RepoConfig | null) => void;
  setPat: (p: string) => void;
  setAnthropicKey: (k: string) => void;
  setCommits: (c: CommitInfo[]) => void;
  setConflicts: (c: Conflict[]) => void;
  setSyncError: (e: string | null) => void;
  markSynced: () => void;

  // ---- data lifecycle ----
  hydrate: (data: Partial<AppData> & { activeProjectId?: string | null }) => void;
  mergeImport: (data: AppData) => void;
  getData: () => AppData;
}

function placeCascade(index: number, base = { x: 160, y: 140 }): { x: number; y: number } {
  return { x: base.x + (index % 5) * 36 + Math.floor(index / 5) * 240, y: base.y + (index % 5) * 32 };
}

/** the board the whiteboard should fall back to: first non-archived, else none */
function firstVisibleBoardId(boards: Board[]): string | null {
  return boards.find((b) => !b.archived)?.id ?? null;
}

export const useStore = create<Store>((set, get) => {
  const seed = seedData();
  return {
    // data
    cards: seed.cards,
    links: seed.links,
    projects: seed.projects,
    diary: seed.diary,
    boards: seed.boards,
    activeProjectId: seed.projects[0]?.id ?? null,
    activeBoardId: seed.boards[0]?.id ?? null,

    // ui
    view: 'whiteboard',
    selectedId: null,
    detailOpen: false,
    aiPanelOpen: false,
    searchOpen: false,
    syncOpen: false,
    settingsOpen: false,
    importOpen: false,
    conflictOpen: false,
    addToBoardOpen: false,
    boardManagerOpen: false,
    newProjOpen: false,
    newProjName: '',
    newProjSel: [],
    libQuery: '',
    searchQuery: '',
    pan: { x: 60, y: 40 },
    scale: 1,
    hydrated: false,

    // sync
    syncStatus: 'unconfigured',
    repo: null,
    pat: '',
    anthropicKey: '',
    commits: [],
    conflicts: [],
    syncError: null,
    lastSyncedAt: null,

    // navigation
    setView: (v) =>
      set((s) => ({
        view: v,
        aiPanelOpen: false,
        searchOpen: false,
        syncOpen: false,
        detailOpen: v === 'whiteboard' ? s.detailOpen : s.detailOpen, // keep detail across views
      })),
    selectCard: (id) => set({ selectedId: id, detailOpen: true }),
    closeDetail: () => set({ detailOpen: false, selectedId: null }),
    openSearch: () => set({ searchOpen: true }),
    closeSearch: () => set({ searchOpen: false }),
    toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
    toggleSync: (open) => set((s) => ({ syncOpen: open ?? !s.syncOpen })),
    openSettings: () => set({ settingsOpen: true, syncOpen: false }),
    closeSettings: () => set({ settingsOpen: false }),
    openImport: () => set({ importOpen: true, settingsOpen: false }),
    closeImport: () => set({ importOpen: false }),
    setLibQuery: (q) => set({ libQuery: q }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    closeAllOverlays: () =>
      set({ searchOpen: false, aiPanelOpen: false, syncOpen: false, settingsOpen: false, importOpen: false }),

    // whiteboard
    setPan: (p) => set({ pan: p }),
    setScale: (s) => set({ scale: s }),
    zoomIn: () => set((s) => ({ scale: Math.min(1.6, +(s.scale + 0.15).toFixed(2)) })),
    zoomOut: () => set((s) => ({ scale: Math.max(0.5, +(s.scale - 0.15).toFixed(2)) })),
    zoomReset: () => set({ scale: 1, pan: { x: 60, y: 40 } }),
    moveCard: (id, x, y) =>
      set((s) => ({
        cards: s.cards.map((c) => (c.id === id ? { ...c, x, y, updated: nowISO() } : c)),
      })),

    // boards (whiteboards)
    selectBoard: (id) => set({ activeBoardId: id }),
    createBoard: (name) => {
      const id = shortId('b');
      // The new board needs an explicit order, or a sync round-trip would
      // reshuffle it (ids are random and parseAll falls back to id order).
      // But an explicit order also sorts BEFORE every board that has none, so
      // giving one board an order while others have none would jump the new
      // board to the front. Normalise the whole list instead.
      set((s) => {
        const normalized = s.boards.map((b, i) => (b.order === i ? b : { ...b, order: i }));
        const board: Board = {
          id,
          name: name?.trim() || `白板 ${s.boards.length + 1}`,
          placements: [],
          order: normalized.length,
        };
        return { boards: [...normalized, board], activeBoardId: id };
      });
      return id;
    },
    renameBoard: (id, name) =>
      set((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, name } : b)) })),
    deleteBoard: (id) =>
      set((s) => {
        const boards = s.boards.filter((b) => b.id !== id);
        return {
          boards,
          activeBoardId: s.activeBoardId === id ? firstVisibleBoardId(boards) : s.activeBoardId,
        };
      }),
    reorderBoards: (orderedIds) =>
      set((s) => {
        const byId = new Map(s.boards.map((b) => [b.id, b]));
        const ranked: Board[] = [];
        for (const id of orderedIds) {
          const b = byId.get(id);
          if (b && !ranked.includes(b)) ranked.push(b);
        }
        // anything the caller left out keeps its relative position, at the end
        for (const b of s.boards) if (!ranked.includes(b)) ranked.push(b);
        return { boards: ranked.map((b, i) => (b.order === i ? b : { ...b, order: i })) };
      }),
    setBoardArchived: (id, archived) =>
      set((s) => {
        const boards: Board[] = s.boards.map((b) => {
          if (b.id !== id) return b;
          if (archived) return { ...b, archived: true };
          // drop the key rather than storing false, so the file stays unarchived-clean
          const { archived: _dropped, ...rest } = b;
          return rest;
        });
        // never leave the whiteboard pointing at a board the tab row can't show
        const active = boards.find((b) => b.id === s.activeBoardId);
        return {
          boards,
          activeBoardId: active && !active.archived ? s.activeBoardId : firstVisibleBoardId(boards),
        };
      }),
    addCardToBoard: (boardId, cardId, pos) =>
      set((s) => ({
        boards: s.boards.map((b) => {
          if (b.id !== boardId) return b;
          if (b.placements.some((p) => p.cardId === cardId)) return b;
          const at = pos ?? placeCascade(b.placements.length);
          return { ...b, placements: [...b.placements, { cardId, x: at.x, y: at.y }] };
        }),
      })),
    addCardsToBoard: (boardId, cardIds) =>
      set((s) => ({
        boards: s.boards.map((b) => {
          if (b.id !== boardId) return b;
          const existing = new Set(b.placements.map((p) => p.cardId));
          const additions: Placement[] = [];
          let i = b.placements.length;
          for (const cardId of cardIds) {
            if (existing.has(cardId)) continue;
            const at = placeCascade(i++);
            additions.push({ cardId, x: at.x, y: at.y });
            existing.add(cardId);
          }
          return { ...b, placements: [...b.placements, ...additions] };
        }),
      })),
    removeCardFromBoard: (boardId, cardId) =>
      set((s) => ({
        boards: s.boards.map((b) =>
          b.id === boardId ? { ...b, placements: b.placements.filter((p) => p.cardId !== cardId) } : b,
        ),
      })),
    moveCardOnBoard: (boardId, cardId, x, y) =>
      set((s) => ({
        boards: s.boards.map((b) =>
          b.id === boardId
            ? { ...b, placements: b.placements.map((p) => (p.cardId === cardId ? { ...p, x, y } : p)) }
            : b,
        ),
      })),
    createCardOnBoard: (boardId, input, pos) => {
      const id = get().addCard({ title: input.title, type: input.type, body: input.body ?? '' });
      get().addCardToBoard(boardId, id, pos);
      return id;
    },
    openAddToBoard: () => set({ addToBoardOpen: true }),
    closeAddToBoard: () => set({ addToBoardOpen: false }),
    openBoardManager: () => set({ boardManagerOpen: true }),
    closeBoardManager: () => set({ boardManagerOpen: false }),
    migrateDefaultBoard: () =>
      set((s) => {
        if (s.boards.length > 0) return s;
        const placements: Placement[] = s.cards.map((c, i) => {
          const at =
            typeof c.x === 'number' && typeof c.y === 'number' ? { x: c.x, y: c.y } : placeCascade(i);
          return { cardId: c.id, x: at.x, y: at.y };
        });
        const board: Board = { id: shortId('b'), name: '我的白板', placements };
        return { boards: [board], activeBoardId: board.id };
      }),

    // cards
    addCard: (input) => {
      const id = input.id ?? ulid();
      const card: Card = {
        id,
        type: input.type,
        title: input.title,
        body: input.body ?? '',
        tags: input.tags ?? [],
        created: input.created ?? nowISO(),
        updated: input.updated ?? nowISO(),
      };
      set((s) => ({ cards: [...s.cards, card] }));
      return id;
    },
    updateCard: (id, patch) =>
      set((s) => ({
        cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch, updated: nowISO() } : c)),
      })),
    deleteCard: (id) =>
      set((s) => ({
        cards: s.cards.filter((c) => c.id !== id),
        links: s.links.filter((l) => l.a !== id && l.b !== id),
        projects: s.projects.map((p) => ({
          ...p,
          cols: {
            todo: p.cols.todo.filter((x) => x !== id),
            doing: p.cols.doing.filter((x) => x !== id),
            done: p.cols.done.filter((x) => x !== id),
          },
        })),
        boards: s.boards.map((b) => ({
          ...b,
          placements: b.placements.filter((p) => p.cardId !== id),
        })),
        selectedId: s.selectedId === id ? null : s.selectedId,
        detailOpen: s.selectedId === id ? false : s.detailOpen,
      })),

    // links
    addLink: (a, b) =>
      set((s) => {
        if (a === b) return s;
        const k = linkKey(a, b);
        const others = s.links.filter((l) => linkKey(l.a, l.b) !== k);
        return { links: [...others, { a, b, type: 'solid' }] };
      }),
    removeLink: (a, b) =>
      set((s) => ({ links: s.links.filter((l) => linkKey(l.a, l.b) !== linkKey(a, b)) })),
    acceptLink: (a, b) =>
      set((s) => ({
        links: s.links.map((l) =>
          linkKey(l.a, l.b) === linkKey(a, b) ? { a: l.a, b: l.b, type: 'solid' } : l,
        ),
      })),
    dismissLink: (a, b) =>
      set((s) => ({ links: s.links.filter((l) => linkKey(l.a, l.b) !== linkKey(a, b)) })),
    setAiSuggestions: (suggestions) =>
      set((s) => {
        const solidKeys = new Set(
          s.links.filter((l) => l.type === 'solid').map((l) => linkKey(l.a, l.b)),
        );
        const fresh: Link[] = suggestions
          .filter((sg) => sg.a !== sg.b && !solidKeys.has(linkKey(sg.a, sg.b)))
          .map((sg) => ({ a: sg.a, b: sg.b, type: 'ai' as const, reason: sg.reason }));
        // keep solid links, replace ai links with the new suggestions (dedup by key)
        const seen = new Set<string>();
        const merged: Link[] = [];
        for (const l of s.links.filter((l) => l.type === 'solid')) {
          merged.push(l);
          seen.add(linkKey(l.a, l.b));
        }
        for (const l of fresh) {
          const k = linkKey(l.a, l.b);
          if (!seen.has(k)) {
            merged.push(l);
            seen.add(k);
          }
        }
        return { links: merged };
      }),

    // diary
    addDiaryEntry: (text) => {
      const date = todayISO();
      const existing = get().diary.find((d) => d.date === date);
      if (existing) {
        const merged = existing.text ? `${existing.text}\n${text}` : text;
        set((s) => ({ diary: s.diary.map((d) => (d.id === existing.id ? { ...d, text: merged } : d)) }));
        return existing.id;
      }
      const id = shortId('d');
      const entry: DiaryEntry = { id, date, processed: false, text, extracted: [] };
      set((s) => ({ diary: [entry, ...s.diary] }));
      return id;
    },
    updateDiary: (id, patch) =>
      set((s) => ({ diary: s.diary.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
    applyDiaryExtraction: (entryId, extracted) => {
      const baseIdx = get().cards.length;
      const created: { id: string; title: string; type: CardType }[] = [];
      const newCards: Card[] = extracted.map((ex, i) => {
        const id = ulid();
        const pos = placeCascade(baseIdx + i);
        created.push({ id, title: ex.title, type: ex.type });
        return {
          id,
          type: ex.type,
          title: ex.title,
          body: ex.body,
          x: pos.x,
          y: pos.y,
          tags: ex.tags ?? [],
          created: nowISO(),
          updated: nowISO(),
        };
      });
      set((s) => ({
        cards: [...s.cards, ...newCards],
        diary: s.diary.map((d) =>
          d.id === entryId
            ? { ...d, processed: true, extracted: created as DiaryExtract[] }
            : d,
        ),
      }));
    },

    // projects
    selectProject: (id) => set({ activeProjectId: id }),
    openNewProj: () => set({ newProjOpen: true, newProjName: '', newProjSel: [] }),
    closeNewProj: () => set({ newProjOpen: false }),
    setNewProjName: (n) => set({ newProjName: n }),
    toggleNewProjCard: (id) =>
      set((s) => ({
        newProjSel: s.newProjSel.includes(id)
          ? s.newProjSel.filter((x) => x !== id)
          : [...s.newProjSel, id],
      })),
    createProject: () =>
      set((s) => {
        const id = shortId('p');
        const proj: Project = {
          id,
          name: s.newProjName.trim() || '未命名專案',
          color: PROJECT_PALETTE[s.projects.length % PROJECT_PALETTE.length],
          cols: { todo: [...s.newProjSel], doing: [], done: [] },
        };
        return { projects: [...s.projects, proj], activeProjectId: id, newProjOpen: false };
      }),
    moveKanbanCard: (projectId, cardId, from, to) =>
      set((s) => ({
        projects: s.projects.map((p) => {
          if (p.id !== projectId) return p;
          if (from === to) return p;
          const cols = {
            todo: [...p.cols.todo],
            doing: [...p.cols.doing],
            done: [...p.cols.done],
          };
          cols[from] = cols[from].filter((x) => x !== cardId);
          if (!cols[to].includes(cardId)) cols[to] = [...cols[to], cardId];
          return { ...p, cols };
        }),
      })),
    removeCardFromProject: (projectId, cardId) =>
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                cols: {
                  todo: p.cols.todo.filter((x) => x !== cardId),
                  doing: p.cols.doing.filter((x) => x !== cardId),
                  done: p.cols.done.filter((x) => x !== cardId),
                },
              }
            : p,
        ),
      })),

    // sync state
    setSyncStatus: (syncStatus) => set({ syncStatus }),
    setRepo: (repo) => set({ repo }),
    setPat: (pat) => set({ pat }),
    setAnthropicKey: (anthropicKey) => set({ anthropicKey }),
    setCommits: (commits) => set({ commits }),
    setConflicts: (conflicts) => set({ conflicts, conflictOpen: conflicts.length > 0 }),
    setSyncError: (syncError) => set({ syncError, syncStatus: syncError ? 'error' : get().syncStatus }),
    markSynced: () => set({ lastSyncedAt: nowISO(), syncError: null }),

    // lifecycle
    hydrate: (data) =>
      set((s) => {
        const boards = data.boards ?? s.boards;
        // the board we were on may have been deleted OR archived on another device
        const current = boards.find((b) => b.id === s.activeBoardId);
        return {
          cards: data.cards ?? s.cards,
          links: data.links ?? s.links,
          projects: data.projects ?? s.projects,
          diary: data.diary ?? s.diary,
          boards,
          activeProjectId:
            data.activeProjectId !== undefined
              ? data.activeProjectId
              : (data.projects?.[0]?.id ?? s.activeProjectId),
          activeBoardId: current && !current.archived ? s.activeBoardId : firstVisibleBoardId(boards),
          hydrated: true,
        };
      }),
    mergeImport: (data) =>
      set((s) => {
        const cardIds = new Set(s.cards.map((c) => c.id));
        const mergedCards = [...s.cards, ...data.cards.filter((c) => !cardIds.has(c.id))];
        const linkKeys = new Set(s.links.map((l) => linkKey(l.a, l.b)));
        const mergedLinks = [
          ...s.links,
          ...data.links.filter((l) => !linkKeys.has(linkKey(l.a, l.b))),
        ];
        const projIds = new Set(s.projects.map((p) => p.id));
        const mergedProjects = [...s.projects, ...data.projects.filter((p) => !projIds.has(p.id))];
        const diaryDates = new Set(s.diary.map((d) => d.date));
        const mergedDiary = [...s.diary, ...data.diary.filter((d) => !diaryDates.has(d.date))];
        const boardIds = new Set(s.boards.map((b) => b.id));
        const mergedBoards = [...s.boards, ...(data.boards ?? []).filter((b) => !boardIds.has(b.id))];
        return {
          cards: mergedCards,
          links: mergedLinks,
          projects: mergedProjects,
          diary: mergedDiary,
          boards: mergedBoards,
          activeBoardId: s.activeBoardId ?? firstVisibleBoardId(mergedBoards),
        };
      }),
    getData: () => {
      const s = get();
      return {
        cards: s.cards,
        links: s.links,
        projects: s.projects,
        diary: s.diary,
        boards: s.boards,
      };
    },
  };
});
