type Props = {
  /** Base font size for "Game" and "n" in px. The power icon scales to 1.24× at large sizes. */
  size?: number;
};

export default function GameOnLogo({ size = 22 }: Props) {
  const iconSize = size >= 40 ? Math.round(size * 1.24) : size;
  // Circle center is at y=12.6, radius 8 → bottom of ring at y=20.6.
  // Add half stroke-width (1.3) → clip viewBox at y=22 so SVG bottom = ring bottom.
  // Height is scaled proportionally so the circle stays perfectly round.
  const iconHeight = Math.round(iconSize * 22 / 24);
  const gap = -Math.round(size * 0.10);
  return (
    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', lineHeight: 1 }}>
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 800,
        fontSize: `${size}px`,
        color: '#e0e7f3',
        letterSpacing: '-1px',
      }}>Game</span>
      <svg
        width={iconSize}
        height={iconHeight}
        viewBox="0 0 24 22"
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.6}
        strokeLinecap="round"
        style={{ display: 'inline-block', verticalAlign: 'baseline', marginRight: `${gap}px` }}
        aria-hidden="true"
      >
        <path d="M12 3v7" />
        <path d="M7.2 6.2A8 8 0 1 0 16.8 6.2" />
      </svg>
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 800,
        fontSize: `${size}px`,
        color: 'var(--accent)',
        letterSpacing: '-1px',
      }}>n</span>
    </span>
  );
}
