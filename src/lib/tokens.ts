import type { CardType } from '@/types';

export interface TypeToken {
  label: string;
  color: string;
  tint: string;
  /** short description fed to the (future) auto-classifier */
  hint: string;
}

export const CARD_TYPES: Record<CardType, TypeToken> = {
  idea: { label: '想法', color: '#F08C00', tint: '#FFF4E0', hint: '靈感、點子、假設、原則' },
  research: { label: '訪談', color: '#0CA678', tint: '#E6FCF5', hint: '使用者研究、訪談、調查發現' },
  compete: { label: '競品', color: '#1098AD', tint: '#E3FAFC', hint: '競品分析、市場觀察' },
  meeting: { label: '會議', color: '#4263EB', tint: '#EDF0FF', hint: '會議記錄、決議、結論' },
  design: { label: '設計', color: '#E64980', tint: '#FFEEF5', hint: '設計取捨、互動、體驗原則' },
  tech: { label: '技術', color: '#7048E8', tint: '#F3F0FF', hint: '技術方案、架構、實作細節' },
  okr: { label: '目標', color: '#E8590C', tint: '#FFF0E6', hint: '目標、OKR、KPI、規劃' },
};

export const CARD_TYPE_LIST = Object.keys(CARD_TYPES) as CardType[];

export function typeColor(type: CardType): string {
  return CARD_TYPES[type]?.color ?? '#868e96';
}

export function typeLabel(type: CardType): string {
  return CARD_TYPES[type]?.label ?? type;
}

/** palette used when creating new projects */
export const PROJECT_PALETTE = ['#4263EB', '#0CA678', '#E8590C', '#7048E8', '#E64980'];

/** Heptabase card-instance colors → our card type (best-effort inference) */
export const HEPTA_COLOR_TO_TYPE: Record<string, CardType> = {
  orange: 'idea',
  yellow: 'idea',
  green: 'research',
  cyan: 'compete',
  teal: 'compete',
  blue: 'meeting',
  pink: 'design',
  red: 'okr',
  purple: 'tech',
  violet: 'tech',
};

export const KANBAN_COLUMNS = [
  { id: 'todo' as const, title: '待辦', color: '#868e96' },
  { id: 'doing' as const, title: '進行中', color: '#4263EB' },
  { id: 'done' as const, title: '已完成', color: '#0CA678' },
];

// card geometry on the whiteboard (kept in sync with WhiteboardView CardNode)
export const CARD_W = 212;
export const CARD_CX = 106;
export const CARD_CY = 62;
