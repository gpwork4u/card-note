import { CARD_CX, CARD_CY } from './tokens';

export interface Point {
  x: number;
  y: number;
}

/** centre point of a card box on the whiteboard, given its placement position */
export function cardCenter(c: { x: number; y: number }): Point {
  return { x: c.x + CARD_CX, y: c.y + CARD_CY };
}

/** horizontal-ish cubic bezier path between two card centres (matches the design) */
export function linkPath(a: Point, b: Point): string {
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}
