type Props = {
  /** Base font size for "Game" and "n" in px. The ⏻ symbol scales to 1.24× with a proportional negative margin. */
  size?: number;
};

export default function GameOnLogo({ size = 22 }: Props) {
  const symbolSize = size >= 40 ? Math.round(size * 1.24) : size;
  const nudge = `${Math.round(size * 0.04)}px`;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 800,
        fontSize: `${size}px`,
        color: '#e0e7f3',
        letterSpacing: '-1px',
        position: 'relative',
        top: nudge,
      }}>Game</span>
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 800,
        fontSize: `${symbolSize}px`,
        color: 'var(--accent)',
        lineHeight: 1,
        marginRight: `-${Math.round(size * 0.04)}px`,
      }}>⏻</span>
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 800,
        fontSize: `${size}px`,
        color: 'var(--accent)',
        letterSpacing: '-1px',
        position: 'relative',
        top: nudge,
      }}>n</span>
    </div>
  );
}
