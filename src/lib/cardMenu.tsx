import { Pencil, Palette, LayoutDashboard, Trash2 } from 'lucide-react';
import type { MenuItem } from '@/components/common/ContextMenu';
import { useStore } from '@/store';
import { CARD_TYPES, CARD_TYPE_LIST } from '@/lib/tokens';

function dot(color: string) {
  return <span style={{ width: 9, height: 9, borderRadius: 3, background: color, display: 'inline-block' }} />;
}

/** open the card detail for full editing */
export function editItem(cardId: string): MenuItem {
  return { label: '編輯卡片', icon: <Pencil size={15} />, onClick: () => useStore.getState().selectCard(cardId) };
}

/** change a card's type (submenu, current type checked) */
export function changeTypeItem(cardId: string): MenuItem {
  const card = useStore.getState().cards.find((c) => c.id === cardId);
  return {
    label: '變更類型',
    icon: <Palette size={15} />,
    submenu: CARD_TYPE_LIST.map((t) => ({
      label: CARD_TYPES[t].label,
      icon: dot(CARD_TYPES[t].color),
      checked: card?.type === t,
      onClick: () => useStore.getState().updateCard(cardId, { type: t }),
    })),
  };
}

/** add a card onto a whiteboard it isn't on yet (submenu of eligible boards) */
export function addToBoardItem(cardId: string): MenuItem {
  const boards = useStore.getState().boards.filter((b) => !b.placements.some((p) => p.cardId === cardId));
  return {
    label: '加入白板',
    icon: <LayoutDashboard size={15} />,
    submenu: boards.length
      ? boards.map((b) => ({ label: b.name, onClick: () => useStore.getState().addCardToBoard(b.id, cardId) }))
      : [{ label: '（已在所有白板）', disabled: true }],
  };
}

export function deleteItem(cardId: string): MenuItem {
  return {
    label: '刪除卡片',
    icon: <Trash2 size={15} />,
    danger: true,
    onClick: () => {
      if (confirm('刪除這張卡片？')) useStore.getState().deleteCard(cardId);
    },
  };
}

/** standard card context menu used by the library (and as a base elsewhere) */
export function cardMenu(cardId: string): MenuItem[] {
  return [editItem(cardId), changeTypeItem(cardId), addToBoardItem(cardId), { separator: true }, deleteItem(cardId)];
}
