import type { CardType } from '@/types';
import { CARD_TYPES } from '@/lib/tokens';

export function TypeDot({ type, size = 9 }: { type: CardType; size?: number }) {
  const color = CARD_TYPES[type]?.color ?? '#868e96';
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 3,
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

export function CardTypeBadge({ type, fontSize = 11 }: { type: CardType; fontSize?: number }) {
  const t = CARD_TYPES[type] ?? CARD_TYPES.idea;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <TypeDot type={type} />
      <span style={{ fontSize, fontWeight: 700, color: t.color, letterSpacing: 0.3 }}>{t.label}</span>
    </div>
  );
}
