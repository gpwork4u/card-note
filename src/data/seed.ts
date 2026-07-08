import type { Board, Card, DiaryEntry, Link, Project } from '@/types';

// Seed content lifted from the design comp so the app is immediately explorable
// on first run (before the user imports or syncs anything).

const T = (d: string) => `2026-06-${d}T09:00:00Z`;

export const seedCards: Card[] = [
  { id: 'c1', type: 'idea', title: '用卡片連結做需求追溯', body: '把每個需求拆成一張卡片，用連結串起「來源 → 決策 → 實作」，之後追溯改動原因不用翻文件。', tags: ['需求', '流程'], created: T('20'), updated: T('27') },
  { id: 'c2', type: 'research', title: 'B 端客戶最在意匯出格式', body: '三家受訪客戶都提到要能匯出成 Markdown 與 PDF；匯入既有資料的成本，是換工具的最大阻力。', tags: ['訪談', '匯出'], created: T('21'), updated: T('27') },
  { id: 'c3', type: 'compete', title: 'Notion AI 摘要體驗拆解', body: '選取段落即時摘要的互動很順，但跨頁面整理仍要手動。我們的白板連結正好能補這塊。', tags: ['競品', 'AI'], created: T('21'), updated: T('25') },
  { id: 'c4', type: 'meeting', title: '6/24 產品週會記錄', body: '決議：先做白板與卡片庫，Kanban 延後。同步先支援 GitHub，一張卡片一個檔案。', tags: ['會議', '決策'], created: T('24'), updated: T('24') },
  { id: 'c5', type: 'design', title: '原則：減少不必要的設定頁', body: '預設值要夠好，讓 90% 的人不用進設定。每多一個開關，就多一次猶豫。', tags: ['設計原則'], created: T('22'), updated: T('26') },
  { id: 'c6', type: 'tech', title: 'GitHub 同步衝突處理', body: '用每張卡片獨立檔案 + 時間戳；衝突時保留兩個版本讓使用者選，絕不自動覆蓋。', tags: ['同步', 'Git'], created: T('23'), updated: T('26') },
  { id: 'c7', type: 'okr', title: 'Q3 產品 OKR 草稿', body: 'O：讓新使用者 10 分鐘內建立第一個白板。KR1 啟用率 40%；KR2 次週留存 25%。', tags: ['OKR'], created: T('20'), updated: T('20') },
  { id: 'c8', type: 'idea', title: 'AI 自動歸檔的觸發時機', body: '在卡片「失焦 + 停留 3 秒」時跑歸檔建議，避免打字當下被打斷。', tags: ['AI', '互動'], created: T('24'), updated: T('27') },
];

export const seedLinks: Link[] = [
  { a: 'c1', b: 'c2', type: 'solid' },
  { a: 'c1', b: 'c4', type: 'solid' },
  { a: 'c4', b: 'c5', type: 'solid' },
  { a: 'c4', b: 'c6', type: 'solid' },
  { a: 'c4', b: 'c7', type: 'solid' },
  { a: 'c5', b: 'c8', type: 'solid' },
  { a: 'c2', b: 'c3', type: 'solid' },
  { a: 'c3', b: 'c5', type: 'ai', reason: '兩張都談到「降低使用者的操作負擔」。' },
  { a: 'c8', b: 'c3', type: 'ai', reason: '同屬 AI 互動模式的設計討論，可互相參照。' },
  { a: 'c2', b: 'c8', type: 'ai', reason: '都關於減少使用者的手動工作，可能是同一條主線。' },
];

// Two demo boards, each holding its own subset of cards. c4 appears on both
// (with different positions) to show the many-to-many model.
export const seedBoards: Board[] = [
  {
    id: 'b1',
    name: '產品白板',
    placements: [
      { cardId: 'c1', x: 140, y: 120 },
      { cardId: 'c2', x: 480, y: 90 },
      { cardId: 'c3', x: 830, y: 150 },
      { cardId: 'c4', x: 300, y: 380 },
      { cardId: 'c5', x: 700, y: 410 },
      { cardId: 'c8', x: 540, y: 630 },
    ],
  },
  {
    id: 'b2',
    name: '技術 & 目標',
    placements: [
      { cardId: 'c4', x: 160, y: 140 },
      { cardId: 'c6', x: 180, y: 420 },
      { cardId: 'c7', x: 560, y: 220 },
    ],
  },
];

export const seedProjects: Project[] = [
  { id: 'p1', name: '新版白板上線', color: '#4263EB', cols: { todo: ['c8', 'c5'], doing: ['c1', 'c4'], done: ['c6'] } },
  { id: 'p2', name: '客戶匯出需求', color: '#0CA678', cols: { todo: ['c2'], doing: ['c3'], done: [] } },
];

export const seedDiary: DiaryEntry[] = [
  {
    id: 'd1', date: '2026-06-27', processed: false,
    text: '今天連續跟兩個客戶聊匯出需求，Markdown 的呼聲最高，PDF 次之。\n也意識到：白板的卡片連結，正好能補競品做不到的「跨頁面整理」。這也許是我們的差異點。',
    extracted: [],
  },
  {
    id: 'd2', date: '2026-06-26', processed: true,
    text: '週會結論：先把白板和卡片庫做扎實，Kanban 延後。\n設定頁要砍，預設值做好就不用一堆開關。',
    extracted: [
      { title: '本期範圍：白板 + 卡片庫優先', type: 'meeting' },
      { title: '設計取捨：砍設定頁、強化預設值', type: 'design' },
    ],
  },
  {
    id: 'd3', date: '2026-06-24', processed: false,
    text: '在想 AI 歸檔該什麼時候跳出來。打字打到一半被打斷最煩，\n也許「停手三秒」是個好訊號。',
    extracted: [],
  },
];

export function seedData() {
  return {
    cards: structuredClone(seedCards),
    links: structuredClone(seedLinks),
    projects: structuredClone(seedProjects),
    diary: structuredClone(seedDiary),
    boards: structuredClone(seedBoards),
  };
}
