import { useStore } from '@/store';
import { useIsMobile, useIsTablet } from '@/hooks/useMediaQuery';
import { Sheet } from '@/components/common/Sheet';
import { CardDetailContent } from '@/components/panels/CardDetailContent';

/**
 * Renders the card detail panel in the right chrome for the device:
 *  - desktop: in-flow flex side panel (main column shrinks)
 *  - tablet:  overlay drawer from the right
 *  - mobile:  full-width bottom sheet
 * Must be the last child of the AppShell flex row.
 */
export function DetailHost() {
  const detailOpen = useStore((s) => s.detailOpen);
  const closeDetail = useStore((s) => s.closeDetail);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  if (!detailOpen) return null;

  if (isMobile) {
    return (
      <Sheet onClose={closeDetail} title="卡片">
        <CardDetailContent onClose={closeDetail} />
      </Sheet>
    );
  }

  if (isTablet) {
    return (
      <>
        <div onClick={closeDetail} style={{ position: 'absolute', inset: 0, background: 'rgba(20,18,30,.18)', zIndex: 39 }} />
        <div
          className="anim-slidein"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 400,
            maxWidth: '88vw',
            background: '#fff',
            borderLeft: '1px solid rgba(0,0,0,.08)',
            boxShadow: '-8px 0 30px rgba(0,0,0,.08)',
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <CardDetailContent onClose={closeDetail} />
        </div>
      </>
    );
  }

  return (
    <div
      className="anim-slidein"
      style={{
        width: 'var(--panel-w)',
        flexShrink: 0,
        background: '#fff',
        borderLeft: '1px solid rgba(0,0,0,.08)',
        boxShadow: '-8px 0 30px rgba(0,0,0,.06)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
      }}
    >
      <CardDetailContent onClose={closeDetail} />
    </div>
  );
}
