type Props = {
  /** Base font size for "Game" and "n" in px. The ⏻ symbol scales to 1.24× with a proportional negative margin. */
  size?: number;
};

export default function GameOnLogo({ size = 22 }: Props) {
  const symbolSize = Math.round(size * 1.24);
  const gap = -Math.round(size * 0.04);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', lineHeight: 1 }}>
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 800,
        fontSize: `${size}px`,
        color: '#e0e7f3',
        letterSpacing: '-1px',
      }}>Game</span>
      <span style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 800,
        fontSize: `${symbolSize}px`,
        color: 'var(--accent)',
        lineHeight: 1,
        position: 'relative',
        top: `${Math.round(size * 0.03)}px`,
        marginRight: `${gap}px`,
      }}>⏻</span>
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
