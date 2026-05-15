type Props = {
  /** Base font size for "Game" and "n" in px. The power icon scales to 1.24× at large sizes. */
  size?: number;
};

export default function GameOnLogo({ size = 22 }: Props) {
  const iconSize = size >= 40 ? Math.round(size * 1.24) : size;
  const gap = -Math.round(size * 0.10);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', lineHeight: 1 }}>
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 800,
        fontSize: `${size}px`,
        color: '#e0e7f3',
        letterSpacing: '-1px',
      }}>Game</span>
      {/* Inline SVG power icon — renders identically across all browsers */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.6}
        strokeLinecap="round"
        style={{ display: 'inline-block', verticalAlign: 'baseline', marginBottom: 0, marginRight: `${gap}px` }}
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
    </div>
  );
}
