// ---- Card ----
export type CardType =
  | 'idea'
  | 'research'
  | 'compete'
  | 'meeting'
  | 'design'
  | 'tech'
  | 'okr';

export interface Card {
  id: string;
  type: CardType;
  title: string;
  body: string;
  tags: string[];
  created: string; // ISO 8601
  updated: string; // ISO 8601
  /** legacy/default canvas position — positions now live in board placements */
  x?: number;
  y?: number;
}

// ---- Whiteboard ----
/** a card placed on a board, with a board-specific position */
export interface Placement {
  cardId: string;
  x: number;
  y: number;
}

export interface Board {
  id: string;
  name: string;
  placements: Placement[];
  /**
   * display order among boards (lower first). Optional so pre-existing board
   * files stay byte-identical until the user actually reorders something.
   */
  order?: number;
  /** archived boards leave the tab row and live in the archive drawer */
  archived?: boolean;
}

// ---- Link (undirected) ----
export type LinkType = 'solid' | 'ai';

export interface Link {
  a: string;
  b: string;
  type: LinkType;
  /** rationale, only meaningful for ai-suggested links */
  reason?: string;
}

// ---- Project / Kanban ----
export type KanbanColumn = 'todo' | 'doing' | 'done';

export interface Project {
  id: string;
  name: string;
  color: string;
  cols: Record<KanbanColumn, string[]>;
}

// ---- Diary ----
export interface DiaryExtract {
  /** id of the card created from this extract (back-reference) */
  id?: string;
  title: string;
  type: CardType;
}

export interface DiaryEntry {
  id: string;
  /** canonical date, YYYY-MM-DD */
  date: string;
  processed: boolean;
  text: string;
  extracted: DiaryExtract[];
}

// ---- AI service contracts ----
export interface Citation {
  cardId: string;
  quote?: string;
}
export interface SearchResult {
  answer: string;
  citations: Citation[];
}
export interface LinkSuggestion {
  a: string;
  b: string;
  reason: string;
}
export interface ExtractedCard {
  title: string;
  body: string;
  type: CardType;
  tags?: string[];
}
export interface Classification {
  type: CardType;
  tags?: string[];
}

export interface AiProvider {
  readonly id: 'local' | 'claude';
  readonly label: string;
  search(question: string, cards: Card[]): Promise<SearchResult>;
  suggestLinks(cards: Card[], existing: Link[], focusCardId?: string): Promise<LinkSuggestion[]>;
  extractCardsFromDiary(entry: DiaryEntry, knownTags: string[]): Promise<ExtractedCard[]>;
  autoClassify(card: Pick<Card, 'title' | 'body' | 'tags'>): Promise<Classification>;
}

// ---- Sync ----
export type SyncStatus =
  | 'unconfigured'
  | 'initializing'
  | 'loading'
  | 'ready'
  | 'committing'
  | 'pushing'
  | 'pulling'
  | 'conflict'
  | 'error';

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

export interface CommitInfo {
  hash: string;
  msg: string;
  time: string;
}

export type ConflictKind = 'card' | 'link' | 'project' | 'diary' | 'board';

export interface Conflict {
  path: string;
  kind: ConflictKind;
  ours: string;
  theirs: string;
  base?: string;
}

export type ConflictChoice = 'ours' | 'theirs' | 'keep-both';

export interface ConflictResolution {
  path: string;
  choice: ConflictChoice;
}

// ---- Import ----
export interface ImportReport {
  cardsImported: number;
  linksImported: number;
  diaryImported: number;
  instancesSkipped: number;
  connectionsDropped: number;
  warnings: string[];
  lossyCards: string[];
}

export type ViewName = 'whiteboard' | 'library' | 'kanban' | 'diary';
